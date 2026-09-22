// GET /api/admin/visits-export?days=90 · ดาวน์โหลดสถิติดิบเป็นไฟล์ CSV
// มีไว้เพราะข้อมูลที่ดึงออกมาไม่ได้ เท่ากับไม่มี · เปิดใน Excel / Google Sheet ได้เลย
import { bad, adminOk, requireDb } from '../_shared.js';

const COLUMNS = [
  ['at', 'เวลา (UTC)'],
  ['day', 'วัน (ไทย)'],
  ['event', 'เหตุการณ์'],
  ['event_id', 'เลขกำกับรายการ'],
  ['visitor', 'ไอดีผู้ชม'],
  ['session', 'ไอดีรอบเข้าเว็บ'],
  ['path', 'หน้า'],
  ['referrer', 'มาจากโดเมน'],
  ['source', 'utm_source'],
  ['medium', 'utm_medium'],
  ['campaign', 'utm_campaign'],
  ['content', 'utm_content'],
  ['fbclid', 'fbclid'],
  ['fbp', 'fbp'],
  ['fbc', 'fbc'],
  ['value', 'ยอดเงิน'],
  ['currency', 'สกุลเงิน'],
  ['order_id', 'เลขออเดอร์'],
  ['country', 'ประเทศ'],
  ['ua', 'แอป/เบราว์เซอร์'],
  ['is_bot', 'บอท'],
  ['bot_reason', 'เหตุผลบอท'],
  ['asn', 'ASN'],
  ['sent_meta', 'ส่งเข้า Meta แล้ว'],
  ['meta_status', 'สถานะ CAPI'],
];

export async function onRequestGet({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number.parseInt(url.searchParams.get('days') || '90', 10) || 90, 1), 365);
  const since = new Date(Date.now() + 7 * 3600 * 1000 - (days - 1) * 86400 * 1000)
    .toISOString().slice(0, 10);

  let results;
  try {
    // ไม่ส่ง ip_hash ออกไปในไฟล์ · ไม่มีประโยชน์กับการวิเคราะห์ และไม่ควรหลุดออกจากระบบ
    ({ results } = await db
      .prepare(`SELECT ${COLUMNS.map(([key]) => key).join(', ')} FROM visits
                 WHERE day >= ? ORDER BY id ASC LIMIT 50000`)
      .bind(since)
      .all());
  } catch (error) {
    return bad('ดึงข้อมูลไม่สำเร็จ: ' + String(error && error.message || error).slice(0, 200), 500);
  }

  const lines = [COLUMNS.map(([, label]) => label).join(',')];
  for (const row of results || []) {
    lines.push(COLUMNS.map(([key]) => csvCell(row[key])).join(','));
  }

  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return new Response('\ufeff' + lines.join('\r\n'), {   // BOM · ไม่ใส่แล้วภาษาไทยเพี้ยนใน Excel
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kuapapoh-stats-${today}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

const methodNotAllowed = () => bad('ใช้ได้เฉพาะการอ่านข้อมูล (GET)', 405);
export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;

/* ค่าที่ขึ้นต้นด้วย = + - @ แท็บ หรือขึ้นบรรทัดใหม่ Excel จะอ่านเป็นสูตร
   ใส่ ' นำหน้าไว้ ปลอดภัยกว่าเชื่อว่าข้อมูลที่คนอื่นส่งมาจะไม่มีอะไรแปลก */
function csvCell(value) {
  let text = value == null ? '' : String(value);
  const first = text.charCodeAt(0);
  if (first === 61 || first === 43 || first === 45 || first === 64 || first === 9 || first === 13) {
    text = "'" + text;
  }
  return '"' + text.replace(/"/g, '""') + '"';
}
