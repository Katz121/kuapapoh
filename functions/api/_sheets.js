// ส่งออเดอร์ขึ้น Google Sheet ผ่าน Apps Script Web App
// ตั้ง SHEETS_WEBHOOK_URL + SHEETS_SECRET ใน Cloudflare Pages ถึงจะทำงาน
// ชีตล่มหรือยังไม่ได้ตั้งค่า = ออเดอร์ยังบันทึกลง D1 ปกติ แค่ค้างรอกดซิงก์ใหม่

const SIZE_TH = {
  'S': 'S', 'M': 'M', 'L': 'L', 'XL': 'XL', '2XL': '2XL',
  'KID-S': 'เด็ก S', 'KID-M': 'เด็ก M', 'KID-L': 'เด็ก L',
};

import { payStatus } from './_shared.js';

const STATUS_TH = {
  new: 'ใหม่', paid: 'ยืนยันยอด', producing: 'กำลังผลิต',
  ready: 'ของพร้อม', done: 'ปิดแล้ว', cancelled: 'ยกเลิก',
};

export function sheetsReady(env) {
  return !!(env && env.SHEETS_WEBHOOK_URL && env.SHEETS_SECRET);
}

export function toSheetRow(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    id: order.id,
    createdAt: bangkokTime(order.created_at || order.createdAt),
    name: order.name,
    phone: order.phone,
    contact: order.contact || '',
    items: items.map((item) => `${SIZE_TH[item.size] || item.size} x${item.qty}`).join(' · '),
    qty: order.qty,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    delivery: order.delivery === 'ship' ? 'ส่งไปรษณีย์' : 'รับเองที่บ้าน 78',
    address: order.address || '',
    note: order.note || '',
    hasSlip: !!(order.has_slip || order.hasSlip),
    slipRef: order.slip_ref || order.slipRef || '',
    status: STATUS_TH[order.status] || order.status || 'ใหม่',
    updatedAt: bangkokTime(new Date().toISOString()),
    adminNote: order.admin_note || order.adminNote || '',
    // สองช่องนี้มาจากผลตรวจสลิปกับธนาคาร ทีมงานจะได้ไม่ต้องไล่เปิดสลิปทีละใบ
    payStatus: payStatus(order).label,
    paidAmount: order.slip_amount || '',
  };
}

export async function pushToSheet(env, order, action = 'append') {
  if (!sheetsReady(env)) return { ok: false, error: 'ยังไม่ได้ตั้งค่า Google Sheet' };
  try {
    const response = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.SHEETS_SECRET, action, order: toSheetRow(order) }),
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',       // Apps Script เด้ง 302 ไป googleusercontent เสมอ
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: `ชีตตอบกลับผิดรูปแบบ (${response.status})` };
    }
    if (!data.ok) return { ok: false, error: data.error || 'ชีตปฏิเสธข้อมูล' };
    return { ok: true, row: data.row || null };
  } catch (error) {
    // ต่อชีตไม่ติด/หมดเวลา บางทีไม่มีข้อความมาด้วย ต้องเดาให้ทีมงานพออ่านรู้เรื่อง
    var reason = (error && (error.message || error.name)) || '';
    if (!String(reason).trim()) reason = 'ต่อ Google Sheet ไม่ได้ (ชีตไม่ตอบ หรือ URL ผิด)';
    return { ok: false, error: String(reason).slice(0, 180) };
  }
}

// ชีตของทีมงานอ่านเป็นเวลาไทยเสมอ ไม่ใช่ UTC
function bangkokTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const parts = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
