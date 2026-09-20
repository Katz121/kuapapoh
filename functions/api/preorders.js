// POST /api/preorders · รับออเดอร์พรีจากหน้า /preorder
import {
  PRICE, SHIPPING, SIZES, MAX_QTY_PER_LINE, MAX_SLIP_BYTES,
  json, bad, requireDb, makeOrderId, clean, normalisePhone,
} from './_shared.js';

export async function onRequestPost({ request, env }) {
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

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

  // ราคาคิดที่เซิร์ฟเวอร์เสมอ · ยอดที่ส่งมาจากหน้าเว็บใช้แค่โชว์
  const subtotal = qty * PRICE;
  const shipping = delivery === 'ship' ? SHIPPING : 0;
  const total = subtotal + shipping;

  // สลิป: data URL จากเบราว์เซอร์ (บีบเป็น webp แล้ว) · ไม่มีก็ยังสั่งได้ ค่อยส่งทาง LINE
  let slip = null;
  const slipRaw = typeof body.slip === 'string' ? body.slip : '';
  if (slipRaw) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(slipRaw);
    if (!match) return bad('ไฟล์สลิปต้องเป็นรูปภาพ (jpg, png หรือ webp)');
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > MAX_SLIP_BYTES) return bad('ไฟล์สลิปใหญ่เกินไป กรุณาถ่ายใหม่หรือส่งทาง LINE');
    slip = { mime: match[1], data: match[2], bytes };
  }

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

  const id = makeOrderId();
  const now = new Date().toISOString();

  const statements = [
    db.prepare(
      `INSERT INTO preorders
         (id, created_at, name, phone, contact, items, qty, subtotal, shipping, total,
          delivery, address, note, has_slip, client_ref, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'new')`
    ).bind(
      id, now, name, phone, contact, JSON.stringify(items), qty, subtotal, shipping, total,
      delivery, delivery === 'ship' ? address : '', note, slip ? 1 : 0, clientRef || null
    ),
  ];
  if (slip) {
    statements.push(
      db.prepare(
        'INSERT INTO preorder_slips (order_id, mime, data, bytes, uploaded_at) VALUES (?,?,?,?,?)'
      ).bind(id, slip.mime, slip.data, slip.bytes, now)
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    return bad('บันทึกออเดอร์ไม่สำเร็จ กรุณาลองใหม่หรือสั่งทาง LINE', 500);
  }

  await notifyTelegram(env, { id, name, phone, items, qty, total, delivery, hasSlip: !!slip });

  return json({ ok: true, id, qty, subtotal, shipping, total, hasSlip: !!slip });
}

// แจ้งเตือนทีมงานทันทีที่มีออเดอร์ (ตั้ง TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID ถึงจะทำงาน)
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
    });
  } catch {
    // แจ้งเตือนพลาดไม่ควรทำให้ออเดอร์ที่บันทึกแล้วกลายเป็นล้มเหลว
  }
}

export function onRequestGet() {
  return bad('ใช้ได้เฉพาะการส่งฟอร์ม (POST)', 405);
}
