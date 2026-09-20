/**
 * ตัวรับออเดอร์เข้า Google Sheet · กั่วป่าโพ้
 * ─────────────────────────────────────────────────────────────
 * วิธีติดตั้ง (ทำครั้งเดียว ประมาณ 3 นาที)
 * 1. เปิดชีต "พรีออเดอร์เสื้อเทศกาลกินผัก · กั่วป่าโพ้"
 * 2. เมนู ส่วนขยาย (Extensions) → Apps Script
 * 3. ลบโค้ดเดิมทั้งหมด วางไฟล์นี้ลงไปแทน
 * 4. แก้ SECRET ด้านล่างเป็นรหัสลับที่ตั้งเอง (ตัวอักษรอังกฤษ+ตัวเลข ยาวๆ)
 * 5. กด Deploy → New deployment → ประเภท Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *    (ต้องเป็น Anyone เพราะเว็บเราเรียกเข้ามาแบบไม่ได้ล็อกอิน · รหัสลับด้านบนคือด่านกัน)
 * 6. คัดลอก Web app URL ที่ได้ ไปใส่ใน Cloudflare Pages เป็นตัวแปรลับ
 *      SHEETS_WEBHOOK_URL = URL ที่ได้
 *      SHEETS_SECRET      = รหัสลับเดียวกับ SECRET ด้านล่าง
 * ─────────────────────────────────────────────────────────────
 */

var SECRET = 'เปลี่ยนรหัสนี้ก่อนใช้งาน';
var SHEET_NAME = '';   // เว้นว่าง = ใช้แท็บแรกของไฟล์

var HEADERS = [
  'เลขออเดอร์', 'วันเวลาที่สั่ง', 'ชื่อ-นามสกุล', 'เบอร์โทร', 'LINE/Facebook',
  'รายการไซส์', 'จำนวน (ตัว)', 'ค่าเสื้อ', 'ค่าส่ง', 'ยอดรวม',
  'วิธีรับของ', 'ที่อยู่จัดส่ง', 'หมายเหตุลูกค้า', 'สลิป', 'เลขอ้างอิงสลิป',
  'สถานะ', 'อัปเดตล่าสุด', 'หมายเหตุทีมงาน'
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return reply({ ok: false, error: 'unauthorized' });

    var sheet = SHEET_NAME
      ? SpreadsheetApp.getActive().getSheetByName(SHEET_NAME)
      : SpreadsheetApp.getActive().getSheets()[0];

    ensureHeaders(sheet);

    if (body.action === 'update') return reply(updateRow(sheet, body));
    return reply(appendRow(sheet, body));
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

function appendRow(sheet, body) {
  var order = body.order || {};
  // ออเดอร์เดิมที่ส่งซ้ำ (เช่นกดซิงก์ใหม่) ต้องไม่กลายเป็นสองแถว
  var existing = findRow(sheet, order.id);
  if (existing) return updateRow(sheet, body);

  sheet.appendRow(rowFrom(order));
  var row = sheet.getLastRow();
  formatRow(sheet, row);
  return { ok: true, row: row };
}

function updateRow(sheet, body) {
  var order = body.order || {};
  var row = findRow(sheet, order.id);
  if (!row) {
    sheet.appendRow(rowFrom(order));
    row = sheet.getLastRow();
    formatRow(sheet, row);
    return { ok: true, row: row, created: true };
  }
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([rowFrom(order)]);
  formatRow(sheet, row);
  return { ok: true, row: row };
}

function rowFrom(order) {
  return [
    order.id || '',
    order.createdAt || '',
    order.name || '',
    "'" + (order.phone || ''),          // ใส่ ' นำหน้า ไม่งั้นชีตกิน 0 ตัวหน้าเบอร์
    order.contact || '',
    order.items || '',
    order.qty || 0,
    order.subtotal || 0,
    order.shipping || 0,
    order.total || 0,
    order.delivery || '',
    order.address || '',
    order.note || '',
    order.hasSlip ? 'แนบแล้ว' : 'ยังไม่แนบ',
    order.slipRef || '',
    order.status || '',
    order.updatedAt || new Date().toISOString(),
    order.adminNote || ''
  ];
}

function findRow(sheet, orderId) {
  if (!orderId) return 0;
  var ids = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(orderId).trim()) return i + 1;
  }
  return 0;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#FFE81C');
  sheet.setFrozenRows(1);
}

// ออเดอร์ที่ยังไม่ได้ยืนยันยอดให้เห็นเด่นๆ จะได้ไม่ลืมตรวจสลิป
function formatRow(sheet, row) {
  var status = String(sheet.getRange(row, 16).getValue());
  var color = status === 'ใหม่' ? '#FFF6D6'
    : status === 'ยกเลิก' ? '#F1F1F1'
    : status === 'ยืนยันยอด' ? '#E4F7EC'
    : '#FFFFFF';
  sheet.getRange(row, 1, 1, HEADERS.length).setBackground(color);
}

function reply(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
