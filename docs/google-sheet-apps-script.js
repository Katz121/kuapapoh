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

/* ═══════════════════════════════════════════════════════════
   แท็บกรอกมือ · สำหรับออเดอร์ที่มาทาง LINE หรือหน้าร้าน
   รันครั้งเดียวจากเมนู เรียกใช้ → setupManualTab
   ═══════════════════════════════════════════════════════════ */

var MANUAL_SHEET = 'กรอกมือ';
var SUMMARY_SHEET = 'สรุปไซส์';
var SIZE_COLS = ['S', 'M', 'L', 'XL', '2XL', 'เด็ก S', 'เด็ก M', 'เด็ก L'];
var PRICE = 350;
var SHIPPING = 50;

function setupManualTab() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(MANUAL_SHEET) || ss.insertSheet(MANUAL_SHEET);
  sh.clear();

  var headers = ['วันที่', 'ชื่อ-นามสกุล', 'เบอร์โทร', 'ช่องทาง']
    .concat(SIZE_COLS)
    .concat(['รวม (ตัว)', 'ค่าส่ง', 'ยอดรวม', 'รับของ', 'ที่อยู่จัดส่ง', 'สถานะ', 'หมายเหตุ']);
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#FFE81C').setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);

  var firstSize = 5;                       // คอลัมน์ E
  var lastSize = firstSize + SIZE_COLS.length - 1;
  var colTotalQty = lastSize + 1;
  var colShipping = colTotalQty + 1;
  var colTotal = colShipping + 1;
  var colPickup = colTotal + 1;
  var colStatus = colTotal + 3;

  // สูตรรวมจำนวนและยอดเงินให้เอง กรอกแค่จำนวนต่อไซส์ก็พอ
  var rows = 300;
  var qtyFormulas = [];
  var totalFormulas = [];
  for (var i = 0; i < rows; i++) {
    var r = i + 2;
    var range = columnLetter(firstSize) + r + ':' + columnLetter(lastSize) + r;
    qtyFormulas.push(['=IF(COUNTA(' + range + ')=0,"",SUM(' + range + '))']);
    totalFormulas.push(['=IF(' + columnLetter(colTotalQty) + r + '="","",' +
      columnLetter(colTotalQty) + r + '*' + PRICE + '+N(' + columnLetter(colShipping) + r + '))']);
  }
  sh.getRange(2, colTotalQty, rows, 1).setFormulas(qtyFormulas);
  sh.getRange(2, colTotal, rows, 1).setFormulas(totalFormulas);

  // ค่าส่ง: เลือกรับของแล้วเติมเอง 0 หรือ 50
  sh.getRange(2, colShipping, rows, 1).setNote('ใส่ ' + SHIPPING + ' ถ้าส่งไปรษณีย์ · เว้นว่างหรือ 0 ถ้ารับเอง');

  applyList(sh, 2, 4, rows, ['LINE', 'หน้าร้าน', 'โทร', 'เฟซบุ๊ก']);
  applyList(sh, 2, colPickup, rows, ['รับเองที่บ้าน 78', 'ส่งไปรษณีย์']);
  applyList(sh, 2, colStatus, rows, ['ใหม่', 'ยืนยันยอด', 'กำลังผลิต', 'ของพร้อม', 'ปิดแล้ว', 'ยกเลิก']);

  sh.getRange(2, 1, rows, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(2, 3, rows, 1).setNumberFormat('@');   // เบอร์โทรเป็นข้อความ 0 ตัวหน้าจะได้ไม่หาย
  sh.setColumnWidth(1, 95);
  sh.setColumnWidth(2, 170);
  for (var c = firstSize; c <= lastSize; c++) sh.setColumnWidth(c, 62);

  buildSummary();
  SpreadsheetApp.getActive().toast('สร้างแท็บ "' + MANUAL_SHEET + '" และ "' + SUMMARY_SHEET + '" แล้ว');
}

/* รวมยอดไซส์จากทั้งออเดอร์เว็บและออเดอร์ที่กรอกมือ ไว้ใช้สั่งโรงงานรอบเดียว
   นับด้วยโค้ด ไม่ใช้สูตรในชีต เพราะฝั่งเว็บเก็บรายการเป็นข้อความ เช่น "L x2 · เด็ก M x1" */
function buildSummary() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SUMMARY_SHEET) || ss.insertSheet(SUMMARY_SHEET);
  sh.clear();

  var fromWeb = countFromWeb(ss);
  var fromManual = countFromManual(ss);

  var table = [['ไซส์', 'จากเว็บ', 'กรอกมือ', 'รวม']];
  var sumWeb = 0;
  var sumManual = 0;
  for (var i = 0; i < SIZE_COLS.length; i++) {
    var size = SIZE_COLS[i];
    var web = fromWeb[size] || 0;
    var manual = fromManual[size] || 0;
    sumWeb += web;
    sumManual += manual;
    table.push([size, web, manual, web + manual]);
  }
  table.push(['รวมทั้งหมด', sumWeb, sumManual, sumWeb + sumManual]);

  sh.getRange(1, 1, table.length, 4).setValues(table);
  sh.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#FFE81C');
  sh.getRange(table.length, 1, 1, 4).setFontWeight('bold').setBackground('#E4F7EC');
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, 4, 130);
  sh.getRange(table.length + 2, 1)
    .setValue('อัปเดตเมื่อ ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm') +
              ' · กดเมนู "พรีออเดอร์ → อัปเดตสรุปไซส์" เพื่อนับใหม่')
    .setFontColor('#4d5474');
}

/* แท็บแรก = ออเดอร์จากเว็บ · คอลัมน์ F เก็บรายการไซส์ คอลัมน์ P เก็บสถานะ */
function countFromWeb(ss) {
  var sheet = ss.getSheets()[0];
  var counts = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return counts;
  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    var items = String(rows[i][5] || '');
    var status = String(rows[i][15] || '');
    if (!items || status === 'ยกเลิก') continue;
    var parts = items.split('·');
    for (var j = 0; j < parts.length; j++) {
      var piece = parts[j].trim();
      var at = piece.lastIndexOf(' x');
      if (at < 1) continue;
      var size = piece.substring(0, at).trim();
      var qty = parseInt(piece.substring(at + 2), 10);
      if (!qty) continue;
      counts[size] = (counts[size] || 0) + qty;
    }
  }
  return counts;
}

/* แท็บกรอกมือ · ช่องไซส์เป็นตัวเลขอยู่แล้ว บวกตรงๆ ได้เลย */
function countFromManual(ss) {
  var sheet = ss.getSheetByName(MANUAL_SHEET);
  var counts = {};
  if (!sheet) return counts;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return counts;
  var firstSize = 5;
  var values = sheet.getRange(2, firstSize, lastRow - 1, SIZE_COLS.length).getValues();
  var statuses = sheet.getRange(2, firstSize + SIZE_COLS.length + 5, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(statuses[i][0] || '') === 'ยกเลิก') continue;
    for (var j = 0; j < SIZE_COLS.length; j++) {
      var qty = Number(values[i][j]) || 0;
      if (qty) counts[SIZE_COLS[j]] = (counts[SIZE_COLS[j]] || 0) + qty;
    }
  }
  return counts;
}

/* เมนูในชีต · ทีมงานกดเองได้ ไม่ต้องเข้าหน้า Apps Script */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('พรีออเดอร์')
    .addItem('อัปเดตสรุปไซส์', 'buildSummary')
    .addItem('สร้าง/ล้างแท็บกรอกมือใหม่', 'setupManualTab')
    .addToUi();
}

function applyList(sheet, row, col, rows, values) {
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).build();
  sheet.getRange(row, col, rows, 1).setDataValidation(rule);
}

function columnLetter(index) {
  var letter = '';
  while (index > 0) {
    var mod = (index - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    index = Math.floor((index - mod) / 26);
  }
  return letter;
}
