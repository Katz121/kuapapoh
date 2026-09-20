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
  'สถานะ', 'อัปเดตล่าสุด', 'หมายเหตุทีมงาน', 'การโอน', 'ยอดที่โอนจริง'
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return reply({ ok: false, error: 'unauthorized' });

    var sheet = SHEET_NAME
      ? SpreadsheetApp.getActive().getSheetByName(SHEET_NAME)
      : SpreadsheetApp.getActive().getSheets()[0];

    ensureHeaders(sheet);

    if (body.action === 'delete') return reply(deleteRow(sheet, body));
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

  // เขียนที่แถวว่างแถวแรก · ไม่ใช้ appendRow เพราะถ้ามีคนลบเนื้อหาแถวกลางทิ้ง
  // appendRow จะไปต่อท้ายสุดจนเกิดช่องว่าง และแถวที่ถูกล้างจะโดนเขียนทับภายหลัง
  var row = firstEmptyRow(sheet);
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([rowFrom(order)]);
  formatRow(sheet, row);
  return { ok: true, row: row };
}

/* ลบออเดอร์ออกจากชีต (สั่งจากหน้าแอดมิน) · ลบทั้งแถวเพื่อไม่ให้เหลือช่องว่าง */
function deleteRow(sheet, body) {
  var order = body.order || {};
  var row = findRow(sheet, order.id);
  if (!row || row === 1) return { ok: true, deleted: false };
  sheet.deleteRow(row);
  return { ok: true, deleted: true, row: row };
}

/* แถวว่างแถวแรกที่ยังไม่มีเลขออเดอร์ */
function firstEmptyRow(sheet) {
  var last = Math.max(sheet.getLastRow(), 1);
  var ids = sheet.getRange(1, 1, last, 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === '') return i + 1;
  }
  return last + 1;
}

function updateRow(sheet, body) {
  var order = body.order || {};
  var row = findRow(sheet, order.id);
  if (!row) {
    row = firstEmptyRow(sheet);
    sheet.getRange(row, 1, 1, HEADERS.length).setValues([rowFrom(order)]);
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
    safeText(order.name),
    "'" + (order.phone || ''),          // ใส่ ' นำหน้า ไม่งั้นชีตกิน 0 ตัวหน้าเบอร์
    safeText(order.contact),
    order.items || '',
    order.qty || 0,
    order.subtotal || 0,
    order.shipping || 0,
    order.total || 0,
    order.delivery || '',
    safeText(order.address),
    safeText(order.note),
    order.hasSlip ? 'แนบแล้ว' : 'ยังไม่แนบ',
    order.slipRef || '',
    order.status || '',
    order.updatedAt || new Date().toISOString(),
    safeText(order.adminNote),
    order.payStatus || '',
    order.paidAmount || ''
  ];
}

/* ช่องข้อความอิสระที่ลูกค้าพิมพ์เอง · ขึ้นต้นด้วย = + - @ ชีตจะตีเป็นสูตร ต้องเติม ' กันไว้ */
function safeText(value) {
  var text = String(value == null ? '' : value);
  var code = text.charCodeAt(0);
  // = + - @ แท็บ และ carriage return · ห้าหกตัวนี้ทำให้ชีตตีข้อความเป็นสูตร
  if (code === 61 || code === 43 || code === 45 || code === 64 || code === 9 || code === 13) {
    return "'" + text;
  }
  return text;
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
  // เขียนหัวตารางให้ครบเสมอ · เผื่อมีการเพิ่มคอลัมน์ใหม่ทีหลัง หัวเดิมจะได้ไม่ค้างของเก่า
  var current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var same = current.length === HEADERS.length;
  for (var i = 0; same && i < HEADERS.length; i++) {
    if (String(current[i]).trim() !== HEADERS[i]) same = false;
  }
  if (same) return;
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#FFE81C');
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

  // ช่อง "การโอน" ระบายแยกอีกชั้น เพราะเป็นสิ่งที่ทีมงานต้องดูก่อนอย่างอื่น
  var pay = String(sheet.getRange(row, 19).getValue());
  var payColor = pay.indexOf('โอนครบ') === 0 ? '#C8EFD8'
    : (pay.indexOf('โอนไม่ครบ') === 0 || pay.indexOf('ไม่ผ่าน') >= 0) ? '#FFC9C2'
    : pay.indexOf('โอนเกิน') === 0 ? '#FFE9B8'
    : pay.indexOf('ยังไม่โอน') === 0 ? '#F1F1F1'
    : '#FFF6D6';
  sheet.getRange(row, 19).setBackground(payColor).setFontWeight('bold');
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
    .addItem('ดึงข้อมูลจากระบบ (ซิงก์ใหม่)', 'pullFromSystem')
    .addItem('อัปเดตสรุปไซส์', 'buildSummary')
    .addSeparator()
    .addItem('ตั้งรหัสผู้ดูแล', 'setAdminToken')
    .addItem('ให้ดึงข้อมูลเองทุก 15 นาที', 'enableAutoPull')
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

/* ═══════════════════════════════════════════════════════════
   ดึงข้อมูลจากระบบมาลงชีต · ทำให้ชีตตรงกับหน้าแอดมินเสมอ
   ฐานข้อมูลของเว็บคือของจริง ชีตเป็นแค่กระจกสะท้อน
   ตั้งรหัสครั้งเดียว: เมนู พรีออเดอร์ → ตั้งรหัสผู้ดูแล
   ═══════════════════════════════════════════════════════════ */

var API_BASE = 'https://kuapapoh.com';
var TOKEN_KEY = 'KUAPAPOH_ADMIN_TOKEN';

function setAdminToken() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.prompt('ตั้งรหัสผู้ดูแล',
    'วางรหัสเดียวกับที่ใช้เข้าหน้า kuapapoh.com/preorder-admin', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  var token = String(answer.getResponseText() || '').trim();
  if (!token) return;
  PropertiesService.getScriptProperties().setProperty(TOKEN_KEY, token);
  ui.alert('เก็บรหัสแล้ว · ต่อไปกด "ดึงข้อมูลจากระบบ" ได้เลย');
}

function pullFromSystem() {
  var token = PropertiesService.getScriptProperties().getProperty(TOKEN_KEY);
  if (!token) {
    SpreadsheetApp.getUi().alert('ยังไม่ได้ตั้งรหัสผู้ดูแล · กดเมนู พรีออเดอร์ → ตั้งรหัสผู้ดูแล ก่อน');
    return;
  }

  // กันตัวจับเวลากับคนกดมือชนกันจนเขียนทับกลางคัน
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  try {
    var response = UrlFetchApp.fetch(API_BASE + '/api/admin/preorders?limit=500', {
      headers: { 'x-admin-token': token },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('ระบบตอบกลับ ' + response.getResponseCode());
    }
    var data = JSON.parse(response.getContentText());
    if (!data.ok || !Array.isArray(data.orders)) {
      throw new Error('ดึงข้อมูลไม่สำเร็จ: ' + (data.error || 'รูปแบบข้อมูลไม่ถูกต้อง'));
    }

    var sheet = SpreadsheetApp.getActive().getSheets()[0];
    ensureHeaders(sheet);

    var orders = data.orders.slice().reverse();          // เก่าไปใหม่ ตามลำดับที่ลูกค้าสั่ง
    var rows = orders.map(function (order) { return rowFrom(fromApi(order)); });
    var had = Math.max(sheet.getLastRow() - 1, 0);

    // กันข้อมูลหายเงียบ: ถ้าจำนวนที่ดึงมาหดผิดปกติ ไม่ต้องล้างของเดิม
    // (ลบออเดอร์จริงทีละใบจะไม่เข้าเงื่อนไขนี้ เพราะหดทีละน้อย)
    if (had >= 5 && rows.length < had * 0.7) {
      throw new Error('ข้อมูลจากระบบหดผิดปกติ (' + had + ' → ' + rows.length + ' แถว) จึงไม่ล้างชีต');
    }

    // เขียนทับก่อน แล้วค่อยลบส่วนเกิน · ถ้าพังกลางคันข้อมูลเดิมยังอยู่
    if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    var extra = had - rows.length;
    if (extra > 0) {
      sheet.getRange(rows.length + 2, 1, extra, HEADERS.length).clearContent().setBackground(null);
    }
    for (var i = 0; i < rows.length; i++) formatRow(sheet, i + 2);

    SpreadsheetApp.getActive().toast('ดึงข้อมูลจากระบบแล้ว ' + rows.length + ' ออเดอร์');
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

/* แปลงข้อมูลจาก API (ชื่อช่องแบบฐานข้อมูล) ให้เป็นรูปแบบที่ rowFrom ใช้ */
function fromApi(order) {
  var items = (order.items || []).map(function (item) {
    return (SIZE_TH[item.size] || item.size) + ' x' + item.qty;
  }).join(' · ');
  return {
    id: order.id,
    createdAt: thaiTime(order.created_at),
    name: order.name,
    phone: order.phone,
    contact: order.contact,
    items: items,
    qty: order.qty,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    delivery: order.delivery === 'ship' ? 'ส่งไปรษณีย์' : 'รับเองที่บ้าน 78',
    address: order.address,
    note: order.note,
    hasSlip: !!order.has_slip,
    slipRef: order.slip_ref,
    status: STATUS_TH_MAP[order.status] || order.status,
    updatedAt: thaiTime(new Date().toISOString()),
    adminNote: order.admin_note,
    payStatus: order.pay ? order.pay.label : '',
    paidAmount: order.slip_amount || ''
  };
}

var STATUS_TH_MAP = {
  'new': 'ใหม่', 'paid': 'ยืนยันยอด', 'producing': 'กำลังผลิต',
  'ready': 'ของพร้อม', 'done': 'ปิดแล้ว', 'cancelled': 'ยกเลิก'
};
var SIZE_TH = {
  'S': 'S', 'M': 'M', 'L': 'L', 'XL': 'XL', '2XL': '2XL',
  'KID-S': 'เด็ก S', 'KID-M': 'เด็ก M', 'KID-L': 'เด็ก L'
};

function thaiTime(iso) {
  if (!iso) return '';
  var date = new Date(iso);
  if (isNaN(date.getTime())) return String(iso);
  return Utilities.formatDate(date, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
}

/* ตั้งให้ดึงเองทุก 15 นาที · กดครั้งเดียวพอ กดซ้ำไม่สร้างซ้ำ */
function enableAutoPull() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'pullFromSystem') {
      SpreadsheetApp.getUi().alert('ตั้งไว้อยู่แล้ว · ชีตจะดึงข้อมูลเองทุก 15 นาที');
      return;
    }
  }
  ScriptApp.newTrigger('pullFromSystem').timeBased().everyMinutes(15).create();
  SpreadsheetApp.getUi().alert('เรียบร้อย · ชีตจะดึงข้อมูลจากระบบเองทุก 15 นาที');
}
