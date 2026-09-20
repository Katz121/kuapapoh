// ตรวจสลิปกับระบบธนาคารผ่าน Thunder Solution API
// ต้องตั้ง SLIP_VERIFY_KEY ใน Cloudflare Pages ถึงจะทำงาน · ไม่ตั้ง = ข้ามไป ทีมงานตรวจเอง
// เอกสาร: https://document.thunder.in.th/th/v2/
//
// ⚠️ คำตอบจริงไม่เหมือนตัวอย่างในเอกสาร · ของจริงหน้าตาแบบนี้
// { success, data: { isDuplicate, amountInSlip, rawSlip: {
//     transRef, date, amount:{amount, local:{}},
//     sender:{ bank:{name,short}, account:{ name:{th}, bank:{account} } },
//     receiver:{ ... เหมือน sender ... } } } }
// เลขบัญชีปลายทางถูกปิดบัง เช่น "XXXXX6423XXX" จึงเทียบได้แค่เลขที่โผล่มา

const ENDPOINT = 'https://api.thunder.in.th/v2/verify/bank';

export function slipCheckReady(env) {
  return !!(env && env.SLIP_VERIFY_KEY);
}

/**
 * ส่งเลขอ้างอิงจากคิวอาร์ในสลิปไปถามธนาคารว่าโอนจริงไหม
 *   verified = true  ธนาคารยืนยันว่ามีรายการนี้ ยอดตรง บัญชีปลายทางตรง
 *   verified = false มีรายการแต่ไม่ตรงเงื่อนไข หรือไม่พบรายการ
 *   verified = null  ตรวจไม่ได้ (ไม่มีคีย์ / โควตาหมด / เน็ตล่ม) ให้ทีมงานตรวจเอง
 */
export async function verifySlip(env, { payload, amount, checkDuplicate = true }) {
  if (!slipCheckReady(env)) return { checked: false, verified: null, note: '' };
  if (!payload) return { checked: false, verified: null, note: 'สลิปไม่มีคิวอาร์ให้ตรวจ' };

  const body = { payload, checkDuplicate };
  // ส่งบัญชีปลายทางกับยอดไปด้วย เผื่อ API รุ่นใหม่ช่วยเทียบให้ · แต่เราเทียบเองอยู่ดี
  if (env.SLIP_RECEIVER_ACCOUNT) body.receiverAccount = String(env.SLIP_RECEIVER_ACCOUNT).replace(/\D/g, '');
  if (amount) body.amount = Number(amount);

  let data;
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.SLIP_VERIFY_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
        // ไม่ส่ง user-agent = โดนด่านกันบอทตีกลับ 403 ตั้งแต่ยังไม่ถึง API
        'user-agent': 'kuapapoh-preorder/1.0 (+https://kuapapoh.com)',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    data = await response.json();
  } catch {
    return { checked: false, verified: null, note: 'ตรวจกับธนาคารไม่สำเร็จ (ระบบตรวจสลิปไม่ตอบ)' };
  }

  const errorCode = data && data.error && data.error.code;
  if (errorCode === 'SLIP_NOT_FOUND' || errorCode === 'VALIDATION_ERROR') {
    return { checked: true, verified: false, note: 'ธนาคารไม่พบรายการโอนตามสลิปนี้' };
  }
  if (errorCode) {
    // โควตาหมด คีย์ผิด ไอพีไม่ได้รับอนุญาต ฯลฯ ไม่ใช่ความผิดลูกค้า
    return { checked: false, verified: null, note: `ตรวจไม่ได้ (${errorCode})` };
  }

  const root = (data && data.data) || {};
  const slip = root.rawSlip || root;

  const paid = readAmount(root.amountInSlip) || readAmount(slip.amount);
  const sender = personName(slip.sender);
  const receiver = personName(slip.receiver);
  const receiverAccount = accountNumber(slip.receiver);
  const bankName = (slip.receiver && slip.receiver.bank && slip.receiver.bank.name) || '';

  const amountMatch = (amount && paid) ? Math.abs(paid - Number(amount)) < 0.01 : undefined;
  const receiverMatch = matchReceiver(env, receiverAccount, receiver);

  const problems = [];
  // อ่านยอดไม่ได้ ไม่เท่ากับยอดผิด · ถ้าไม่รู้ยอดต้องบอกตามจริง ไม่ใช่ฟันธงว่าโอนไม่ครบ
  if (amountMatch === false) {
    problems.push(`ยอดไม่ตรง · โอนมา ${paid} บาท ต้องได้ ${amount} บาท`);
  } else if (amount && !paid) {
    problems.push('ธนาคารไม่ได้ส่งยอดเงินกลับมา · ตรวจยอดด้วยตาอีกครั้ง');
  }
  if (receiverMatch === false) {
    problems.push(`โอนเข้าบัญชีอื่น (${receiver || receiverAccount || 'ไม่ทราบบัญชี'})`);
  }

  return {
    checked: true,
    verified: problems.length === 0,
    note: problems.length
      ? problems.join(' · ')
      : `ธนาคารยืนยันว่าโอนจริง ${paid ? paid + ' บาท ' : ''}เข้าบัญชีของกลุ่ม`,
    amount: paid || null,
    amountMatch,
    sender,
    receiver,
    receiverAccount,
    receiverMatch,
    bankName,
    date: slip.date || '',
    transRef: slip.transRef || '',
    duplicate: root.isDuplicate === true,
  };
}

/* ชื่อคนโอน/ผู้รับ · ของจริงซ้อนอยู่ใน account.name.th */
function personName(side) {
  if (!side || typeof side !== 'object') return '';
  const account = side.account || {};
  const name = account.name;
  if (typeof name === 'string') return name;
  if (name && typeof name === 'object') return name.th || name.en || '';
  return side.displayName || side.name || '';
}

/* เลขบัญชี · ของจริงอยู่ที่ account.bank.account และถูกปิดบังบางส่วน */
function accountNumber(side) {
  if (!side || typeof side !== 'object') return '';
  const account = side.account || {};
  if (account.bank && account.bank.account) return String(account.bank.account);
  if (account.value) return String(account.value);
  return '';
}

/**
 * เทียบว่าเงินเข้าบัญชีของกลุ่มจริงไหม
 * เลขบัญชีที่ธนาคารส่งกลับถูกปิดบัง เช่น "XXXXX6423XXX" จึงเทียบได้แค่เลขที่เห็น
 * เลขที่เห็นต้องเป็นส่วนหนึ่งของเลขบัญชีเรา และถ้าตั้งชื่อบัญชีไว้ชื่อก็ต้องตรงด้วย
 * คืน undefined เมื่อข้อมูลไม่พอให้ตัดสิน (ไม่ใช่ทั้งผ่านและไม่ผ่าน)
 */
function matchReceiver(env, receiverAccount, receiverName) {
  const expectedAccount = String(env.SLIP_RECEIVER_ACCOUNT || '').replace(/\D/g, '');
  const expectedName = String(env.SLIP_RECEIVER_NAME || '').trim();

  let accountVerdict;
  const visible = String(receiverAccount || '').replace(/\D/g, '');
  if (expectedAccount && visible.length >= 4) {
    accountVerdict = expectedAccount.includes(visible);
  }

  let nameVerdict;
  if (expectedName && receiverName) {
    nameVerdict = receiverName.replace(/\s/g, '').includes(expectedName.replace(/\s/g, ''));
  }

  if (accountVerdict === false || nameVerdict === false) return false;
  if (accountVerdict === true || nameVerdict === true) return true;
  return undefined;
}

// ยอดเงินมาได้หลายแบบ: ตัวเลขตรงๆ, "1,050.00", {amount: 350}, {local:{amount: 350}}
// อ่านให้ครบทุกแบบ ไม่งั้นระบบจะเห็นเป็น 0 แล้วไปสรุปว่า "โอนไม่ครบ" ทั้งที่ลูกค้าโอนจริง
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
