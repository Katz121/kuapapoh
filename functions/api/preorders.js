// POST /api/preorders · รับออเดอร์พรีจากหน้า /preorder
import {
  PRICE, SHIPPING, SIZES, MAX_QTY_PER_LINE, MAX_QTY_PER_ORDER, MAX_SLIP_BYTES, MAX_BODY_BYTES,
  json, bad, requireDb, makeOrderId, clean, normalisePhone, ipFingerprint,
} from './_shared.js';

const RATE_WINDOW_MINUTES = 10;
const RATE_MAX_ORDERS = 8;          // คนเดียวสั่งถี่กว่านี้ใน 10 นาที = ไม่ใช่ลูกค้าแล้ว

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  // ตัดตั้งแต่ยังไม่ parse · สลิปยักษ์ไม่ควรได้เข้ามากิน CPU ของ Worker
  const declared = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return bad('ข้อมูลที่ส่งมาใหญ่เกินไป กรุณาแนบสลิปที่ถ่ายใหม่หรือส่งทาง LINE', 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return bad('ข้อมูลที่ส่งมาไม่ถูกต้อง');
  }

  const name = clean(body.name, 80);
  const phone = normalisePhone(body.phone);
  const contact = clean(body.contact, 80);
  const delivery = body.delivery === 'ship' ? 'ship' : 'pickup';
  const address = clean(body.address, 400);
  const note = clean(body.note, 400);

  if (name.length < 2) return bad('กรุณากรอกชื่อ-นามสกุล');
  if (phone.replace(/\D/g, '').length < 9) return bad('เบอร์โทรไม่ถูกต้อง');
  if (delivery === 'ship' && address.length < 15) return bad('กรุณากรอกที่อยู่จัดส่งให้ครบ');

  // รวมไซส์ซ้ำเป็นบรรทัดเดียว กันคนกดเพิ่มแถวซ้ำ
  const merged = new Map();
  for (const raw of Array.isArray(body.items) ? body.items : []) {
    const size = clean(raw && raw.size, 10).toUpperCase();
    const qty = Number.parseInt(raw && raw.qty, 10);
    if (!SIZES.includes(size)) continue;
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) continue;
    merged.set(size, Math.min(MAX_QTY_PER_LINE, (merged.get(size) || 0) + qty));
  }
  const items = [...merged].map(([size, qty]) => ({ size, qty }));
  const qty = items.reduce((sum, item) => sum + item.qty, 0);
  if (!qty) return bad('กรุณาเลือกไซส์และจำนวนอย่างน้อย 1 ตัว');
  if (qty > MAX_QTY_PER_ORDER) {
    return bad(`สั่งครั้งละไม่เกิน ${MAX_QTY_PER_ORDER} ตัว ถ้าต้องการมากกว่านี้ทักทีมงานทาง LINE ได้เลย`);
  }

  // ราคาคิดที่เซิร์ฟเวอร์เสมอ · ยอดที่ส่งมาจากหน้าเว็บใช้แค่โชว์
  const subtotal = qty * PRICE;
  const shipping = delivery === 'ship' ? SHIPPING : 0;
  const total = subtotal + shipping;

  // สลิป: data URL จากเบราว์เซอร์ (บีบเป็น webp แล้ว) · ไม่มีก็ยังสั่งได้ ค่อยส่งทาง LINE
  let slip = null;
  const slipRaw = typeof body.slip === 'string' ? body.slip : '';
  if (slipRaw) {
    if (slipRaw.length > MAX_SLIP_BYTES * 2) {
      return bad('ไฟล์สลิปใหญ่เกินไป กรุณาถ่ายใหม่หรือส่งทาง LINE');
    }
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(slipRaw);
    if (!match) return bad('ไฟล์สลิปต้องเป็นรูปภาพ (jpg, png หรือ webp)');
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > MAX_SLIP_BYTES) return bad('ไฟล์สลิปใหญ่เกินไป กรุณาถ่ายใหม่หรือส่งทาง LINE');
    slip = { mime: match[1], data: match[2], bytes };
  }

  const fingerprint = await ipFingerprint(request);

  // เน็ตหลุดตอนกดยืนยันแล้วกดใหม่ = ส่ง clientRef เดิมมา ต้องได้ออเดอร์เดิม ไม่ใช่ออเดอร์ที่สอง
  const clientRef = clean(body.clientRef, 60);
  if (clientRef) {
    const existing = await db
      .prepare('SELECT id, qty, subtotal, shipping, total, has_slip FROM preorders WHERE client_ref = ?')
      .bind(clientRef)
      .first();
    if (existing) {
      return json({
        ok: true,
        id: existing.id,
        qty: existing.qty,
        subtotal: existing.subtotal,
        shipping: existing.shipping,
        total: existing.total,
        hasSlip: !!existing.has_slip,
        duplicate: true,
      });
    }
  }

  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const recent = await db
    .prepare('SELECT COUNT(*) AS n FROM preorders WHERE ip_hash = ? AND created_at > ?')
    .bind(fingerprint, since)
    .first();
  if (recent && recent.n >= RATE_MAX_ORDERS) {
    return bad('สั่งถี่เกินไป กรุณารอสักครู่ หรือทักทีมงานทาง LINE', 429);
  }

  const now = new Date().toISOString();
  let id = '';
  let lastError = null;

  // รหัสออเดอร์สุ่ม 5 ตัว มีโอกาสชนน้อยมาก แต่ถ้าชนต้องไม่ใช่ลูกค้าที่รับกรรม
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    const candidate = makeOrderId();
    const statements = [
      db.prepare(
        `INSERT INTO preorders
           (id, created_at, name, phone, contact, items, qty, subtotal, shipping, total,
            delivery, address, note, has_slip, client_ref, ip_hash, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'new')`
      ).bind(
        candidate, now, name, phone, contact, JSON.stringify(items), qty, subtotal, shipping, total,
        delivery, delivery === 'ship' ? address : '', note, slip ? 1 : 0, clientRef || null, fingerprint
      ),
    ];
    if (slip) {
      statements.push(
        db.prepare(
          'INSERT INTO preorder_slips (order_id, mime, data, bytes, uploaded_at) VALUES (?,?,?,?,?)'
        ).bind(candidate, slip.mime, slip.data, slip.bytes, now)
      );
    }
    try {
      await db.batch(statements);
      id = candidate;
    } catch (error) {
      lastError = error;
    }
  }

  if (!id) {
    // กดซ้ำเร็วมากจน ref เดิมชนกันเอง = ออเดอร์แรกบันทึกไปแล้ว คืนตัวนั้นกลับไป
    if (clientRef) {
      const saved = await db
        .prepare('SELECT id, qty, subtotal, shipping, total, has_slip FROM preorders WHERE client_ref = ?')
        .bind(clientRef)
        .first();
      if (saved) {
        return json({
          ok: true,
          id: saved.id,
          qty: saved.qty,
          subtotal: saved.subtotal,
          shipping: saved.shipping,
          total: saved.total,
          hasSlip: !!saved.has_slip,
          duplicate: true,
        });
      }
    }
    console.error('preorder insert failed', lastError);
    return bad('บันทึกออเดอร์ไม่สำเร็จ กรุณาลองใหม่หรือสั่งทาง LINE', 500);
  }

  // แจ้งเตือนทีมงานต้องไม่หน่วงลูกค้า · ปล่อยให้วิ่งต่อหลังตอบกลับไปแล้ว
  const notify = notifyTelegram(env, { id, name, phone, items, qty, total, delivery, hasSlip: !!slip });
  if (context.waitUntil) context.waitUntil(notify);

  return json({ ok: true, id, qty, subtotal, shipping, total, hasSlip: !!slip });
}

async function notifyTelegram(env, order) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const lines = order.items.map((item) => `${item.size} x${item.qty}`).join(' · ');
  const text = [
    `🧧 พรีออเดอร์ใหม่ ${order.id}`,
    `${order.name} · ${order.phone}`,
    `${lines} (รวม ${order.qty} ตัว)`,
    `${order.delivery === 'ship' ? 'จัดส่งไปรษณีย์' : 'รับเองที่บ้าน 78'} · ยอด ${order.total} บาท`,
    order.hasSlip ? 'แนบสลิปแล้ว' : 'ยังไม่แนบสลิป',
  ].join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Telegram ล่มไม่ควรทำให้ออเดอร์ที่บันทึกแล้วกลายเป็นล้มเหลว
  }
}

// method อื่นตอบให้ชัด · ห้าม export onRequest เพราะมันจะกิน POST ไปด้วย
const methodNotAllowed = () => bad('ใช้ได้เฉพาะการส่งฟอร์ม (POST)', 405);
export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
