// GET /api/admin/events?id=KP-XXXXX · ประวัติทั้งหมดของออเดอร์นั้น ไว้ตรวจย้อนหลัง
import { json, bad, requireDb, adminOk, clean } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  const id = clean(new URL(request.url).searchParams.get('id'), 20);
  if (!id) return bad('ไม่พบเลขออเดอร์');

  const { results } = await db
    .prepare('SELECT at, kind, detail, actor FROM preorder_events WHERE order_id = ? ORDER BY at ASC, id ASC LIMIT 200')
    .bind(id)
    .all();

  return json({ ok: true, id, events: results || [] });
}

const methodNotAllowed = () => bad('ใช้ได้เฉพาะการอ่าน (GET)', 405);
export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
