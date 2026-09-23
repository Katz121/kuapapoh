// POST /api/track · รับสถิติการใช้เว็บจากเบราว์เซอร์มาเก็บไว้เอง
// ไม่ต้องมี Meta Pixel ก็นับได้ · มี Pixel แล้วส่ง Conversions API สดทันที
//
// กฎของด่านนี้: เป็นปลายทางเปิด ใครยิงก็ได้ จึงต้องถือว่าทุกค่าที่ส่งมาเป็นของปลอมไว้ก่อน
// ตัดขนาด ตัดความยาว รับเฉพาะชื่อ event ที่รู้จัก และจำกัดจำนวนครั้งต่อไอพี
import { requireDb, clean, ipFingerprint } from './_shared.js';
import { sendCapi, sha256Hex, phoneForMeta } from './_meta.js';

const MAX_BODY = 4 * 1024;
const RATE_WINDOW_MINUTES = 10;
const RATE_MAX_HITS = 300;          // คนอ่านเว็บปกติไม่ยิงถี่กว่านี้ · เกินนี้คือบอทหรือสคริปต์
const EVENTS = new Set([
  'PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Lead',
]);

// UA ที่เป็นบอท · รวม bot ของ Meta ที่ยิงรีวิวแอด
const BOT_UA_RE = /facebookexternalhit|facebookcatalog|Facebot|meta-externalagent|meta-externalfetcher|(?<!cu)bot\b|crawler|spider|HeadlessChrome|Lighthouse|PTST|python-requests|curl\//i;
// ASN ของ Meta · บอทรีวิวแอดยิงมาจากกลุ่มนี้
const META_ASNS = new Set([32934, 63293, 54115]);

export async function onRequestPost(context) {
  const { request, env } = context;
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
  const fullUa = request.headers.get('user-agent') || '';
  // อ่านไอพีก่อนตอบกลับ · ใช้ส่ง Meta อย่างเดียว ไม่เก็บลง DB
  const clientIp = request.headers.get('cf-connecting-ip') || '';
  const asn = cf.asn ? Number(cf.asn) : null;

  // ตรวจบอท
  let is_bot = 0;
  let bot_reason = null;
  if (!fullUa) {
    is_bot = 1; bot_reason = 'no-ua';
  } else if (BOT_UA_RE.test(fullUa)) {
    is_bot = 1; bot_reason = 'ua';
  }
  if (!is_bot && asn && META_ASNS.has(asn)) {
    is_bot = 1; bot_reason = 'asn-meta';
  }
  if (!is_bot && body.wd === true) {
    is_bot = 1; bot_reason = 'webdriver';
  }

  const eventId = clean(body.eventId, 60) || null;
  const visitorId = clean(body.visitor, 60) || null;
  const sessionId = clean(body.session, 60) || null;
  const path = clean(body.path, 200) || null;
  const fbclid = clean(body.fbclid, 255) || null;
  const content = clean(body.content, 80) || null;
  const fbp = clean(body.fbp, 120) || null;
  const fbc = clean(body.fbc, 300) || null;
  const value = money(body.value);
  const currency = clean(body.currency, 8) || (body.value ? 'THB' : null);
  const orderId = clean(body.orderId, 40) || null;
  // สินค้าที่ browser แนบมา · ไม่เชื่อทั้งหมด ตรวจ whitelist ก่อนใช้ · ไม่เก็บลง D1
  const contentIds = cleanIds(body.contentIds !== undefined ? body.contentIds : body.content_ids);
  const numItems = cleanNum(body.numItems !== undefined ? body.numItems : body.num_items);
  const country = clean(cf.country, 4) || null;

  const row = {
    at: now.toISOString(),
    day: thaiDay(now),
    event,
    event_id: eventId,
    visitor: visitorId,
    session: sessionId,
    path,
    referrer: hostOnly(body.referrer),
    source: clean(body.source, 80) || null,
    medium: clean(body.medium, 80) || null,
    campaign: clean(body.campaign, 120) || null,
    fbclid,
    value,
    currency,
    order_id: orderId,
    country,
    ua: browserName(fullUa),
    ip_hash: ipHash,
    is_bot,
    bot_reason,
    asn,
    content,
    fbp,
    fbc,
    meta_status: null,
  };

  // ลิงก์เปล่าในข้อความโพสต์แอดไม่มี utm แต่ fbclid บอกว่าเป็นแอด → ติดป้าย paid ให้ · มี utm อยู่แล้วห้ามทับ
  if (!row.medium && isAdClick(fbclid)) {
    row.source = 'facebook';
    row.medium = 'paid';
    if (!row.campaign) row.campaign = '(ad-no-utm)';
    if (!row.content) row.content = 'ไม่ทราบภาพ';
  }

  // กำหนด meta_status ก่อน insert
  if (is_bot) {
    row.meta_status = 'skip:bot';
  } else if (!env.META_PIXEL_ID || !env.META_CAPI_TOKEN) {
    row.meta_status = 'skip:nocfg';
  }

  let inserted = false;
  try {
    // OR IGNORE = ยิงซ้ำด้วย event_id เดิม (รีเฟรช เน็ตกระตุก) ไม่กลายเป็นสองแถว
    const result = await db.prepare(
      `INSERT OR IGNORE INTO visits
        (at, day, event, event_id, visitor, session, path, referrer,
         source, medium, campaign, fbclid, value, currency, order_id, country, ua, ip_hash,
         is_bot, bot_reason, asn, content, fbp, fbc, meta_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      row.at, row.day, row.event, row.event_id, row.visitor, row.session, row.path, row.referrer,
      row.source, row.medium, row.campaign, row.fbclid, row.value, row.currency,
      row.order_id, row.country, row.ua, row.ip_hash,
      row.is_bot, row.bot_reason, row.asn, row.content, row.fbp, row.fbc, row.meta_status
    ).run();
    // changes = 0 คือ event_id ซ้ำ (รีเฟรช/ยิงซ้ำ) · ห้ามส่งเข้า Meta ซ้ำ เพราะ server+server ไม่ถูก dedup
    inserted = !!(result && result.meta && result.meta.changes > 0);
  } catch {
    // เก็บสถิติพลาด ไม่ใช่เรื่องที่ผู้ใช้ต้องรับรู้
  }

  // CAPI สด: ส่งเมื่อไม่ใช่บอท มี config ครบ และ insert สำเร็จ
  if (inserted && eventId && !is_bot && env.META_PIXEL_ID && env.META_CAPI_TOKEN && EVENTS.has(event)) {
    const background = (async () => {
      try {
        const userData = {
          client_ip_address: clientIp,    // ส่งอย่างเดียว ไม่เก็บลง DB
          client_user_agent: fullUa,      // ส่งอย่างเดียว ไม่เก็บลง DB
        };
        if (fbp) userData.fbp = fbp;
        // fbc: ใช้ cookie _fbc ถ้ามี ไม่งั้นสร้างจาก fbclid
        if (fbc) {
          userData.fbc = fbc;
        } else if (fbclid) {
          userData.fbc = 'fb.1.' + Date.now() + '.' + fbclid;
        }
        // ค่าว่างแฮชแล้วได้ null · ห้ามหลุดเข้า user_data ไม่งั้น Meta ตีกลับทั้ง event
        const externalId = await sha256Hex(visitorId);
        if (externalId) userData.external_id = externalId;
        const countryHash = await sha256Hex(country);
        if (countryHash) userData.country = countryHash;

        // Purchase ที่มี order_id ดึงชื่อเบอร์จาก preorders ใส่ให้ match quality สูงขึ้น
        if (event === 'Purchase' && orderId) {
          try {
            const order = await db
              .prepare('SELECT name, phone, email FROM preorders WHERE id = ?')
              .bind(orderId)
              .first();
            if (order) {
              if (order.phone) {
                const ph = phoneForMeta(order.phone);
                const phHash = ph && await sha256Hex(ph);
                if (phHash) userData.ph = phHash;
              }
              // อีเมล = match key ระดับสูงของ Meta · normalize ตัดช่องว่าง + ตัวพิมพ์เล็กก่อนแฮช
              if (order.email) {
                const emHash = await sha256Hex(String(order.email).trim().toLowerCase());
                if (emHash) userData.em = emHash;
              }
              // ชื่อที่มีช่องว่างนำหน้าต้องไม่ทำให้ fn หาย
              const nameParts = String(order.name || '').trim().split(/\s+/).filter(Boolean);
              if (nameParts.length) {
                userData.fn = await sha256Hex(nameParts[0]);
                if (nameParts.length > 1) userData.ln = await sha256Hex(nameParts[nameParts.length - 1]);
              }
            }
          } catch { /* ดึงออเดอร์ไม่ได้ก็ส่งโดยไม่มีชื่อเบอร์ */ }
        }

        const capiEvent = {
          event_name: event,
          event_time: Math.floor(now.getTime() / 1000),
          event_id: eventId,
          action_source: 'website',
          event_source_url: 'https://kuapapoh.com' + (path || '/'),
          user_data: userData,
        };

        if (value) {
          capiEvent.custom_data = {
            currency: currency || 'THB',
            value,
            content_ids: contentIds,
            content_type: 'product',
          };
          if (numItems) capiEvent.custom_data.num_items = numItems;
          if (orderId) capiEvent.custom_data.order_id = orderId;
        }

        const result = await sendCapi(env, capiEvent);
        const metaStatus = result.ok ? 'ok' : 'err:' + (result.code || result.status);

        // ส่งไม่สำเร็จให้ sent_meta คง 0 · backfill จะเก็บตกให้ทีหลัง
        await db.prepare('UPDATE visits SET sent_meta = ?, meta_status = ? WHERE event_id = ?')
          .bind(result.ok ? 1 : 0, metaStatus, eventId).run();
      } catch {
        // CAPI พลาดไม่ควรทำให้อะไรพัง
        try {
          await db.prepare("UPDATE visits SET meta_status = 'err:exception' WHERE event_id = ?")
            .bind(eventId).run();
        } catch { /* จดไม่ได้ก็ปล่อย */ }
      }
    })();
    if (context.waitUntil) context.waitUntil(background); else await background;
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

/* fbclid เป็น base64 หลายท่อนต่อกัน · คำว่า adid โผล่ได้ 3 แบบตามตำแหน่ง · ก่อนเปิดแอดเจอ 0 session เลยใช้เป็นสัญญาณแอด */
/* หัว IwcGRvZg (pdof) เจอก่อนเปิดแอด 17 session · ไม่ใช่สัญญาณแอด ห้ามใช้ */
function isAdClick(fbclid) {
  if (!fbclid || typeof fbclid !== 'string') return false;
  return fbclid.includes('YWRpZA') || fbclid.includes('FkaWQ') || fbclid.includes('hZGlk');
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

/* content_ids จากเบราว์เซอร์ · รับเฉพาะรหัสที่รู้จัก สูงสุด 5 ตัว · ไม่มีหรือผิดใช้ค่าเดิม */
const KNOWN_IDS = new Set(['je-shirt', 'je-bag']);
function cleanIds(input) {
  if (!Array.isArray(input)) return ['je-shirt'];
  const out = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const id = item.trim().slice(0, 30);
    if (KNOWN_IDS.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= 5) break;
  }
  return out.length ? out : ['je-shirt'];
}

/* num_items จำนวนเต็ม 1 ถึง 100 · นอกช่วงถือว่าไม่มี */
function cleanNum(input) {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 100) return null;
  return n;
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
