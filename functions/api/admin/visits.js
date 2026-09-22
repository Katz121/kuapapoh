// GET /api/admin/visits?days=30 · สรุปสถิติคนเข้าเว็บที่เราเก็บเอง
// ใช้กับหน้า stats.html · ต้องมี x-admin-token เหมือนหน้าออเดอร์
// v2: ตัดบอทออกจากตัวเลขทั้งหมด + เพิ่มตารางภาพแอดไหนขายได้ + สถานะ CAPI สด
import { json, bad, requireDb, adminOk } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get('days'));
  const since = thaiDayOffset(-days + 1);   // นับวันนี้รวมอยู่ในช่วงด้วย

  let rows;
  try {
    rows = await db.batch([
      // ยอดรวมแยกตามชนิดเหตุการณ์ · uniq = นับคนไม่นับครั้ง · ตัดบอทออก
      db.prepare(
        `SELECT event, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people, COALESCE(SUM(value),0) AS value
           FROM visits WHERE day >= ? AND is_bot = 0 GROUP BY event`
      ).bind(since),
      db.prepare(
        `SELECT day, event, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people
           FROM visits WHERE day >= ? AND is_bot = 0 GROUP BY day, event ORDER BY day ASC`
      ).bind(since),
      db.prepare(
        `SELECT path, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people
           FROM visits WHERE day >= ? AND is_bot = 0 AND event = 'PageView'
          GROUP BY path ORDER BY hits DESC LIMIT 12`
      ).bind(since),
      // มาจากไหน · ใส่ utm_source มาก็ใช้อันนั้น ไม่มีก็ดูโดเมนที่พามา
      db.prepare(
        `SELECT COALESCE(NULLIF(source,''), NULLIF(referrer,''), 'เข้าตรง') AS src,
                COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people
           FROM visits WHERE day >= ? AND is_bot = 0 GROUP BY src ORDER BY hits DESC LIMIT 12`
      ).bind(since),
      db.prepare(
        `SELECT COALESCE(ua,'ไม่ทราบ') AS ua, COUNT(DISTINCT visitor) AS people
           FROM visits WHERE day >= ? AND is_bot = 0 GROUP BY ua ORDER BY people DESC LIMIT 8`
      ).bind(since),
      // แถวที่ยังไม่ได้ส่งเข้า Meta · วันมี Pixel แล้วค่อยยิงย้อนได้เท่านี้
      db.prepare(
        `SELECT COUNT(*) AS pending, SUM(CASE WHEN fbclid IS NOT NULL THEN 1 ELSE 0 END) AS with_fbclid
           FROM visits WHERE sent_meta = 0 AND is_bot = 0`
      ),
      db.prepare('SELECT MIN(at) AS first_at, COUNT(*) AS all_rows FROM visits'),
      // ยอดขายแยกตามที่มา · คำถามที่ต้องตอบให้ได้คือ "เงินเข้ามาจากทางไหน"
      db.prepare(
        `SELECT COALESCE(NULLIF(source,''), NULLIF(referrer,''), 'เข้าตรง') AS src,
                COUNT(*) AS orders, COALESCE(SUM(value),0) AS revenue,
                SUM(CASE WHEN fbclid IS NOT NULL THEN 1 ELSE 0 END) AS from_ads
           FROM visits WHERE day >= ? AND event = 'Purchase' AND is_bot = 0
          GROUP BY src ORDER BY revenue DESC LIMIT 12`
      ).bind(since),
      // จำนวนบอทในช่วง
      db.prepare(
        'SELECT COUNT(*) AS bots FROM visits WHERE day >= ? AND is_bot = 1'
      ).bind(since),
      // ภาพแอดไหนขายได้ · ผูก content ระดับ session เพราะ utm_content ติดแค่ pageview แรก
      db.prepare(
        `WITH s AS (
           SELECT session, MAX(content) AS content
             FROM visits
            WHERE day >= ? AND is_bot = 0 AND content IS NOT NULL
            GROUP BY session
         )
         SELECT s.content,
                COUNT(DISTINCT CASE WHEN v.event = 'ViewContent' THEN v.visitor END) AS people_vc,
                COUNT(DISTINCT CASE WHEN v.event = 'InitiateCheckout' THEN v.visitor END) AS people_ic,
                SUM(CASE WHEN v.event = 'Purchase' THEN 1 ELSE 0 END) AS orders,
                COALESCE(SUM(CASE WHEN v.event = 'Purchase' THEN v.value ELSE 0 END), 0) AS revenue
           FROM s JOIN visits v ON v.session = s.session AND v.day >= ? AND v.is_bot = 0
          GROUP BY s.content
          ORDER BY revenue DESC, orders DESC`
      ).bind(since, since),
      // สถานะ CAPI สด
      db.prepare(
        `SELECT meta_status, COUNT(*) AS cnt
           FROM visits WHERE day >= ? AND meta_status IS NOT NULL
          GROUP BY meta_status`
      ).bind(since),
    ]);
  } catch (error) {
    const message = String(error && error.message || error);
    if (/no such table/i.test(message)) {
      return bad('ยังไม่ได้สร้างตาราง visits · รัน migrations/0004_visits.sql ก่อน', 503);
    }
    return bad('อ่านสถิติไม่สำเร็จ: ' + message.slice(0, 200), 500);
  }

  const totals = {};
  for (const row of rows[0].results || []) {
    totals[row.event] = { hits: row.hits, people: row.people, value: row.value };
  }
  const pending = (rows[5].results || [])[0] || {};
  const overall = (rows[6].results || [])[0] || {};
  const botsRow = (rows[8].results || [])[0] || {};

  // สถานะ CAPI สด: นับ ok กับ err
  let capiOk = 0;
  let capiErr = 0;
  for (const r of rows[10].results || []) {
    if (r.meta_status === 'ok') capiOk += r.cnt;
    else if (r.meta_status && r.meta_status.startsWith('err:')) capiErr += r.cnt;
  }

  return json({
    ok: true,
    days,
    since,
    totals,
    funnel: buildFunnel(totals),
    byDay: rows[1].results || [],
    topPages: rows[2].results || [],
    topSources: rows[3].results || [],
    browsers: rows[4].results || [],
    revenueBySource: rows[7].results || [],
    adCreatives: rows[9].results || [],
    meta: {
      pending: pending.pending || 0,
      withFbclid: pending.with_fbclid || 0,
      firstAt: overall.first_at || null,
      allRows: overall.all_rows || 0,
      bots: botsRow.bots || 0,
      capiOk,
      capiErr,
    },
  });
}

const methodNotAllowed = () => bad('ใช้ได้เฉพาะการอ่านข้อมูล (GET)', 405);
export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;

/* ทางเดินของลูกค้า · เปิดเว็บ → ดูเสื้อ → เลือกไซส์ → เริ่มกรอก → สั่งจริง
   อัตราผ่านคิดจากจำนวนคน ไม่ใช่จำนวนครั้ง คนเดียวรีเฟรชสิบรอบไม่ควรทำตัวเลขเพี้ยน */
function buildFunnel(totals) {
  const steps = [
    ['PageView', 'เปิดเว็บ'],
    ['ViewContent', 'ดูหน้าเสื้อ'],
    ['AddToCart', 'เลือกไซส์'],
    ['InitiateCheckout', 'เริ่มกรอกฟอร์ม'],
    ['Purchase', 'สั่งสำเร็จ'],
  ];
  const first = (totals.PageView && totals.PageView.people) || 0;
  return steps.map(([event, label]) => {
    const people = (totals[event] && totals[event].people) || 0;
    return {
      event,
      label,
      people,
      hits: (totals[event] && totals[event].hits) || 0,
      rate: first ? Math.round((people / first) * 1000) / 10 : 0,
    };
  });
}

function clampDays(value) {
  const number = Number.parseInt(value || '30', 10);
  if (!Number.isFinite(number)) return 30;
  return Math.min(Math.max(number, 1), 365);
}

function thaiDayOffset(offsetDays) {
  const now = Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
  return new Date(now).toISOString().slice(0, 10);
}
