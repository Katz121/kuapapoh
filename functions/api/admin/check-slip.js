// POST /api/admin/check-slip · ตรวจสลิปใบไหนก็ได้กับธนาคาร (ใช้กับออเดอร์ที่มาทาง LINE/หน้าร้าน)
// body: { payload: "<ข้อความในคิวอาร์ของสลิป>", amount?: 350, orderId?: "KP-XXXXX" }
import { json, bad, requireDb, adminOk, clean } from '../_shared.js';
import { verifySlip, slipCheckReady } from '../_slipcheck.js';

export async function onRequestPost({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  if (!slipCheckReady(env)) return bad('ยังไม่ได้ตั้งค่าคีย์ตรวจสลิป (SLIP_VERIFY_KEY)', 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return bad('ข้อมูลที่ส่งมาไม่ถูกต้อง');
  }

  const payload = clean(body.payload, 300);
  if (!payload) return bad('ไม่พบคิวอาร์ในสลิป · ลองถ่ายใหม่ให้เห็นคิวอาร์ชัดๆ');

  const amount = Number(body.amount) > 0 ? Number(body.amount) : null;
  const verdict = await verifySlip(env, { payload, amount });

  // สลิปใบนี้เคยถูกใช้กับออเดอร์ในระบบไปแล้วหรือยัง
  let usedBy = null;
  const db = requireDb(env);
  if (db) {
    try {
      const row = await db
        .prepare('SELECT id, name, total, status FROM preorders WHERE slip_ref = ? OR slip_trans_ref = ?')
        .bind(payload, verdict.transRef || '\u0000')
        .first();
      if (row) usedBy = row;
    } catch {
      /* ตารางยังไม่พร้อมก็ข้ามไป ไม่ควรทำให้ผลตรวจหาย */
    }
  }

  return json({
    ok: true,
    checked: verdict.checked,
    verified: verdict.verified,
    note: verdict.note,
    amount: verdict.amount || null,
    amountMatch: verdict.amountMatch,
    sender: verdict.sender || '',
    receiver: verdict.receiver || '',
    receiverAccount: verdict.receiverAccount || '',
    receiverMatch: verdict.receiverMatch,
    date: verdict.date || '',
    transRef: verdict.transRef || '',
    usedBy,
  });
}

const methodNotAllowed = () => bad('ใช้ได้เฉพาะการส่งข้อมูล (POST)', 405);
export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
