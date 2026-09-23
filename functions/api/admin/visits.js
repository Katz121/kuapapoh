// GET /api/admin/visits?days=7|14|30|365|all&compare=1&include_today=0
// สรุปสถิติคนเข้าเว็บที่เราเก็บเอง ใช้กับหน้า stats.html ต้องมี x-admin-token
// v3: ช่วงเทียบเท่า + % ฝั่ง server + เกณฑ์ฐานน้อย + วันนี้แยกการ์ด + MA7 +
//     เงินจริงจาก preorders + สต็อกกระเป๋า + ค่าแอด Meta + markers แบบไม่ล้ม
import { json, bad, requireDb, adminOk, BAG_STOCK, BAG_CODES, BAG_TH, reservedBags } from '../_shared.js';

// จับคู่แคมเปญ Meta กับ utm_campaign ที่ติดในเว็บ
// เพิ่มแคมเปญใหม่ตรงนี้ได้เลย แบบตรงตัวมาก่อน แล้วค่อยแบบคำค้น
// ชื่อแคมเปญใน Ads Manager ต้องขึ้นต้นด้วย KP ถึงจะถูกดึงมาคิด
const UTM_BY_EXACT_NAME = {
  // ตัวอย่าง: 'KP-Shirt-Preorder-Sep': 'kp-preorder-0921',
  // ตัวอย่าง: 'KP-Bag-Sep': 'kp-bag-0923',
};
const UTM_BY_KEYWORD = [
  { key: 'kp-bag-0923', utm: 'kp-bag-0923', label: 'กระเป๋า' },
  { key: 'kp-preorder-0921', utm: 'kp-preorder-0921', label: 'เสื้อ' },
  { key: 'bag', utm: 'kp-bag-0923', label: 'กระเป๋า' },
  { key: 'กระเป๋า', utm: 'kp-bag-0923', label: 'กระเป๋า' },
  { key: 'shirt', utm: 'kp-preorder-0921', label: 'เสื้อ' },
  { key: 'เสื้อ', utm: 'kp-preorder-0921', label: 'เสื้อ' },
  { key: 'preorder', utm: 'kp-preorder-0921', label: 'เสื้อ' },
];

const META_ACCOUNT = 'act_1798326928176568';
const META_PIXEL = '1621493986432899';

export async function onRequestGet({ request, env }) {
  if (!adminOk(request, env)) return bad('รหัสผ่านไม่ถูกต้อง', 401);
  const db = requireDb(env);
  if (!db) return bad('ยังไม่ได้เชื่อมฐานข้อมูล (D1)', 503);

  const url = new URL(request.url);
  const daysParam = (url.searchParams.get('days') || '30').trim().toLowerCase();
  const modeAll = daysParam === 'all';
  const n = modeAll ? 0 : clampDays(daysParam);

  let compare = url.searchParams.get('compare');
  compare = compare == null ? (modeAll || n === 1 ? '0' : '1') : compare;
  const wantCompare = compare === '1' && !modeAll && n !== 1;
  const includeToday = url.searchParams.get('include_today') === '1';

  const todayStr = thaiDayOffset(0);

  // หาวันแรกที่มีข้อมูล เผื่อ days=all
  let firstDay = '2026-09-21';
  try {
    const r = await db.prepare('SELECT MIN(day) AS m FROM visits').first();
    if (r && r.m) firstDay = r.m;
  } catch { /* ใช้ค่าตั้งต้น */ }

  let from;
  let to;
  let excludedToday = false;
  if (n === 1 || daysParam === '1' || daysParam === 'today') {
    from = todayStr;
    to = todayStr;
  } else if (modeAll) {
    from = firstDay;
    to = includeToday ? todayStr : addDays(todayStr, -1);
    excludedToday = !includeToday;
  } else {
    to = includeToday ? todayStr : addDays(todayStr, -1);
    from = addDays(to, -(n - 1));
    excludedToday = !includeToday;
  }
  if (from > to) from = to;

  let prevFrom = null;
  let prevTo = null;
  if (wantCompare && !modeAll && n > 1) {
    prevTo = addDays(from, -1);
    prevFrom = addDays(prevTo, -(n - 1));
  }

  const part = String(url.searchParams.get('part') || '').trim().toLowerCase();
  const fresh = url.searchParams.get('fresh') === '1';

  // ส่วน Meta แยกเป็นคำขอที่สอง หน้าเว็บเรนเดอร์ส่วนหลักก่อนแล้วค่อยเติม
  // คำขอหลักไม่เรียก Meta เลย ตอบเร็ว
  if (part === 'meta') {
    return serveMetaPart(db, env, from, to, todayStr, fresh);
  }

  let main;
  try {
    const extFrom = addDays(from, -6); // เผื่อคำนวณ MA7 ตอนต้นช่วง
    const stmts = [
      db.prepare(
        `SELECT event, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people, COALESCE(SUM(value),0) AS value
           FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY event`
      ).bind(from, to),
      db.prepare(
        `SELECT day, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT session) AS sessions,
                SUM(CASE WHEN event = 'PageView' THEN 1 ELSE 0 END) AS pageviews,
                SUM(CASE WHEN event = 'Purchase' THEN 1 ELSE 0 END) AS orders
           FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY day ORDER BY day ASC`
      ).bind(extFrom, to),
      db.prepare(
        `SELECT CASE WHEN instr(path,'?')>0 THEN substr(path,1,instr(path,'?')-1) ELSE path END AS path, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people
           FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 AND event = 'PageView'
          GROUP BY CASE WHEN instr(path,'?')>0 THEN substr(path,1,instr(path,'?')-1) ELSE path END ORDER BY hits DESC LIMIT 12`
      ).bind(from, to),
      db.prepare(
        `SELECT COALESCE(NULLIF(source,''), NULLIF(referrer,''), 'เข้าตรง') AS src,
                COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people, COUNT(DISTINCT session) AS sessions
           FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY src ORDER BY hits DESC LIMIT 12`
      ).bind(from, to),
      db.prepare(
        `SELECT COALESCE(ua,'ไม่ทราบ') AS ua, COUNT(DISTINCT visitor) AS people
           FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY ua ORDER BY people DESC LIMIT 8`
      ).bind(from, to),
      db.prepare(
        `SELECT COUNT(*) AS pending, SUM(CASE WHEN fbclid IS NOT NULL THEN 1 ELSE 0 END) AS with_fbclid
           FROM visits WHERE sent_meta = 0 AND is_bot = 0`
      ),
      db.prepare('SELECT MIN(at) AS first_at, COUNT(*) AS all_rows FROM visits'),
      db.prepare(
        'SELECT COUNT(*) AS bots FROM visits WHERE day >= ? AND day <= ? AND is_bot = 1'
      ).bind(from, to),
      db.prepare(
        `WITH s AS (
           SELECT session, MAX(content) AS content
             FROM visits
            WHERE day >= ? AND day <= ? AND is_bot = 0 AND content IS NOT NULL
            GROUP BY session
         )
         SELECT s.content,
                COUNT(DISTINCT s.session) AS sessions,
                COUNT(DISTINCT CASE WHEN v.event = 'ViewContent' THEN v.visitor END) AS people_vc,
                COUNT(DISTINCT CASE WHEN v.event = 'InitiateCheckout' THEN v.visitor END) AS people_ic,
                SUM(CASE WHEN v.event = 'Purchase' THEN 1 ELSE 0 END) AS orders,
                COALESCE(SUM(CASE WHEN v.event = 'Purchase' THEN v.value ELSE 0 END), 0) AS revenue
           FROM s JOIN visits v ON v.session = s.session AND v.day >= ? AND v.day <= ? AND v.is_bot = 0
          GROUP BY s.content
          ORDER BY revenue DESC, orders DESC`
      ).bind(from, to, from, to),
      db.prepare(
        `SELECT meta_status, COUNT(*) AS cnt
           FROM visits WHERE day >= ? AND day <= ? AND meta_status IS NOT NULL
          GROUP BY meta_status`
      ).bind(from, to),
      db.prepare(
        `SELECT session, COUNT(*) AS pv FROM visits
          WHERE event = 'PageView' AND day >= ? AND day <= ? AND is_bot = 0 GROUP BY session`
      ).bind(from, to),
      db.prepare(
        `SELECT CAST((strftime('%H', at) + 7) % 24 AS INT) AS h, COUNT(*) AS hits,
                COUNT(DISTINCT visitor) AS people
           FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY h ORDER BY h ASC`
      ).bind(from, to),
      db.prepare(
        `SELECT strftime('%w', day) AS w, COUNT(DISTINCT visitor) AS people, COUNT(*) AS hits
           FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY w`
      ).bind(from, to),
      db.prepare(
        `SELECT visitor, MIN(day) AS first_day FROM visits
          WHERE is_bot = 0 AND day <= ? GROUP BY visitor`
      ).bind(to),
      db.prepare(
        `SELECT day, COUNT(*) AS hits FROM visits
          WHERE day = ? AND is_bot = 0`
      ).bind(todayStr),
    ];
    if (wantCompare) {
      stmts.push(
        db.prepare(
          `SELECT event, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS people, COALESCE(SUM(value),0) AS value
             FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY event`
        ).bind(prevFrom, prevTo),
      );
      stmts.push(
        db.prepare(
          `SELECT day, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT session) AS sessions,
                  SUM(CASE WHEN event = 'PageView' THEN 1 ELSE 0 END) AS pageviews,
                  SUM(CASE WHEN event = 'Purchase' THEN 1 ELSE 0 END) AS orders
             FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0 GROUP BY day ORDER BY day ASC`
        ).bind(prevFrom, prevTo),
      );
    }
    main = await db.batch(stmts);
  } catch (error) {
    const message = String((error && error.message) || error);
    if (/no such table/i.test(message)) {
      return bad('ยังไม่ได้สร้างตาราง visits รัน migrations ตามลำดับก่อน', 503);
    }
    return bad('อ่านสถิติไม่สำเร็จ: ' + message.slice(0, 200), 500);
  }

  const idx = {
    totals: 0, dailyExt: 1, pages: 2, sources: 3, browsers: 4, pending: 5,
    overall: 6, bots: 7, creatives: 8, capi: 9, bounce: 10, hours: 11,
    weekday: 12, firstSeen: 13, todayHits: 14,
  };
  const R = (i) => (main[i] && main[i].results) || [];
  const one = (i) => R(i)[0] || {};

  const totals = {};
  for (const row of R(idx.totals)) {
    totals[row.event] = { hits: row.hits, people: row.people, value: row.value };
  }
  let prevTotals = null;
  let prevDailyRows = [];
  if (wantCompare) {
    prevTotals = {};
    for (const row of R(15)) {
      prevTotals[row.event] = { hits: row.hits, people: row.people, value: row.value };
    }
    prevDailyRows = R(16);
  }

  // daily เติม 0 ครบทุกวัน + MA7 กราฟเริ่มที่วันแรกที่มีข้อมูล
  const extMap = new Map();
  for (const row of R(idx.dailyExt)) extMap.set(row.day, row);
  const chartFrom = from > firstDay ? from : firstDay; const safeChartFrom = chartFrom > to ? to : chartFrom; const extDays = eachDay(addDays(safeChartFrom, -6), to);
  const extVisitors = extDays.map((d) => Number((extMap.get(d) || {}).visitors || 0));
  const daily = eachDay(safeChartFrom, to).map((d) => {
    const row = extMap.get(d) || {};
    const pos = extDays.indexOf(d);
    // นับเฉพาะวันที่เริ่มเก็บข้อมูลแล้ว · วันก่อนหน้านั้นไม่ใช่ 0 คน แค่ยังไม่ได้เก็บ
    const win = extDays.slice(Math.max(0, pos - 6), pos + 1)
      .map((day, k) => (day >= firstDay ? extVisitors[Math.max(0, pos - 6) + k] : null))
      .filter((v) => v !== null);
    // ครบ 7 วันจริงต่อเมื่อหน้าต่างย้อนหลังไม่ล้ำวันแรกที่มีข้อมูล ล้ำคือเส้นประ
    const full = win.length === 7 && addDays(d, -6) >= firstDay;
    const ma7 = win.length ? Math.round((win.reduce((a, b) => a + b, 0) / win.length) * 10) / 10 : null;
    return {
      day: d,
      visitors: Number(row.visitors || 0),
      sessions: Number(row.sessions || 0),
      pageviews: Number(row.pageviews || 0),
      orders: Number(row.orders || 0),
      ma7,
      ma7full: full,
      isToday: d === todayStr,
    };
  });

  const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);
  const visitors = sum(daily, 'visitors'); // ผลรวมรายวัน อาจนับคนซ้ำข้ามวัน
  const sessions = sum(daily, 'sessions');
  const pageviews = sum(daily, 'pageviews');
  const purchaseHits = (totals.Purchase && totals.Purchase.hits) || 0;

  const single = countSingleFromRows(R(idx.bounce));
  const bounceTotal = (R(idx.bounce) || []).length;

  // query ที่ไม่พึ่งกันรันขนานกันหมด ไม่รอทีละตัวแบบเดิม
  // ผลลัพธ์เหมือนเดิมทุกฟิลด์ แค่รอพร้อมกัน
  const wantPrevExtra = wantCompare && !!prevTotals;
  const [
    distinctPeople,
    prevDistinct,
    prevSingle,
    money,
    prevMoney,
    stock,
    markers,
    paidSplit,
    revenueBySource,
    ordersByUtm,
  ] = await Promise.all([
    countDistinctVisitors(db, from, to),
    wantPrevExtra ? countDistinctVisitors(db, prevFrom, prevTo) : null,
    wantPrevExtra ? countSinglePageSessions(db, prevFrom, prevTo) : null,
    // เงินจริงจาก preorders ช่วงนี้ + ช่วงก่อน
    readMoney(db, from, to),
    wantCompare ? readMoney(db, prevFrom, prevTo) : null,
    // สต็อกกระเป๋าสะสม ไม่ผูกกับช่วงเวลา
    readStock(db),
    // markers แบบไม่ล้มถ้ายังไม่รัน migration
    readMarkers(db),
    // นิยามมาจากแอด: medium เท่ากับ paid เท่านั้น ไม่ใช่แค่มี fbclid
    readPaidSplit(db, from, to),
    readRevenueBySource(db, from, to),
    // ออเดอร์แยกตาม utm_campaign สำหรับจับคู่ค่าแอด
    readOrdersByUtm(db, from, to),
  ]);

  let prevK = null;
  if (wantPrevExtra) {
    const p = {};
    for (const row of prevDailyRows) p[row.day] = row;
    const pDays = eachDay(prevFrom, prevTo);
    prevK = {
      visitors: prevDistinct,
      sessions: pDays.reduce((a, d) => a + Number((p[d] || {}).sessions || 0), 0),
      pageviews: pDays.reduce((a, d) => a + Number((p[d] || {}).pageviews || 0), 0),
      purchaseHits: (prevTotals.Purchase && prevTotals.Purchase.hits) || 0,
      single: prevSingle,
    };
  }

  // ค่าแอด Meta กับเทียบ Meta แยกไปคำขอ part=meta หมด
  // คำขอหลักคืน null ไว้ หน้าเว็บค่อยเติม ไม่รอ Meta ก่อนตอบ
  const adSpend = null;
  const metaCompare = null;

  const newRet = countNewReturning(R(idx.firstSeen), from, to);

  const kpis = {
    visitors: kpi(distinctPeople !== null ? distinctPeople : visitors, prevK ? prevK.visitors : null, 30),
    sessions: kpi(sessions, prevK ? prevK.sessions : null, 30),
    pageviews: kpi(pageviews, prevK ? prevK.pageviews : null, 30),
    singlePage: {
      ...kpi(single, prevK ? prevK.single : null, 30),
      rate: bounceTotal ? Math.round((single / bounceTotal) * 1000) / 10 : 0,
      sessions: bounceTotal,
    },
    ordersPlaced: kpi(purchaseHits, prevK ? prevK.purchaseHits : null, 10),
    paidOrders: kpi(money ? money.paidCount : 0, prevMoney ? prevMoney.paidCount : (wantCompare ? 0 : null), 10),
    // กลุ่มเงิน (รายได้/AOV) ใช้เกณฑ์จำนวนออเดอร์ช่วงก่อน < 10 ตาม report ข้อ 2.2 ไม่ใช่ยอดเงิน
    paidRevenue: kpiMoney(money ? money.paidRevenue : 0, prevMoney ? prevMoney.paidRevenue : (wantCompare ? 0 : null), prevMoney ? prevMoney.paidCount : (wantCompare ? 0 : null)),
    aov: kpiMoney(money ? money.aov : 0, prevMoney ? prevMoney.aov : (wantCompare ? 0 : null), prevMoney ? prevMoney.paidCount : (wantCompare ? 0 : null)),
  };

  const funnel = buildFunnel(totals, prevTotals);
  const creatives = (R(idx.creatives) || []).map((row) => ({
    content: row.content,
    sessions: Number(row.sessions || 0),
    peopleVc: Number(row.people_vc || 0),
    peopleIc: Number(row.people_ic || 0),
    orders: Number(row.orders || 0),
    revenue: Number(row.revenue || 0),
    lowBase: (Number(row.sessions || 0)) < 30,
  }));

  const pending = one(idx.pending);
  const overall = one(idx.overall);
  const botsRow = one(idx.bots);
  let capiOk = 0;
  let capiErr = 0;
  for (const r of R(idx.capi)) {
    if (r.meta_status === 'ok') capiOk += r.cnt;
    else if (r.meta_status && String(r.meta_status).startsWith('err:')) capiErr += r.cnt;
  }

  // การ์ดวันนี้แยกใบเดียว
  const today = await readToday(db, todayStr, money ? money.byDay : null);

  const prevEmpty = wantCompare && (prevTo < firstDay || prevDailyRows.length === 0); const range = { from, to, prev_from: prevFrom, prev_to: prevTo, excluded_today: excludedToday };
  const compareNote = wantCompare
    ? 'เทียบ ' + formatThRange(from, to) + ' กับ ' + formatThRange(prevFrom, prevTo) + (prevEmpty ? ' · ช่วงก่อนยังไม่มีข้อมูล (เริ่มเก็บ ' + formatTh(firstDay) + ')' : '')
    : (modeAll ? 'ทั้งหมดตั้งแต่ ' + formatTh(firstDay) : 'ช่วง ' + formatThRange(from, to));

  return json({
    ok: true,
    days: modeAll ? 'all' : n, // คงพารามิเตอร์ days เดิมไว้ หน้าเก่ายังเรียกได้
    since: from, // คงไว้เผื่อโค้ดเก่า
    range,
    compare: wantCompare,
    compareNote,
    kpis,
    today,
    daily,
    funnel,
    adCreatives: R(idx.creatives) || [], // คงฟิลด์เดิมไว้
    creatives,
    byDay: R(idx.dailyExt) || [], // คงฟิลด์เดิมไว้
    topPages: R(idx.pages) || [],
    topSources: R(idx.sources) || [],
    browsers: R(idx.browsers) || [],
    revenueBySource,
    paidSplit,
    ordersByUtm,
    money,
    prevMoney,
    stock,
    adSpend,
    metaCompare,
    markers,
    byHour: normaliseHours(R(idx.hours)),
    byWeekday: normaliseWeekday(R(idx.weekday)),
    newReturning: newRet,
    totals, // คงฟิลด์เดิมไว้
    funnelLegacy: funnel,
    meta: {
      pending: pending.pending || 0,
      withFbclid: pending.with_fbclid || 0,
      firstAt: overall.first_at || null,
      allRows: overall.all_rows || 0,
      bots: botsRow.bots || 0,
      capiOk,
      capiErr,
    },
  });
}

const methodNotAllowed = () => bad('ใช้ได้เฉพาะการอ่านข้อมูล (GET)', 405);
export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;

/* ---------- KPI ---------- */

// เกณฑ์ฐานน้อยตาม report ข้อ 2.2: คน/session/เปิดหน้า prev < 30 ไม่แสดง %,
// ออเดอร์/รายได้ prev < 10 ออเดอร์ ไม่แสดง %
// moneyBlock บอกว่าเป็นกลุ่มเงิน ให้ดู prevOrders แทน prev ของตัวเอง
function kpi(value, prev, minPrev, isMoney) {
  const v = Number(value || 0);
  if (prev == null) return { value: v, prev: null, delta_pct: null, low_base: false };
  const p = Number(prev || 0);
  const threshold = isMoney === true ? 10 : minPrev;
  // กลุ่มเงินดูจำนวนออเดอร์caller ส่ง prev เป็นยอดเงินไม่ได้ เราแก้ที่ caller แล้ว ที่นี่เทียบตรง
  if (p < threshold) return { value: v, prev: p, delta_pct: null, low_base: true };
  if (p === 0) return { value: v, prev: p, delta_pct: null, low_base: true };
  const pct = Math.round(((v - p) / p) * 1000) / 10;
  return { value: v, prev: p, delta_pct: pct, low_base: false };
}

// กลุ่มเงิน (รายได้/AOV): เกณฑ์ฐานน้อยดูที่จำนวนออเดอร์ช่วงก่อน ไม่ใช่ยอดเงิน
function kpiMoney(value, prev, prevOrders) {
  const v = Number(value || 0);
  if (prev == null || prevOrders == null) return { value: v, prev: null, delta_pct: null, low_base: false };
  const p = Number(prev || 0);
  if (Number(prevOrders || 0) < 10) return { value: v, prev: p, delta_pct: null, low_base: true };
  if (p === 0) return { value: v, prev: p, delta_pct: null, low_base: v !== 0 };
  const pct = Math.round(((v - p) / p) * 1000) / 10;
  return { value: v, prev: p, delta_pct: pct, low_base: false };
}

/* ทางเดินลูกค้า เปิดเว็บ ดูสินค้า ใส่ตะกร้า เริ่มกรอก สั่งจริง
   rate = เทียบกับคนเปิดเว็บ, stepRate = เทียบกับขั้นก่อนหน้า
   อัตราย่อยซ่อนเมื่อตัวตั้งบวกตัวหารรวมน้อยกว่า 30 */
function buildFunnel(totals, prevTotals) {
  const steps = [
    ['PageView', 'เปิดเว็บ'],
    ['ViewContent', 'ดูสินค้า'],
    ['AddToCart', 'ใส่ตะกร้า'],
    ['InitiateCheckout', 'เริ่มกรอกฟอร์ม'],
    ['Purchase', 'สั่งสำเร็จ'],
  ];
  const first = (totals.PageView && totals.PageView.people) || 0;
  const prevFirst = (prevTotals && prevTotals.PageView && prevTotals.PageView.people) || 0;
  let prevPeople = null;
  let prevStepPeople = null;
  return steps.map(([event, label], i) => {
    const people = (totals[event] && totals[event].people) || 0;
    const hits = (totals[event] && totals[event].hits) || 0;
    const rate = first ? Math.round((people / first) * 1000) / 10 : 0;
    let stepRate = null;
    let stepLow = false;
    if (i > 0) {
      const denom = prevPeople || 0;
      if (denom > 0) {
        if (people + denom < 30) { stepRate = null; stepLow = true; }
        // ขั้นหลังมากกว่าขั้นก่อนได้ (คนข้ามขั้น) · โชว์ไม่เกิน 100% กันอ่านผิด
        else stepRate = Math.min(100, Math.round((people / denom) * 1000) / 10);
      }
    }
    let delta = null;
    let low = false;
    if (prevTotals) {
      const pp = (prevTotals[event] && prevTotals[event].people) || 0;
      const r = kpi(people, pp, 30);
      delta = r.delta_pct;
      low = r.low_base;
      if (i > 0 && prevStepPeople != null && prevFirst) {
        void prevFirst;
      }
    }
    prevPeople = people;
    if (prevTotals) prevStepPeople = (prevTotals[event] && prevTotals[event].people) || 0;
    return { event, label, people, hits, rate, stepRate, stepLowBase: stepLow, delta_pct: delta, low_base: low };
  });
}

function countSingleFromRows(rows) {
  let n = 0;
  for (const r of rows || []) if (Number(r.pv) === 1) n++;
  return n;
}

async function countSinglePageSessions(db, from, to) {
  try {
    const { results } = await db.prepare(
      `SELECT session, COUNT(*) AS pv FROM visits
        WHERE event = 'PageView' AND day >= ? AND day <= ? AND is_bot = 0 GROUP BY session`
    ).bind(from, to).all();
    return countSingleFromRows(results);
  } catch { return 0; }
}

async function countDistinctVisitors(db, from, to) {
  try {
    const r = await db.prepare(
      'SELECT COUNT(DISTINCT visitor) AS n FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0'
    ).bind(from, to).first();
    return Number((r && r.n) || 0);
  } catch { return null; }
}

/* ---------- เงินจริงจาก preorders ---------- */

async function readMoney(db, from, to) {
  // ลองคอลัมน์ day ก่อน ถ้าไม่มีค่อยใช้ created_at บวก 7 ชม เป็นวันไทย
  const attempts = [
    `SELECT status, slip_verified, total, items,
            COALESCE(day, substr(created_at,1,10)) AS d
       FROM preorders WHERE COALESCE(day, substr(created_at,1,10)) >= ? AND COALESCE(day, substr(created_at,1,10)) <= ?`,
    `SELECT status, slip_verified, total, items, date(created_at, '+7 hours') AS d
       FROM preorders WHERE date(created_at, '+7 hours') >= ? AND date(created_at, '+7 hours') <= ?`,
    `SELECT status, slip_verified, total, items, substr(created_at,1,10) AS d
       FROM preorders WHERE substr(created_at,1,10) >= ? AND substr(created_at,1,10) <= ?`,
  ];
  let rows = null;
  for (const sql of attempts) {
    try {
      const res = await db.prepare(sql).bind(from, to).all();
      rows = res.results || [];
      break;
    } catch (e) {
      const m = String((e && e.message) || e);
      if (/no such table/i.test(m)) return null;
      // no such column ลองสูตรถัดไป
      if (!/no such column/i.test(m)) return null;
    }
  }
  if (!rows) return null;
  let placedCount = 0;
  let placedRevenue = 0;
  let paidCount = 0;
  let paidRevenue = 0;
  let shirtUnits = 0;
  let bagUnits = 0;
  const bagByColor = { 'BAG-YELLOW': 0, 'BAG-RED': 0 };
  const byDay = {};
  for (const o of rows) {
    const status = String(o.status || '');
    const verified = Number(o.slip_verified || 0);
    const total = Number(o.total || 0);
    if (status === 'cancelled') continue;
    placedCount++;
    placedRevenue += total;
    const d = String(o.d || '');
    if (d) {
      byDay[d] = byDay[d] || { placed: 0, paid: 0, revenue: 0 };
      byDay[d].placed++;
    }
    if (verified === 1) {
      paidCount++;
      paidRevenue += total;
      if (d && byDay[d]) { byDay[d].paid++; byDay[d].revenue += total; }
    }
    try {
      const items = JSON.parse(o.items);
      if (Array.isArray(items)) {
        for (const it of items) {
          const code = it && it.size;
          const qty = Number.parseInt(it && it.qty, 10);
          if (!Number.isFinite(qty) || qty <= 0) continue;
          if (BAG_CODES.includes(code)) {
            bagUnits += qty;
            if (bagByColor[code] != null) bagByColor[code] += qty;
          } else if (code) {
            shirtUnits += qty;
          }
        }
      }
    } catch { /* แถว items เสียข้ามไป */ }
  }
  const aov = paidCount ? Math.round((paidRevenue / paidCount) * 100) / 100 : 0;
  return { placedCount, placedRevenue, paidCount, paidRevenue, aov, shirtUnits, bagUnits, bagByColor, byDay };
}

async function readStock(db) {
  try {
    const reserved = await reservedBags(db);
    return BAG_CODES.map((code) => {
      const total = Number(BAG_STOCK[code] || 0);
      const done = Number((reserved && reserved[code]) || 0);
      const left = Math.max(0, total - done);
      return {
        code,
        name: (BAG_TH && BAG_TH[code]) || code,
        total,
        reserved: done,
        left,
        pctReserved: total ? Math.round((done / total) * 1000) / 10 : 0,
      };
    });
  } catch { return []; }
}

async function readMarkers(db) {
  try {
    const res = await db.prepare('SELECT id, day, label FROM stat_markers ORDER BY day ASC, id ASC').all();
    return (res.results || []).map((r) => ({ id: r.id, day: r.day, label: r.label }));
  } catch (e) {
    // ยังไม่รัน migration ตารางไม่มี ต้องไม่ล้ม คืนว่าง
    return [];
  }
}

/* ---------- ที่มา paid ---------- */

async function readPaidSplit(db, from, to) {
  const sqls = [
    `SELECT
       SUM(CASE WHEN LOWER(COALESCE(medium,'')) = 'paid' THEN 1 ELSE 0 END) AS paid_hits,
       COUNT(DISTINCT CASE WHEN LOWER(COALESCE(medium,'')) = 'paid' THEN visitor END) AS paid_people,
       SUM(CASE WHEN event = 'Purchase' AND LOWER(COALESCE(medium,'')) = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
       COUNT(*) AS hits
       FROM visits WHERE day >= ? AND day <= ? AND is_bot = 0`,
  ];
  for (const sql of sqls) {
    try {
      const r = await db.prepare(sql).bind(from, to).first();
      return {
        paidHits: Number((r && r.paid_hits) || 0),
        paidPeople: Number((r && r.paid_people) || 0),
        paidOrders: Number((r && r.paid_orders) || 0),
      };
    } catch (e) {
      const m = String((e && e.message) || e);
      if (/no such column/i.test(m)) return { paidHits: 0, paidPeople: 0, paidOrders: 0, noMedium: true };
      return { paidHits: 0, paidPeople: 0, paidOrders: 0 };
    }
  }
  return { paidHits: 0, paidPeople: 0, paidOrders: 0 };
}

async function readRevenueBySource(db, from, to) {
  const withMedium =
    `SELECT COALESCE(NULLIF(source,''), NULLIF(referrer,''), 'เข้าตรง') AS src,
            COUNT(*) AS orders, COALESCE(SUM(value),0) AS revenue,
            SUM(CASE WHEN LOWER(COALESCE(medium,'')) = 'paid' THEN 1 ELSE 0 END) AS from_ads
       FROM visits WHERE day >= ? AND day <= ? AND event = 'Purchase' AND is_bot = 0
      GROUP BY src ORDER BY revenue DESC LIMIT 12`;
  const plain =
    `SELECT COALESCE(NULLIF(source,''), NULLIF(referrer,''), 'เข้าตรง') AS src,
            COUNT(*) AS orders, COALESCE(SUM(value),0) AS revenue, 0 AS from_ads
       FROM visits WHERE day >= ? AND day <= ? AND event = 'Purchase' AND is_bot = 0
      GROUP BY src ORDER BY revenue DESC LIMIT 12`;
  try {
    const res = await db.prepare(withMedium).bind(from, to).all();
    return res.results || [];
  } catch (e) {
    if (!/no such column/i.test(String((e && e.message) || e))) return [];
    try {
      const res = await db.prepare(plain).bind(from, to).all();
      return res.results || [];
    } catch { return []; }
  }
}

async function readOrdersByUtm(db, from, to) {
  const candidates = ['campaign', 'utm_campaign'];
  for (const col of candidates) {
    try {
      const res = await db.prepare(
        // นับเป็นออเดอร์ของแอดเฉพาะ medium = paid · ลิงก์ LINE/โพสต์ใช้ชื่อแคมเปญซ้ำกับแอดได้ ห้ามนับรวม
        `SELECT CASE WHEN medium = 'paid' THEN COALESCE(NULLIF(${col},''), '(แอดไม่ติด utm)') ELSE '(ไม่ได้มาจากแอด)' END AS utm,
                COUNT(*) AS orders, COALESCE(SUM(value),0) AS revenue
           FROM visits WHERE day >= ? AND day <= ? AND event = 'Purchase' AND is_bot = 0
          GROUP BY utm ORDER BY orders DESC LIMIT 20`
      ).bind(from, to).all();
      return { column: col, rows: res.results || [] };
    } catch (e) {
      if (!/no such column/i.test(String((e && e.message) || e))) return { column: null, rows: [] };
    }
  }
  return { column: null, rows: [] };
}

/* ---------- ส่วน Meta แยกคำขอ ---------- */

// GET /api/admin/visits?...&part=meta คืนแค่ {ok, adSpend, metaCompare, ordersByUtm}
// คำขอหลักไม่แตะ Meta เลย ส่วนนี้เรียก D1 แค่ ordersByUtm ตัวเดียวที่เหลือคือ Meta
async function serveMetaPart(db, env, from, to, todayStr, fresh) {
  // key รวมแค่ from/to ห้ามใส่ token ใน key
  const cacheKey = 'https://stats-meta.local/api/admin/visits-meta?from='
    + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
  const cache = getMetaCache();
  if (cache && !fresh) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return json(await hit.json());
    } catch { /* แคชพังก็ยิงใหม่ */ }
  }
  const [ordersByUtm, adSpendRaw, metaCompare] = await Promise.all([
    readOrdersByUtm(db, from, to),
    fetchAdSpend(env, from, to),
    fetchMetaCompare(env, db, from, to, todayStr).catch(() => null),
  ]);
  const body = {
    ok: true,
    adSpend: buildAdSpend(adSpendRaw, ordersByUtm),
    metaCompare,
    ordersByUtm,
  };
  if (cache) {
    try {
      // ช่วงที่มีวันนี้แคช 5 นาที นอกนั้น 10 นาที
      const ttl = to === todayStr ? 300 : 600;
      await cache.put(cacheKey, new Response(JSON.stringify(body), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=' + ttl,
        },
      }));
    } catch { /* เขียนแคชไม่ได้ก็ตอบปกติ */ }
  }
  return json(body);
}

function getMetaCache() {
  try {
    if (typeof caches !== 'undefined' && caches && caches.default) return caches.default;
  } catch { /* ไม่มี Cache API */ }
  return null;
}

/* ---------- ค่าแอด Meta ---------- */

function utmForCampaign(name) {
  if (!name) return { utm: null, label: '' };
  if (UTM_BY_EXACT_NAME[name]) {
    const utm = UTM_BY_EXACT_NAME[name];
    const found = UTM_BY_KEYWORD.find((k) => k.utm === utm);
    return { utm, label: found ? found.label : '' };
  }
  const low = String(name).toLowerCase();
  for (const row of UTM_BY_KEYWORD) {
    if (low.includes(String(row.key).toLowerCase())) return { utm: row.utm, label: row.label };
  }
  return { utm: null, label: '' };
}

async function appProof(secret, token) {
  const key = new TextEncoder().encode(secret);
  const msg = new TextEncoder().encode(token);
  const ck = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', ck, msg);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchAdSpend(env, from, to) {
  const token = env && env.META_CAPI_TOKEN;
  if (!token) return null;
  try {
    const timeRange = JSON.stringify({ since: from, until: to });
    const params = new URLSearchParams({
      level: 'campaign',
      time_range: timeRange,
      fields: 'campaign_name,spend,impressions,clicks',
      limit: '500',
      access_token: token,
    });
    if (env.META_APP_SECRET) {
      params.set('appsecret_proof', await appProof(env.META_APP_SECRET, token));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    let res;
    try {
      res = await fetch(`https://graph.facebook.com/v21.0/${META_ACCOUNT}/insights?` + params.toString(), {
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const data = await res.json();
    const rows = (data && data.data) || [];
    // กรองเฉพาะแคมเปญที่ขึ้นต้นด้วย KP
    return rows
      .filter((r) => String((r && r.campaign_name) || '').startsWith('KP'))
      .map((r) => ({
        campaign_name: String(r.campaign_name || ''),
        spend: Number(r.spend || 0),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.clicks || 0),
      }));
  } catch {
    return null; // ล้มหรือ timeout ให้หน้าเว็บซ่อนบล็อก cost/order เอง
  }
}

function buildAdSpend(rows, ordersByUtm) {
  if (!rows) return null; // ดึงไม่ได้ ให้หน้าเว็บโชว์ข้อความเล็กแทน
  const byUtm = new Map();
  for (const r of (ordersByUtm && ordersByUtm.rows) || []) {
    byUtm.set(String(r.utm || ''), Number(r.orders || 0));
  }
  // แคมเปญหลายตัวใช้ utm เดียวกันได้ (เช่นแคมเปญเสื้อตัวเก่ากับตัวใหม่)
  // ออเดอร์ผูกได้แค่ระดับ utm จึงคิดต้นทุนต่อออเดอร์จากค่าแอดรวมของทั้งกลุ่ม ไม่งั้นออเดอร์ถูกนับซ้ำทุกแถว
  const merged = new Map();
  for (const r of rows) {
    const key = r.campaign_name;
    const cur = merged.get(key) || { campaign_name: key, spend: 0, impressions: 0, clicks: 0 };
    cur.spend += Number(r.spend || 0);
    cur.impressions += Number(r.impressions || 0);
    cur.clicks += Number(r.clicks || 0);
    merged.set(key, cur);
  }
  const groupSpend = new Map();
  for (const r of merged.values()) {
    const u = utmForCampaign(r.campaign_name).utm || '';
    groupSpend.set(u, (groupSpend.get(u) || 0) + r.spend);
  }
  const campaigns = [...merged.values()].map((r) => {
    const m = utmForCampaign(r.campaign_name);
    const orders = m.utm ? Number(byUtm.get(m.utm) || 0) : 0;
    const gSpend = groupSpend.get(m.utm || '') || 0;
    return {
      ...r,
      spend: Math.round(r.spend * 100) / 100,
      utm: m.utm,
      label: m.label,
      orders,
      groupSpend: Math.round(gSpend * 100) / 100,
      costPerOrder: orders > 0 ? Math.round((gSpend / orders) * 100) / 100 : null,
    };
  }).sort((a, b) => b.spend - a.spend);
  const total = campaigns.reduce((a, c) => a + Number(c.spend || 0), 0);
  return { total: Math.round(total * 100) / 100, campaigns };
}

/* ---------- เทียบกับ Meta (แอด + Pixel) ---------- */

// เรียก Meta 3 ทางขนานกัน timeout รวม 5 วินาที ตัวไหนล้มคืน null เฉพาะตัวนั้น
async function fetchMetaCompare(env, db, from, to, todayStr) {
  const token = env && env.META_CAPI_TOKEN;
  if (!token) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const [insights, utmMap, pixelTotals, pixelSources] = await Promise.all([
      fetchMetaAdInsights(env, token, from, to, ctrl.signal).catch(() => null),
      fetchMetaAdUtm(env, token, ctrl.signal).catch(() => null),
      fetchMetaPixelStats(env, token, from, to, todayStr, ctrl.signal).catch(() => null),
      // Meta รับ event 2 ทาง (เบราว์เซอร์ + เซิร์ฟเวอร์) แล้วค่อยตัดซ้ำ · ยอด /stats คือก่อนตัดซ้ำ
      fetchMetaPixelStats(env, token, from, to, todayStr, ctrl.signal, 'event_source').catch(() => null),
    ]);
    const oursByContent = await readOursByContent(db, from, to).catch(() => null);
    const hitsByEvent = await readHitsByEvent(db, from, to).catch(() => null);
    const ads = insights ? buildMetaAds(insights, utmMap, oursByContent) : null;
    const pixel = pixelTotals ? buildMetaPixel(pixelTotals, hitsByEvent) : null;
    if (ads == null && pixel == null) return null;
    return { ads, pixel, pixelSources: pixelSources || null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function metaGet(env, token, path, params, signal) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  if (env.META_APP_SECRET) {
    qs.set('appsecret_proof', await appProof(env.META_APP_SECRET, token));
  }
  const res = await fetch('https://graph.facebook.com/v21.0/' + path + '?' + qs.toString(), { signal });
  if (!res.ok) throw new Error('meta ' + res.status);
  return res.json();
}

async function fetchMetaAdInsights(env, token, from, to, signal) {
  const data = await metaGet(env, token, META_ACCOUNT + '/insights', {
    level: 'ad',
    fields: 'campaign_name,ad_id,ad_name,spend,impressions,clicks,actions,action_values',
    time_range: JSON.stringify({ since: from, until: to }),
    filtering: JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: 'KP' }]),
    limit: '200',
  }, signal);
  return (data && data.data) || [];
}

// จับคู่แอดกับ utm_content จากลิงก์ใน creative ถ้าไม่มีใช้ชื่อแอดแทน
async function fetchMetaAdUtm(env, token, signal) {
  const data = await metaGet(env, token, META_ACCOUNT + '/ads', {
    fields: 'id,name,creative{object_story_spec}',
    filtering: JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: 'KP' }]),
    limit: '200',
  }, signal);
  const map = new Map();
  for (const ad of (data && data.data) || []) {
    const id = String((ad && ad.id) || '');
    if (!id) continue;
    let link = null;
    try {
      const spec = ad.creative && ad.creative.object_story_spec;
      link = spec && spec.link_data && spec.link_data.link;
    } catch { link = null; }
    map.set(id, parseUtmContent(link) || String((ad && ad.name) || ''));
  }
  return map;
}

function parseUtmContent(link) {
  if (!link) return null;
  try {
    const v = new URL(String(link)).searchParams.get('utm_content');
    return v && v.trim() ? v.trim() : null;
  } catch { return null; }
}

// ยอด Pixel รวมทุกชั่วโมงในช่วง ตาม paging ไม่เกิน 10 หน้า
async function fetchMetaPixelStats(env, token, from, to, todayStr, signal, aggregation = 'event') {
  const range = thaiRangeUnix(from, to, todayStr);
  const proof = env.META_APP_SECRET ? await appProof(env.META_APP_SECRET, token) : null;
  const first = new URLSearchParams({
    aggregation,
    start_time: String(range.start),
    end_time: String(range.end),
    access_token: token,
  });
  if (proof) first.set('appsecret_proof', proof);
  const totals = {};
  let url = 'https://graph.facebook.com/v21.0/' + META_PIXEL + '/stats?' + first.toString();
  for (let page = 0; page < 10; page++) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('pixel ' + res.status);
    const data = await res.json();
    for (const hour of (data && data.data) || []) {
      for (const ev of (hour && hour.data) || []) {
        const name = String((ev && ev.value) || '');
        if (!name) continue;
        totals[name] = (totals[name] || 0) + Number((ev && ev.count) || 0);
      }
    }
    const next = data && data.paging && data.paging.next;
    if (!next) break;
    url = next;
  }
  return totals;
}

// วันไทย 00:00 ถึง 23:59:59 ถ้าช่วงลงท้ายวันนี้ใช้ถึงเวลาปัจจุบัน
function thaiRangeUnix(from, to, todayStr) {
  const start = Math.floor(new Date(from + 'T00:00:00+07:00').getTime() / 1000);
  const end = (to === todayStr)
    ? Math.floor(Date.now() / 1000)
    : Math.floor(new Date(to + 'T23:59:59+07:00').getTime() / 1000);
  return { start, end };
}

function metaActionVal(list, type) {
  if (!Array.isArray(list)) return 0;
  for (const a of list) {
    if (a && a.action_type === type) return Number(a.value || 0);
  }
  return 0;
}

// ของเราผูกระดับ session แบบตาราง creatives เดิม บวกคนใส่ตะกร้า
async function readOursByContent(db, from, to) {
  const res = await db.prepare(
    `WITH s AS (
       SELECT session, MAX(content) AS content
         FROM visits
        WHERE day >= ? AND day <= ? AND is_bot = 0 AND content IS NOT NULL
        GROUP BY session
     )
     SELECT s.content,
            COUNT(DISTINCT s.session) AS sessions,
            COUNT(DISTINCT CASE WHEN v.event = 'ViewContent' THEN v.visitor END) AS vc,
            COUNT(DISTINCT CASE WHEN v.event = 'AddToCart' THEN v.visitor END) AS atc,
            COUNT(DISTINCT CASE WHEN v.event = 'InitiateCheckout' THEN v.visitor END) AS ic,
            SUM(CASE WHEN v.event = 'Purchase' THEN 1 ELSE 0 END) AS orders,
            COALESCE(SUM(CASE WHEN v.event = 'Purchase' THEN v.value ELSE 0 END), 0) AS revenue
       FROM s JOIN visits v ON v.session = s.session AND v.day >= ? AND v.day <= ? AND v.is_bot = 0
      GROUP BY s.content`
  ).bind(from, to, from, to).all();
  const map = new Map();
  for (const r of (res.results || [])) map.set(String(r.content || ''), r);
  return map;
}

async function readHitsByEvent(db, from, to) {
  const res = await db.prepare(
    `SELECT event,
            SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS ours,
            SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots
       FROM visits WHERE day >= ? AND day <= ? GROUP BY event`
  ).bind(from, to).all();
  const map = new Map();
  for (const r of (res.results || [])) map.set(String(r.event), r);
  return map;
}

function buildMetaAds(insights, utmMap, oursByContent) {
  const rows = (insights || []).map((r) => {
    const adId = String((r && (r.ad_id || r.adId)) || '');
    const utmContent = ((utmMap && utmMap.get(adId)) || String((r && r.ad_name) || ''));
    const meta = {
      spend: Number((r && r.spend) || 0),
      impressions: Number((r && r.impressions) || 0),
      clicks: Number((r && r.clicks) || 0),
      lpv: metaActionVal(r && r.actions, 'landing_page_view'),
      vc: metaActionVal(r && r.actions, 'offsite_conversion.fb_pixel_view_content'),
      atc: metaActionVal(r && r.actions, 'offsite_conversion.fb_pixel_add_to_cart'),
      ic: metaActionVal(r && r.actions, 'offsite_conversion.fb_pixel_initiate_checkout'),
      purchase: metaActionVal(r && r.actions, 'offsite_conversion.fb_pixel_purchase'),
      purchaseValue: metaActionVal(r && r.action_values, 'offsite_conversion.fb_pixel_purchase'),
    };
    const o = (oursByContent && oursByContent.get(utmContent)) || null;
    const ours = {
      sessions: Number((o && o.sessions) || 0),
      vc: Number((o && o.vc) || 0),
      atc: Number((o && o.atc) || 0),
      ic: Number((o && o.ic) || 0),
      orders: Number((o && o.orders) || 0),
      revenue: Number((o && o.revenue) || 0),
    };
    return {
      ad_id: adId,
      ad_name: String((r && r.ad_name) || ''),
      campaign_name: String((r && r.campaign_name) || ''),
      utm_content: utmContent,
      meta,
      ours,
      costPerLpv: meta.lpv > 0 ? Math.round((meta.spend / meta.lpv) * 100) / 100 : null,
      costPerOrder: ours.orders > 0 ? Math.round((meta.spend / ours.orders) * 100) / 100 : null,
    };
  });
  rows.sort((a, b) => Number(b.meta.spend || 0) - Number(a.meta.spend || 0));
  return rows;
}

const META_PIXEL_EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'];

function buildMetaPixel(totals, hitsByEvent) {
  return META_PIXEL_EVENTS.map((event) => {
    const meta = Number((totals && totals[event]) || 0);
    const row = (hitsByEvent && hitsByEvent.get(event)) || null;
    const ours = Number((row && row.ours) || 0);
    const bots = Number((row && row.bots) || 0);
    return {
      event,
      meta,
      ours,
      bots,
      ratio: ours > 0 ? Math.round((meta / ours) * 100) / 100 : null,
    };
  });
}

/* ---------- ใหม่/กลับมา ชั่วโมง วัน ---------- */

function countNewReturning(firstSeenRows, from, to) {
  let fresh = 0;
  let back = 0;
  for (const r of firstSeenRows || []) {
    const f = String((r && r.first_day) || '');
    if (!f) continue;
    if (f < from) { back++; continue; }
    if (f <= to) fresh++;
    else continue;
  }
  return { newVisitors: fresh, returningVisitors: back };
}

function normaliseHours(rows) {
  const out = Array.from({ length: 24 }, (_, h) => ({ h, hits: 0, people: 0 }));
  for (const r of rows || []) {
    const h = Number(r.h);
    if (Number.isInteger(h) && h >= 0 && h < 24) {
      out[h] = { h, hits: Number(r.hits || 0), people: Number(r.people || 0) };
    }
  }
  return out;
}

function normaliseWeekday(rows) {
  const names = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const map = new Map();
  for (const r of rows || []) map.set(String(r.w), r);
  return names.map((label, i) => {
    const r = map.get(String(i)) || {};
    return { w: String(i), label, hits: Number(r.hits || 0), people: Number(r.people || 0) };
  });
}

async function readToday(db, todayStr, moneyByDay) {
  try {
    const r = await db.prepare(
      `SELECT COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT session) AS sessions,
              SUM(CASE WHEN event = 'PageView' THEN 1 ELSE 0 END) AS pageviews,
              SUM(CASE WHEN event = 'Purchase' THEN 1 ELSE 0 END) AS orders
         FROM visits WHERE day = ? AND is_bot = 0`
    ).bind(todayStr).first();
    const paid = moneyByDay && moneyByDay[todayStr];
    return {
      day: todayStr,
      visitors: Number((r && r.visitors) || 0),
      sessions: Number((r && r.sessions) || 0),
      pageviews: Number((r && r.pageviews) || 0),
      orders: Number((r && r.orders) || 0),
      paidOrders: paid ? Number(paid.paid || 0) : 0,
      paidRevenue: paid ? Number(paid.revenue || 0) : 0,
    };
  } catch {
    return { day: todayStr, visitors: 0, sessions: 0, pageviews: 0, orders: 0, paidOrders: 0, paidRevenue: 0 };
  }
}

/* ---------- วันเวลา ---------- */

function clampDays(value) {
  const number = Number.parseInt(value || '30', 10);
  if (!Number.isFinite(number)) return 30;
  return Math.min(Math.max(number, 1), 365);
}

function thaiDayOffset(offsetDays) {
  const now = Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
  return new Date(now).toISOString().slice(0, 10);
}

function addDays(dayStr, n) {
  const d = new Date(dayStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function eachDay(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  let d = from;
  for (let i = 0; i < 1500 && d <= to; i++) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function formatTh(dayStr) {
  const [y, m, d] = String(dayStr || '').split('-').map(Number);
  if (!y || !m || !d) return String(dayStr || '');
  return d + ' ' + TH_MONTHS[m - 1];
}
function formatThRange(from, to) {
  if (from === to) return formatTh(from);
  return formatTh(from) + ' ถึง ' + formatTh(to);
}
