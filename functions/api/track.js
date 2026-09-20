// POST /api/track · รับสถิติการใช้เว็บจากเบราว์เซอร์มาเก็บไว้เอง
// ไม่ต้องมี Meta Pixel ก็นับได้ · พอมี Pixel ID แล้วค่อยส่งย้อนเข้า Conversions API
//
// กฎของด่านนี้: เป็นปลายทางเปิด ใครยิงก็ได้ จึงต้องถือว่าทุกค่าที่ส่งมาเป็นของปลอมไว้ก่อน
// ตัดขนาด ตัดความยาว รับเฉพาะชื่อ event ที่รู้จัก และจำกัดจำนวนครั้งต่อไอพี
import { requireDb, clean, ipFingerprint } from './_shared.js';

const MAX_BODY = 4 * 1024;
const RATE_WINDOW_MINUTES = 10;
const RATE_MAX_HITS = 300;          // คนอ่านเว็บปกติไม่ยิงถี่กว่านี้ · เกินนี้คือบอทหรือสคริปต์
const EVENTS = new Set([
  'PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Lead',
]);

export async function onRequestPost({ request, env }) {
  // เก็บสถิติไม่ได้ ห้ามทำให้หน้าเว็บรู้สึกพัง · ตอบ 204 เงียบๆ เสมอ
  const ok = () => new Response(null, { status: 204 });

  const declared = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(declared) && declared > MAX_BODY) return ok();

  const db = requireDb(env);
  if (!db) return ok();

  let body;
  try {
    body = await request.json();
  } catch {
    return ok();
  }
  if (!body || typeof body !== 'object') return ok();

  const event = clean(body.event, 30);
  if (!EVENTS.has(event)) return ok();

  const ipHash = await ipFingerprint(request);
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  try {
    const recent = await db
      .prepare('SELECT COUNT(*) AS n FROM visits WHERE ip_hash = ? AND at > ?')
      .bind(ipHash, since)
      .first();
    if (recent && recent.n >= RATE_MAX_HITS) return ok();
  } catch {
    // ยังไม่ได้รันไมเกรชัน = ยังไม่มีตาราง · ปล่อยผ่าน ไม่ต้องให้หน้าเว็บรู้
    return ok();
  }

  const now = new Date();
  const cf = request.cf || {};
  const row = {
    at: now.toISOString(),
    day: thaiDay(now),
    event,
    event_id: clean(body.eventId, 60) || null,
    visitor: clean(body.visitor, 60) || null,
    session: clean(body.session, 60) || null,
    path: clean(body.path, 200) || null,
    referrer: hostOnly(body.referrer),
    source: clean(body.source, 80) || null,
    medium: clean(body.medium, 80) || null,
    campaign: clean(body.campaign, 120) || null,
    fbclid: clean(body.fbclid, 255) || null,
    value: money(body.value),
    currency: clean(body.currency, 8) || (body.value ? 'THB' : null),
    order_id: clean(body.orderId, 40) || null,
    country: clean(cf.country, 4) || null,
    ua: browserName(request.headers.get('user-agent')),
    ip_hash: ipHash,
  };

  try {
    // OR IGNORE = ยิงซ้ำด้วย event_id เดิม (รีเฟรช เน็ตกระตุก) ไม่กลายเป็นสองแถว
    await db.prepare(
      `INSERT OR IGNORE INTO visits
        (at, day, event, event_id, visitor, session, path, referrer,
         source, medium, campaign, fbclid, value, currency, order_id, country, ua, ip_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      row.at, row.day, row.event, row.event_id, row.visitor, row.session, row.path, row.referrer,
      row.source, row.medium, row.campaign, row.fbclid, row.value, row.currency,
      row.order_id, row.country, row.ua, row.ip_hash
    ).run();
  } catch {
    // เก็บสถิติพลาด ไม่ใช่เรื่องที่ผู้ใช้ต้องรับรู้
  }

  return ok();
}

const methodNotAllowed = () => new Response('ใช้ได้เฉพาะการส่งข้อมูล (POST)', { status: 405 });
export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;

/* วันตามเวลาไทย · ถ้าใช้ UTC ยอดหลังหกโมงเย็นจะไปโผล่วันถัดไป อ่านแล้วงง */
function thaiDay(date) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/* เก็บแค่โดเมนที่พามา ไม่เก็บ URL เต็ม · รู้ว่ามาจากเฟซบุ๊กก็พอแล้ว */
function hostOnly(value) {
  const text = String(value || '').slice(0, 300);
  if (!text) return null;
  try {
    return new URL(text).hostname.replace(/^www\./, '').slice(0, 80);
  } catch {
    return null;
  }
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000000) return null;
  return Math.round(number * 100) / 100;
}

/* ชื่อเบราว์เซอร์คร่าวๆ พอให้รู้ว่าคนเปิดจากไลน์หรือจากเบราว์เซอร์จริง
   ไม่เก็บ user-agent เต็ม เพราะยาวและระบุตัวเครื่องได้ละเอียดเกินจำเป็น */
function browserName(ua) {
  const text = String(ua || '');
  if (!text) return null;
  if (/\bLine\//i.test(text)) return 'LINE';
  if (/FBAN|FBAV/i.test(text)) return 'Facebook';
  if (/Instagram/i.test(text)) return 'Instagram';
  if (/Edg\//i.test(text)) return 'Edge';
  if (/Chrome\//i.test(text)) return 'Chrome';
  if (/Safari\//i.test(text)) return 'Safari';
  if (/Firefox\//i.test(text)) return 'Firefox';
  if (/bot|crawler|spider/i.test(text)) return 'Bot';
  return 'อื่นๆ';
}
