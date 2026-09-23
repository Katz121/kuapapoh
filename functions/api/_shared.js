// เครื่องมือร่วมของ API พรีออเดอร์ · Cloudflare Pages Functions (vanilla JS)

export const PRICE = 350;            // ราคาเสื้อต่อตัว (ทุกไซส์ รวมไซส์เด็ก)
export const SHIPPING = 50;          // ค่าส่งไปรษณีย์ต่อ 1 ออเดอร์
export const SIZES = ['S', 'M', 'L', 'XL', '2XL', 'KID-S', 'KID-M', 'KID-L'];
export const BAG_PRICE = 250;        // ราคากระเป๋าผ้าต่อใบ (ทุกสี)
export const BAG_CODES = ['BAG-YELLOW', 'BAG-RED'];
export const BAG_STOCK = { 'BAG-YELLOW': 25, 'BAG-RED': 25 };
export const BAG_TH = { 'BAG-YELLOW': 'กระเป๋าเหลือง', 'BAG-RED': 'กระเป๋าแดง' };
export const BAG_COLOR_TH = { 'BAG-YELLOW': 'กระเป๋าสีเหลือง', 'BAG-RED': 'กระเป๋าสีแดง' };
// รหัสสินค้าที่ยอมรับทั้งหมด · SIZES เก็บไว้เฉพาะเสื้อเหมือนเดิม หลังบ้านจะได้นับยอดสั่งโรงงานไม่ปนกระเป๋า
export const ITEM_CODES = [...SIZES, ...BAG_CODES];

// ราคาต่อชิ้นคิดที่ server เสมอ · กระเป๋า 250 บาท นอกนั้นคือเสื้อ 350 บาท
export function unitPrice(code) {
  return BAG_CODES.includes(code) ? BAG_PRICE : PRICE;
}

export function isBagCode(code) {
  return BAG_CODES.includes(code);
}

// นับกระเป๋าแยกสีจาก items ที่ parse เป็นอาร์เรย์แล้ว · ใช้ตรวจสต็อกทั้งตอนรับออเดอร์และตอนสรุปยอด
export function countBags(items) {
  const out = { 'BAG-YELLOW': 0, 'BAG-RED': 0 };
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || !isBagCode(item.size)) continue;
    const qty = Number.parseInt(item.qty, 10);
    if (Number.isFinite(qty) && qty > 0) out[item.size] += qty;
  }
  return out;
}

// ยอดกระเป๋าที่ถูกจองแล้ว = ผลรวมทุกออเดอร์ที่ยังไม่ยกเลิก
// ข้อจำกัด: อ่านแล้วค่อยเขียนโดยไม่มีล็อก ถ้าลูกค้ากดพร้อมกันในเสี้ยววินาทีเดียวกันอาจเกินสต็อกได้นิดหน่อย
// ยอดกระเป๋าน้อย (สีละ 25) ทีมงานตรวจทานเองได้ จึงยอมรับได้ ไม่ทำล็อกซับซ้อน
export async function reservedBags(db) {
  const out = { 'BAG-YELLOW': 0, 'BAG-RED': 0 };
  const { results } = await db
    .prepare("SELECT items FROM preorders WHERE status != 'cancelled'")
    .all();
  for (const row of results || []) {
    try {
      const parsed = JSON.parse(row.items);
      if (!Array.isArray(parsed)) continue;
      const counted = countBags(parsed);
      out['BAG-YELLOW'] += counted['BAG-YELLOW'];
      out['BAG-RED'] += counted['BAG-RED'];
    } catch {
      // แถว items เสียข้ามไป ทีมงานเห็นจากยอดรวมอยู่แล้ว
    }
  }
  return out;
}
export const MAX_QTY_PER_LINE = 20;
export const MAX_QTY_PER_ORDER = 50;          // สั่งเกินนี้ให้ทักทีมงานตรงๆ จะได้คุยเรื่องรอบผลิต
export const MAX_BODY_BYTES = 900 * 1024;     // ตัดตั้งแต่ก่อน parse กัน payload ยักษ์กิน CPU
export const MAX_SLIP_BYTES = 400 * 1024;   // สลิปหลังบีบอัดฝั่งเบราว์เซอร์

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });
}

export function bad(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

// ไม่มี D1 ผูกไว้ = ตอบให้ชัด หน้าเว็บจะสลับไปโหมด LINE เองโดยไม่พัง
export function requireDb(env) {
  return env && env.DB ? env.DB : null;
}

// ไม่เก็บ IP ตรงๆ · เก็บแค่ลายนิ้วมือสั้นๆ ไว้นับว่ายิงรัวมาจากที่เดียวกันไหม
export async function ipFingerprint(request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kuapapoh:${ip}`));
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// สถานะการโอนแบบอ่านปราดเดียวรู้เรื่อง · ใช้ทั้งหน้าแอดมินและ Google Sheet
// อ่านจากผลตรวจสลิปกับธนาคาร ไม่ใช่จากสถานะที่ทีมงานกดเอง
export function payStatus(order) {
  const hasSlip = !!(order.has_slip || order.hasSlip);
  const verified = order.slip_verified;
  const paid = Number(order.slip_amount || 0);
  const total = Number(order.total || 0);
  const detail = paid ? `โอนมา ${paid} / ต้องได้ ${total} บาท` : '';

  if (!hasSlip) return { code: 'none', label: 'ยังไม่โอน', detail: `ต้องได้ ${total} บาท`, paid: 0, total };
  if (verified === 1) {
    return { code: 'ok', label: 'โอนครบ', detail: detail || `ครบ ${total} บาท`, paid, total };
  }
  if (verified === 0) {
    if (paid && total && paid < total) {
      return { code: 'short', label: `โอนไม่ครบ ขาด ${total - paid} บาท`, detail, paid, total };
    }
    if (paid && total && paid > total) {
      return { code: 'over', label: `โอนเกิน ${paid - total} บาท`, detail, paid, total };
    }
    return { code: 'bad', label: 'สลิปไม่ผ่าน ต้องตรวจเอง', detail: order.slip_note || '', paid, total };
  }
  return { code: 'wait', label: 'รอตรวจสลิป', detail: `ต้องได้ ${total} บาท`, paid, total };
}

// บันทึกเหตุการณ์ของออเดอร์ · ใช้ตรวจย้อนหลังว่าใครทำอะไรตอนไหน
export async function logEvent(db, orderId, kind, detail, actor = 'system') {
  if (!db || !orderId) return;
  try {
    await db
      .prepare('INSERT INTO preorder_events (order_id, at, kind, detail, actor) VALUES (?,?,?,?,?)')
      .bind(orderId, new Date().toISOString(), kind, String(detail || '').slice(0, 300), actor)
      .run();
  } catch {
    // ตารางประวัติล้มไม่ควรทำให้ออเดอร์ล้มตาม
  }
}

export function adminOk(request, env) {
  const expected = env && env.ADMIN_TOKEN;
  if (!expected) return false;
  // รับทาง header อย่างเดียว · ?token= จะไปติดใน log และประวัติเบราว์เซอร์
  const given = request.headers.get('x-admin-token') || '';
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// KP-7H2K9 · อ่านออกเสียงทางโทรศัพท์ได้ ไม่มีตัวที่สับสน (0/O/1/I)
export function makeOrderId() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `KP-${out}`;
}

export function clean(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

// อีเมลไม่บังคับ · รูปแบบผิดให้ทิ้งเป็นค่าว่าง ไม่ตีกลับออเดอร์
export function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase().slice(0, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function normalisePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 20);
}
