// GET/POST/DELETE /api/admin/markers · เส้นกำกับเหตุการณ์บนกราฟ stats
// วางไฟล์นี้ที่ functions/api/admin/markers.js · ทุกเมธอดต้องมี x-admin-token
import { json, bad, requireDb, adminOk } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);
  try {
    const res = await db
      .prepare('SELECT id, day, label FROM stat_markers ORDER BY day ASC, id ASC')
      .all();
    return json({ ok: true, markers: res.results || [] });
  } catch (e) {
    // ยังไม่รัน migration ตารางไม่มี ต้องไม่ล้ม คืนว่าง
    if (/no such table/i.test(String((e && e.message) || e))) {
      return json({ ok: true, markers: [] });
    }
    return bad('อ่าน markers ไม่สำเร็จ', 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return bad('ส่ง JSON ไม่ถูก ต้องมี day กับ label', 400);
  }
  const day = String((body && body.day) || '').trim();
  const label = String((body && body.label) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isRealDate(day)) {
    return bad('วันต้องเป็นรูปแบบ YYYY-MM-DD เช่น 2026-09-23', 400);
  }
  if (!label) return bad('ใส่ชื่อเหตุการณ์สั้นๆ ด้วย', 400);
  if ([...label].length > 40) return bad('ชื่อเหตุการณ์ยาวเกิน 40 ตัวอักษร', 400);
  try {
    const now = new Date().toISOString();
    const res = await db
      .prepare('INSERT INTO stat_markers (day, label, created_at) VALUES (?, ?, ?)')
      .bind(day, label, now)
      .run();
    const id = res && res.meta && res.meta.last_row_id != null ? res.meta.last_row_id : null;
    return json({ ok: true, id, day, label });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) {
      return bad('ยังไม่ได้สร้างตาราง stat_markers รัน migrations/0006_stats.sql ก่อน', 503);
    }
    return bad('บันทึก marker ไม่สำเร็จ', 500);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);
  const url = new URL(request.url);
  const id = Number.parseInt(url.searchParams.get('id') || '', 10);
  if (!Number.isInteger(id) || id <= 0) return bad('ต้องระบุ id เช่น DELETE ?id=3', 400);
  try {
    await db.prepare('DELETE FROM stat_markers WHERE id = ?').bind(id).run();
    return json({ ok: true, id });
  } catch (e) {
    if (/no such table/i.test(String((e && e.message) || e))) {
      return json({ ok: true, id, note: 'no-table' });
    }
    return bad('ลบ marker ไม่สำเร็จ', 500);
  }
}

export const onRequestPut = () => bad('ใช้ได้เฉพาะ GET POST DELETE', 405);
export const onRequestPatch = () => bad('ใช้ได้เฉพาะ GET POST DELETE', 405);

function isRealDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
