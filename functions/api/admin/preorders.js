// GET  /api/admin/preorders?q=&status=      · รายการออเดอร์ + สรุปยอด (ค้นหาได้)
// POST /api/admin/preorders {id, status, adminNote}  · อัปเดตสถานะ (+ ดันขึ้นชีต)
// POST /api/admin/preorders {id, action:'resync'}    · ซิงก์แถวที่ตกหล่นขึ้นชีตใหม่
import { json, bad, requireDb, adminOk, clean, logEvent, payStatus } from '../_shared.js';
import { pushToSheet, sheetsReady } from '../_sheets.js';
import { verifySlip, slipCheckReady } from '../_slipcheck.js';

const STATUSES = ['new', 'paid', 'producing', 'ready', 'done', 'cancelled'];
const STATUS_TH = {
  new: 'ใหม่', paid: 'ยืนยันยอด', producing: 'กำลังผลิต',
  ready: 'ของพร้อม', done: 'ปิดแล้ว', cancelled: 'ยกเลิก',
};

export async function onRequestGet({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const search = clean(url.searchParams.get('q'), 60);
  const limit = Math.min(500, Math.max(1, Number.parseInt(url.searchParams.get('limit'), 10) || 200));

  // ค้นหาย้อนหลังจากเลขออเดอร์ ชื่อ เบอร์ หรือเลขอ้างอิงสลิป
  const where = [];
  const binds = [];
  if (STATUSES.includes(status)) {
    where.push('status = ?');
    binds.push(status);
  }
  if (search) {
    where.push('(id LIKE ?1 OR name LIKE ?1 OR phone LIKE ?1 OR slip_ref LIKE ?1)'.replace(/\?1/g, '?'));
    const like = `%${search}%`;
    binds.push(like, like, like, like);
  }
  const sql = `SELECT * FROM preorders${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`;
  binds.push(limit);

  const { results } = await db.prepare(sql).bind(...binds).all();
  const orders = (results || []).map((row) => ({
    ...row,
    items: safeParse(row.items),
    has_slip: !!row.has_slip,
    sheet_ok: !!row.sheet_row,
    pay: payStatus(row),
  }));

  // สรุปยอดต้องนับจากทั้งฐานข้อมูล ไม่ใช่เฉพาะแถวที่แสดงในหน้านี้
  // ไม่งั้นพอออเดอร์เกิน limit ตัวเลขสั่งโรงงานจะขาดโดยไม่มีใครรู้
  const { results: allRows } = await db
    .prepare("SELECT items, qty, total, status, sheet_row FROM preorders")
    .all();
  const bySize = {};
  let shirts = 0;
  let revenue = 0;
  let unsynced = 0;
  for (const row of allRows || []) {
    if (!row.sheet_row) unsynced += 1;
    if (row.status === 'cancelled') continue;
    shirts += row.qty;
    revenue += row.total;
    for (const item of safeParse(row.items)) bySize[item.size] = (bySize[item.size] || 0) + item.qty;
  }

  return json({
    ok: true,
    orders,
    sheets: sheetsReady(env),
    summary: { orders: (allRows || []).length, shown: orders.length, shirts, revenue, bySize, unsynced },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
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
  if (!id) return bad('ไม่พบเลขออเดอร์');

  const current = await db.prepare('SELECT * FROM preorders WHERE id = ?').bind(id).first();
  if (!current) return bad('ไม่พบออเดอร์นี้', 404);

  // กดซิงก์ขึ้นชีตใหม่สำหรับแถวที่ตกหล่นตอนชีตล่ม
  if (body.action === 'resync') {
    const result = await pushToSheet(env, { ...current, items: safeParse(current.items) }, 'update');
    if (!result.ok) {
      await db.prepare('UPDATE preorders SET sheet_error = ? WHERE id = ?').bind(result.error, id).run();
      await logEvent(db, id, 'sheet_failed', result.error, 'admin');
      return bad(result.error, 502);
    }
    await db.prepare('UPDATE preorders SET sheet_row = ?, sheet_error = NULL WHERE id = ?').bind(result.row, id).run();
    await logEvent(db, id, 'sheet_synced', `แถวที่ ${result.row}`, 'admin');
    return json({ ok: true, id, row: result.row });
  }

  // ตรวจสลิปกับธนาคารอีกรอบ · ใช้กับออเดอร์ที่ตรวจพลาดหรือยังไม่ได้ตรวจ
  if (body.action === 'recheck') {
    if (!slipCheckReady(env)) return bad('ยังไม่ได้ตั้งค่าคีย์ตรวจสลิป', 503);
    if (!current.slip_ref) return bad('ออเดอร์นี้ไม่มีเลขอ้างอิงในสลิป ตรวจอัตโนมัติไม่ได้', 400);

    const verdict = await verifySlip(env, { payload: current.slip_ref, amount: current.total });
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE preorders SET slip_checked = ?, slip_verified = ?, slip_note = ?,
              slip_amount = ?, slip_sender = ?, slip_trans_ref = ? WHERE id = ?`
    ).bind(
      now,
      verdict.verified === true ? 1 : verdict.verified === false ? 0 : null,
      verdict.note || '', verdict.amount || null, verdict.sender || '', verdict.transRef || '', id
    ).run();
    await logEvent(db, id, verdict.verified ? 'slip_verified' : 'slip_rejected', verdict.note, 'admin');

    // ตรวจผ่านแล้วยังอยู่สถานะ "ใหม่" ให้ขยับเป็นยืนยันยอดให้เลย
    if (verdict.verified === true && current.status === 'new') {
      await db.prepare("UPDATE preorders SET status = 'paid' WHERE id = ?").bind(id).run();
    }
    const fresh = await db.prepare('SELECT * FROM preorders WHERE id = ?').bind(id).first();
    if (sheetsReady(env)) {
      await pushToSheet(env, { ...fresh, items: safeParse(fresh.items) }, 'update');
    }
    return json({ ok: true, id, verified: verdict.verified, note: verdict.note, amount: verdict.amount || null });
  }

  // ลบออเดอร์ · ลบจากฐานข้อมูลก่อน แล้วค่อยลบแถวในชีตตาม
  if (body.action === 'delete') {
    // ลบแถวในชีตก่อน · ถ้าชีตพลาดแล้วเราลบ D1 ไปแล้ว จะเหลือแถวผีในชีตที่ซ่อมไม่ได้
    if (sheetsReady(env)) {
      const sheetResult = await pushToSheet(env, { ...current, items: safeParse(current.items) }, 'delete');
      if (!sheetResult.ok) {
        await db.prepare('UPDATE preorders SET sheet_error = ? WHERE id = ?')
          .bind(`ลบแถวในชีตไม่สำเร็จ: ${sheetResult.error}`, id).run();
        return bad(`ลบแถวในชีตไม่สำเร็จ จึงยังไม่ลบออเดอร์: ${sheetResult.error}`, 502);
      }
    }
    await db.batch([
      db.prepare('DELETE FROM preorder_slips WHERE order_id = ?').bind(id),
      db.prepare('DELETE FROM preorder_events WHERE order_id = ?').bind(id),
      db.prepare('DELETE FROM preorders WHERE id = ?').bind(id),
    ]);
    return json({ ok: true, id, deleted: true });
  }

  const status = clean(body.status, 20);
  if (!STATUSES.includes(status)) return bad('สถานะไม่ถูกต้อง');
  const adminNote = clean(body.adminNote, 300);

  await db
    .prepare('UPDATE preorders SET status = ?, admin_note = ? WHERE id = ?')
    .bind(status, adminNote || current.admin_note || '', id)
    .run();

  const background = (async () => {
    if (status !== current.status) {
      await logEvent(db, id, 'status', `${STATUS_TH[current.status] || current.status} → ${STATUS_TH[status] || status}`, 'admin');
    }
    if (adminNote && adminNote !== current.admin_note) {
      await logEvent(db, id, 'note', adminNote, 'admin');
    }
    if (sheetsReady(env)) {
      const updated = { ...current, items: safeParse(current.items), status, admin_note: adminNote || current.admin_note };
      const result = await pushToSheet(env, updated, 'update');
      if (result.ok) {
        await db.prepare('UPDATE preorders SET sheet_row = ?, sheet_error = NULL WHERE id = ?').bind(result.row, id).run();
      } else {
        await db.prepare('UPDATE preorders SET sheet_error = ? WHERE id = ?').bind(result.error, id).run();
      }
    }
  })();
  if (context.waitUntil) context.waitUntil(background); else await background;

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
