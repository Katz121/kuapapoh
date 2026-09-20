// GET /api/admin/slip?id=KP-XXXXX · คืนรูปสลิปของออเดอร์นั้น
// รหัสผู้ดูแลส่งทาง header `x-admin-token` เท่านั้น (ใส่ใน URL จะไปติดใน log)
import { bad, requireDb, adminOk, clean } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  const id = clean(new URL(request.url).searchParams.get('id'), 20);
  if (!id) return bad('ไม่พบเลขออเดอร์');

  const row = await db
    .prepare('SELECT mime, data FROM preorder_slips WHERE order_id = ?')
    .bind(id)
    .first();
  if (!row) return bad('ออเดอร์นี้ยังไม่ได้แนบสลิป', 404);

  const binary = Uint8Array.from(atob(row.data), (char) => char.charCodeAt(0));
  return new Response(binary, {
    headers: { 'content-type': row.mime, 'cache-control': 'private, no-store' },
  });
}

const methodNotAllowed = () => bad('ใช้ได้เฉพาะการอ่าน (GET)', 405);
export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
