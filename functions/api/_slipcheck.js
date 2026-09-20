// ตรวจสลิปกับระบบธนาคารผ่าน Thunder Solution API
// ต้องตั้ง SLIP_VERIFY_KEY ใน Cloudflare Pages ถึงจะทำงาน · ไม่ตั้ง = ข้ามไป ทีมงานตรวจเอง
// เอกสาร: https://document.thunder.in.th/th/v2/

const ENDPOINT = 'https://api.thunder.in.th/v2/verify/bank';

export function slipCheckReady(env) {
  return !!(env && env.SLIP_VERIFY_KEY);
}

/**
 * ส่งเลขอ้างอิงจากคิวอาร์ในสลิปไปถามธนาคารว่าโอนจริงไหม
 * คืน { checked, verified, note, amount, sender, transRef }
 *   verified = true  ธนาคารยืนยันว่ามีรายการนี้จริง
 *   verified = false มีรายการแต่ไม่ตรงเงื่อนไข (ยอด/บัญชีปลายทางไม่ตรง)
 *   verified = null  ตรวจไม่ได้ (ไม่มีคีย์ / โควตาหมด / เน็ตล่ม) ให้ทีมงานตรวจเอง
 */
export async function verifySlip(env, { payload, amount }) {
  if (!slipCheckReady(env)) return { checked: false, verified: null, note: '' };
  if (!payload) return { checked: false, verified: null, note: 'สลิปไม่มีคิวอาร์ให้ตรวจ' };

  const body = { payload };
  // บัญชีปลายทางต้องเป็นของเรา ไม่งั้นลูกค้าเอาสลิปที่โอนให้คนอื่นมาอ้างได้
  if (env.SLIP_RECEIVER_ACCOUNT) body.receiverAccount = String(env.SLIP_RECEIVER_ACCOUNT).replace(/\D/g, '');
  if (amount) body.amount = Number(amount);
  body.checkDuplicate = true;

  let data;
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.SLIP_VERIFY_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
        // ไม่ส่ง user-agent ปกติ จะโดนด่านกันบอทของเขาตีกลับ 403 ตั้งแต่ยังไม่ถึง API
        'user-agent': 'kuapapoh-preorder/1.0 (+https://kuapapoh.com)',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    data = await response.json();
  } catch (error) {
    return { checked: false, verified: null, note: 'ตรวจกับธนาคารไม่สำเร็จ (ระบบตรวจสลิปไม่ตอบ)' };
  }

  // ไม่พบรายการ = สลิปปลอมหรือเลขอ้างอิงใช้ไม่ได้ · อันนี้ถือว่าไม่ผ่านชัดเจน
  const errorCode = data && data.error && data.error.code;
  if (errorCode === 'SLIP_NOT_FOUND' || errorCode === 'VALIDATION_ERROR') {
    return {
      checked: true,
      verified: false,
      note: 'ธนาคารไม่พบรายการโอนตามสลิปนี้',
    };
  }
  if (errorCode) {
    // โควตาหมด คีย์ผิด ไอพีไม่ได้รับอนุญาต ฯลฯ ไม่ใช่ความผิดลูกค้า
    return { checked: false, verified: null, note: `ตรวจไม่ได้ (${errorCode})` };
  }

  const info = (data && data.data) || {};
  // ยอดเงินมาได้หลายรูปแบบแล้วแต่ธนาคาร: เป็นตัวเลขตรงๆ, {amount}, หรือ {local:{amount}}
  const amountInfo = info.amount;
  const paid = readAmount(amountInfo) || readAmount(info.transAmount) || readAmount(info.value) || 0;
  const receiverMatch = info.receiver && info.receiver.account ? info.receiver.account.match : undefined;
  const amountMatch = (amountInfo && typeof amountInfo.match === 'boolean')
    ? amountInfo.match
    : (amount && paid ? Math.abs(paid - Number(amount)) < 0.01 : undefined);

  const problems = [];
  // อ่านยอดไม่ได้ ไม่เท่ากับยอดผิด · ถ้าไม่รู้ยอดต้องบอกตามจริง ไม่ใช่ฟันธงว่าโอนไม่ครบ
  if (amountMatch === false) {
    problems.push(paid ? `ยอดไม่ตรง (โอนมา ${paid} บาท)` : 'ยอดไม่ตรงกับที่สั่ง');
  } else if (amount && !paid) {
    problems.push('ธนาคารไม่ได้ส่งยอดเงินกลับมา · ตรวจยอดด้วยตาอีกครั้ง');
  }
  if (receiverMatch === false) problems.push('โอนเข้าบัญชีอื่น ไม่ใช่บัญชีของกลุ่ม');

  return {
    checked: true,
    verified: problems.length === 0,
    note: problems.length ? problems.join(' · ') : 'ธนาคารยืนยันว่าโอนจริง ยอดและบัญชีปลายทางตรง',
    amount: paid || null,
    sender: (info.sender && (info.sender.displayName || info.sender.name)) || '',
    receiver: (info.receiver && (info.receiver.displayName || info.receiver.name)) || '',
    receiverAccount: (info.receiver && info.receiver.account && info.receiver.account.value) || '',
    receiverMatch: receiverMatch,
    amountMatch: amountMatch,
    date: info.date || '',
    transRef: info.transRef || '',
  };
}

// ยอดเงินมาได้หลายแบบแล้วแต่ธนาคารต้นทาง: ตัวเลขตรงๆ, "1,050.00",
// {amount: 350}, หรือ {local: {amount: 350}} · อ่านให้ครบทุกแบบ
// ไม่งั้นระบบจะเห็นเป็น 0 แล้วไปสรุปว่า "โอนไม่ครบ" ทั้งที่ลูกค้าโอนจริง
function readAmount(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return Number(value.replace(/[^\d.]/g, '')) || 0;
  if (typeof value === 'object') {
    return readAmount(value.amount) || readAmount(value.value) ||
      (value.local ? readAmount(value.local.amount) : 0);
  }
  return 0;
}
