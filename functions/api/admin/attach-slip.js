// POST /api/admin/attach-slip · ทีมงานแนบสลิปให้ออเดอร์เอง (ลูกค้าส่งสลิปมาทาง LINE / Facebook)
// body: { id: "KP-XXXXX", slip: "data:image/webp;base64,...", slipRef?: "<ข้อความในคิวอาร์>", slipHash?: "<sha256>" }
// แนบซ้ำได้ = เปลี่ยนรูปสลิปของออเดอร์นั้น · มีคิวอาร์ก็ตรวจกับธนาคารต่อให้เลย
import {
  json, bad, requireDb, adminOk, clean, logEvent, MAX_SLIP_BYTES, MAX_BODY_BYTES,
} from '../_shared.js';
import { pushToSheet, sheetsReady } from '../_sheets.js';
import { verifySlip, slipCheckReady } from '../_slipcheck.js';

export async function onRequestPost({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  const declared = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return bad('ไฟล์สลิปใหญ่เกินไป ลองรูปอื่น');
  }

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

  const slipRaw = typeof body.slip === 'string' ? body.slip : '';
  if (!slipRaw) return bad('ยังไม่ได้เลือกรูปสลิป');
  if (slipRaw.length > MAX_SLIP_BYTES * 2) return bad('ไฟล์สลิปใหญ่เกินไป ลองรูปอื่น');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(slipRaw);
  if (!match) return bad('ไฟล์สลิปต้องเป็นรูปภาพ (jpg, png หรือ webp)');
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > MAX_SLIP_BYTES) return bad('ไฟล์สลิปใหญ่เกินไป ลองรูปอื่น');

  // สลิปใบเดียวกันห้ามไปผูกกับออเดอร์อื่นซ้ำ
  const slipRef = clean(body.slipRef, 200);
  const slipHash = /^[a-f0-9]{64}$/.test(String(body.slipHash || '')) ? body.slipHash : '';
  if (slipRef || slipHash) {
    const used = await db
      .prepare(
        `SELECT id FROM preorders
          WHERE id != ? AND ((slip_ref IS NOT NULL AND slip_ref = ?) OR (slip_hash IS NOT NULL AND slip_hash = ?))`
      )
      .bind(id, slipRef || '\u0000', slipHash || '\u0000')
      .first();
    if (used) return bad(`สลิปใบนี้ถูกใช้กับออเดอร์ ${used.id} ไปแล้ว`, 409);
  }

  const now = new Date().toISOString();
  const replacing = !!current.has_slip;
  // สลิปใหม่ = ผลตรวจของใบเก่าใช้ไม่ได้แล้ว ล้างทิ้งก่อน
  await db.batch([
    db.prepare(
      `INSERT INTO preorder_slips (order_id, mime, data, bytes, uploaded_at) VALUES (?,?,?,?,?)
       ON CONFLICT(order_id) DO UPDATE SET mime = excluded.mime, data = excluded.data,
         bytes = excluded.bytes, uploaded_at = excluded.uploaded_at`
    ).bind(id, match[1], match[2], bytes, now),
    db.prepare(
      `UPDATE preorders SET has_slip = 1, slip_ref = ?, slip_hash = ?,
              slip_checked = NULL, slip_verified = NULL, slip_note = NULL,
              slip_amount = NULL, slip_sender = NULL, slip_trans_ref = NULL
        WHERE id = ?`
    ).bind(slipRef || null, slipHash || null, id),
  ]);
  await logEvent(
    db, id, 'slip_attached',
    `${replacing ? 'ทีมงานเปลี่ยนสลิป' : 'ทีมงานแนบสลิปให้'} · ${slipRef ? 'อ่านเลขอ้างอิงจากสลิปได้' : 'ไม่มีเลขอ้างอิงในสลิป'}`,
    'admin'
  );

  let verdict = null;
  if (slipRef && slipCheckReady(env)) {
    verdict = await verifySlip(env, { payload: slipRef, amount: current.total });
    await db.prepare(
      `UPDATE preorders SET slip_checked = ?, slip_verified = ?, slip_note = ?,
              slip_amount = ?, slip_sender = ?, slip_trans_ref = ? WHERE id = ?`
    ).bind(
      new Date().toISOString(),
      verdict.verified === true ? 1 : verdict.verified === false ? 0 : null,
      verdict.note || '', verdict.amount || null, verdict.sender || '', verdict.transRef || '', id
    ).run();
    if (verdict.verified === true) {
      await logEvent(db, id, 'slip_verified', verdict.note, 'admin');
      if (current.status === 'new') {
        await db.prepare("UPDATE preorders SET status = 'paid' WHERE id = ?").bind(id).run();
        await logEvent(db, id, 'status', 'ใหม่ → ยืนยันยอด (ระบบตรวจสลิปแล้ว)', 'system');
      }
    } else if (verdict.verified === false) {
      await logEvent(db, id, 'slip_rejected', verdict.note, 'admin');
    } else if (verdict.note) {
      await logEvent(db, id, 'slip_check_failed', verdict.note, 'admin');
    }
  }

  if (sheetsReady(env)) {
    const fresh = await db.prepare('SELECT * FROM preorders WHERE id = ?').bind(id).first();
    let items = [];
    try { items = JSON.parse(fresh.items || '[]'); } catch { /* ชีตได้ช่องรายการว่างดีกว่าล้ม */ }
    await pushToSheet(env, { ...fresh, items }, 'update');
  }

  return json({
    ok: true,
    id,
    replaced: replacing,
    hasRef: !!slipRef,
    verified: verdict ? verdict.verified : null,
    note: verdict ? verdict.note : '',
  });
}

const methodNotAllowed = () => bad('ใช้ได้เฉพาะการส่งข้อมูล (POST)', 405);
export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
