// GET  /api/admin/preorders?token=...            · รายการออเดอร์ + สรุปยอด
// POST /api/admin/preorders  {id, status, adminNote} · อัปเดตสถานะ
import { json, bad, requireDb, adminOk, clean } from '../_shared.js';

const STATUSES = ['new', 'paid', 'producing', 'ready', 'done', 'cancelled'];

export async function onRequestGet({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const limit = Math.min(500, Math.max(1, Number.parseInt(url.searchParams.get('limit'), 10) || 200));

  const query = STATUSES.includes(status)
    ? db.prepare('SELECT * FROM preorders WHERE status = ? ORDER BY created_at DESC LIMIT ?').bind(status, limit)
    : db.prepare('SELECT * FROM preorders ORDER BY created_at DESC LIMIT ?').bind(limit);

  const { results } = await query.all();
  const orders = (results || []).map((row) => ({
    ...row,
    items: safeParse(row.items),
    has_slip: !!row.has_slip,
  }));

  // สรุปไซส์ไว้สั่งโรงงานรอบเดียว (ไม่นับที่ยกเลิก)
  const bySize = {};
  let shirts = 0;
  let revenue = 0;
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    shirts += order.qty;
    revenue += order.total;
    for (const item of order.items) bySize[item.size] = (bySize[item.size] || 0) + item.qty;
  }

  return json({ ok: true, orders, summary: { orders: orders.length, shirts, revenue, bySize } });
}

export async function onRequestPost({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return bad('ข้อมูลที่ส่งมาไม่ถูกต้อง');
  }

  const id = clean(body.id, 20);
  const status = clean(body.status, 20);
  if (!id) return bad('ไม่พบเลขออเดอร์');
  if (!STATUSES.includes(status)) return bad('สถานะไม่ถูกต้อง');
  const adminNote = clean(body.adminNote, 300);

  const result = await db
    .prepare('UPDATE preorders SET status = ?, admin_note = ? WHERE id = ?')
    .bind(status, adminNote, id)
    .run();

  if (!result.meta || !result.meta.changes) return bad('ไม่พบออเดอร์นี้', 404);
  return json({ ok: true, id, status });
}

const methodNotAllowed = () => bad('รองรับเฉพาะ GET และ POST', 405);
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
