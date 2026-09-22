// ส่ง event เข้า Meta Conversions API แบบสด
// แยกเป็นไฟล์เพื่อให้ track.js และ backfill ใช้ logic เดียวกัน

/**
 * แฮชค่าตามกฎ Meta: trim + lowercase + SHA-256 hex
 * ใช้กับข้อมูลลูกค้าทุกชนิดก่อนส่ง (ชื่อ เบอร์ ประเทศ)
 */
export async function sha256Hex(text) {
  const normalised = String(text || '').trim().toLowerCase();
  if (!normalised) return null;
  const data = new TextEncoder().encode(normalised);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * เบอร์ไทยเป็นรูปแบบสากลก่อนแฮช: ตัวเลขล้วน, 0 นำหน้า -> 66
 * ตรงกับ phone_for_meta ใน scripts/meta_backfill.py
 */
export function phoneForMeta(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('0') ? '66' + digits.slice(1) : digits;
}

/**
 * POST event เข้า Conversions API ของ Meta
 * คืน { ok, status, code } เสมอ ไม่ throw
 * timeout ~4s ด้วย AbortController กันไม่ให้ worker ค้าง
 */
export async function sendCapi(env, event) {
  try {
    const pixelId = env.META_PIXEL_ID;
    const token = env.META_CAPI_TOKEN;
    if (!pixelId || !token) return { ok: false, status: 0, code: 'nocfg' };

    const body = { data: [event], access_token: token };

    // appsecret_proof ใส่เมื่อมี secret เพื่อรองรับแอปที่เปิด Require App Secret
    if (env.META_APP_SECRET) {
      const key = new TextEncoder().encode(env.META_APP_SECRET);
      const msg = new TextEncoder().encode(token);
      const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg);
      body.appsecret_proof = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);

    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    clearTimeout(timer);

    if (res.ok) return { ok: true, status: res.status, code: '' };
    // อ่าน error code จาก response body ถ้าได้
    let code = String(res.status);
    try {
      const data = await res.json();
      if (data && data.error) code = data.error.code || code;
    } catch { /* ตอบมาไม่ใช่ JSON ก็ใช้ status */ }
    return { ok: false, status: res.status, code };
  } catch (err) {
    // timeout หรือ network error
    return { ok: false, status: 0, code: err && err.name === 'AbortError' ? 'timeout' : 'network' };
  }
}
