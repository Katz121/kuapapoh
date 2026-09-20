// เครื่องมือร่วมของ API พรีออเดอร์ · Cloudflare Pages Functions (vanilla JS)

export const PRICE = 350;            // ราคาต่อตัว (ทุกไซส์ รวมไซส์เด็ก)
export const SHIPPING = 50;          // ค่าส่งไปรษณีย์ต่อ 1 ออเดอร์
export const SIZES = ['S', 'M', 'L', 'XL', '2XL', 'KID-S', 'KID-M', 'KID-L'];
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

export function normalisePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 20);
}
