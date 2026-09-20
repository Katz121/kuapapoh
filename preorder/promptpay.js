/* ═══════════════════════════════════════════════════════════
   สร้างคิวอาร์พร้อมเพย์แบบ "ฝังยอดเงิน" ตามมาตรฐาน EMVCo
   ลูกค้าสแกนแล้วยอดขึ้นเองในแอปธนาคาร ไม่ต้องพิมพ์ตัวเลข = โอนผิดยอดไม่ได้
   ใช้: window.KPPromptPay.payload('0812345678', 1100) → สตริงสำหรับทำ QR
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  // ทุกช่องของ EMVCo คือ [รหัส 2 หลัก][ความยาว 2 หลัก][ค่า]
  function field(id, value) {
    const text = String(value);
    return id + String(text.length).padStart(2, '0') + text;
  }

  // เบอร์มือถือไทย → 0066xxxxxxxxx (13 หลัก) · เลขบัตรประชาชน 13 หลักใช้ตรงๆ
  function targetField(account) {
    const digits = String(account || '').replace(/\D/g, '');
    if (digits.length === 13) return field('02', digits);                 // เลขบัตรประชาชน / นิติบุคคล
    if (digits.length === 15) return field('03', digits);                 // e-Wallet
    const phone = digits.replace(/^0/, '');
    return field('01', ('0000000000000' + '66' + phone).slice(-13));      // เบอร์มือถือ
  }

  // CRC16-CCITT (poly 0x1021, init 0xFFFF) ตามที่ EMVCo กำหนด
  function crc16(input) {
    let crc = 0xffff;
    for (let i = 0; i < input.length; i++) {
      crc ^= input.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function payload(account, amount) {
    if (!account) return '';
    const hasAmount = Number(amount) > 0;
    const body = [
      field('00', '01'),
      field('01', hasAmount ? '12' : '11'),   // 12 = ใช้ครั้งเดียว (มียอด) · 11 = ใช้ซ้ำได้
      field('29', field('00', 'A000000677010111') + targetField(account)),
      field('53', '764'),                      // สกุลเงินบาท
      hasAmount ? field('54', Number(amount).toFixed(2)) : '',
      field('58', 'TH'),
    ].join('') + '6304';
    return body + crc16(body);
  }

  // วาด QR ลง <img> ที่ส่งเข้ามา (ใช้ vendor/qrcode.js ซึ่งอยู่ในเครื่องเรา ไม่เรียกเน็ตนอก)
  function draw(imgEl, text, cellSize) {
    if (!imgEl || !text || typeof global.qrcode !== 'function') return false;
    try {
      const qr = global.qrcode(0, 'M');       // ให้ไลบรารีเลือกขนาดเอง · แก้ความผิดพลาดระดับกลาง
      qr.addData(text);
      qr.make();
      imgEl.src = qr.createDataURL(cellSize || 6, 8);
      return true;
    } catch (error) {
      return false;
    }
  }

  global.KPPromptPay = { payload: payload, draw: draw, crc16: crc16 };
})(window);
