// GET /api/stock · สต็อกกระเป๋าคงเหลือให้หน้า /preorder/ โชว์เลข "เหลือ N ใบ"
// ไม่มี DB ผูกไว้ = คืนเลขเต็มสต็อกพร้อม offline:true หน้าเว็บจะซ่อนตัวเลขเอง
import { BAG_CODES, BAG_STOCK, json, bad, requireDb, reservedBags } from './_shared.js';

export async function onRequestGet({ env }) {
  const db = requireDb(env);
  if (!db) {
    return json({ ok: true, offline: true, bags: fullStock() });
  }
  let reserved;
  try {
    reserved = await reservedBags(db);
  } catch {
    return bad('ตรวจสต็อกไม่สำเร็จ กรุณาลองใหม่', 500);
  }
  const bags = {};
  for (const code of BAG_CODES) {
    bags[code] = {
      stock: BAG_STOCK[code],
      left: Math.max(0, BAG_STOCK[code] - (reserved[code] || 0)),
    };
  }
  return json({ ok: true, bags });
}

function fullStock() {
  const bags = {};
  for (const code of BAG_CODES) {
    bags[code] = { stock: BAG_STOCK[code], left: BAG_STOCK[code] };
  }
  return bags;
}

// method อื่นตอบให้ชัด · ห้าม export onRequest เพราะมันจะกิน GET ไปด้วย
const methodNotAllowed = () => bad('ใช้ได้เฉพาะการดูสต็อก (GET)', 405);
export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
