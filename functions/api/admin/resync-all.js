// POST /api/admin/resync-all · เขียนออเดอร์ทั้งหมดจากฐานข้อมูลขึ้นชีตใหม่
// ใช้ตอนแถวในชีตหาย โดนลบ หรือโดนแก้จนไม่ตรงกับของจริง · ฐานข้อมูลคือของจริงเสมอ
import { json, bad, requireDb, adminOk } from '../_shared.js';
import { pushToSheet, sheetsReady } from '../_sheets.js';

export async function onRequestPost({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  if (!sheetsReady(env)) return bad('ยังไม่ได้ตั้งค่า Google Sheet', 503);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  // เรียงจากเก่าไปใหม่ เพื่อให้ลำดับแถวในชีตตรงกับลำดับที่ลูกค้าสั่งจริง
  const { results } = await db
    .prepare('SELECT * FROM preorders ORDER BY created_at ASC LIMIT 500')
    .all();

  let synced = 0;
  const failed = [];
  for (const row of results || []) {
    const order = { ...row, items: safeParse(row.items) };
    const result = await pushToSheet(env, order, 'update');   // update = มีแล้วทับ ไม่มีก็สร้างให้
    if (result.ok) {
      synced += 1;
      await db.prepare('UPDATE preorders SET sheet_row = ?, sheet_error = NULL WHERE id = ?')
        .bind(result.row, row.id).run();
    } else {
      failed.push({ id: row.id, error: result.error });
      await db.prepare('UPDATE preorders SET sheet_error = ? WHERE id = ?')
        .bind(result.error, row.id).run();
    }
  }

  return json({ ok: true, total: (results || []).length, synced, failed });
}

const methodNotAllowed = () => bad('ใช้ได้เฉพาะการส่งข้อมูล (POST)', 405);
export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;

function safeParse(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
