/* ═══════════════════════════════════════════════════════════
   ตัวนับสถิติของกั่วป่าโพ้ (kuapapoh.com)

   ทำสองอย่างในตัวเดียว
   1. เก็บสถิติของเราเอง ส่งเข้า /api/track → ฐานข้อมูล D1 · ทำงานทันทีไม่ต้องรออะไร
   2. ถ้าใส่ Meta Pixel ID ข้างล่างแล้ว จะยิงเข้า Meta เพิ่มอีกทางพร้อมกัน

   ใส่ Pixel ID บรรทัดเดียวจบ · ปล่อยว่างไว้ก็ยังนับของเราเองได้ตามปกติ
   วิธีหา ID: Meta Events Manager → เลือก Dataset → คัดลอกตัวเลขใต้ชื่อ

   ทุก event มี eventId ติดไปด้วย · วันที่มี Pixel แล้วอยากส่งของเก่าย้อนเข้า Meta
   ผ่าน Conversions API จะไม่ถูกนับซ้ำกับที่ Pixel ยิงสดๆ
   ═══════════════════════════════════════════════════════════ */
(function () {
  // ใช้แค่ Pixel B (1621493986432899) ในบัญชีแอด punkam
  // ตัด A (1560330288622338) ออกแล้ว เพราะไม่มีแคมเปญไหนใช้ ข้อมูลที่ส่งเข้าไปจึงเสียเปล่า
  var PIXEL_IDS = ['1621493986432899'];
  var PIXEL_ID = PIXEL_IDS[0] || '';

  var ENDPOINT = '/api/track';
  var storage = {
    // เบราว์เซอร์บางตัวปิด localStorage ไว้ · อ่านไม่ได้ก็ต้องไม่พังทั้งหน้า
    get: function (area, key) {
      try { return window[area].getItem(key) || ''; } catch (error) { return ''; }
    },
    set: function (area, key, value) {
      try { window[area].setItem(key, value); } catch (error) { /* ปิดไว้ก็ช่างมัน */ }
    }
  };

  function uid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (error) { /* ตกไปใช้ตัวสำรองข้างล่าง */ }
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function keep(area, key) {
    var value = storage.get(area, key);
    if (!value) { value = uid(); storage.set(area, key, value); }
    return value;
  }

  // อ่าน cookie ตามชื่อ · ใช้กับ _fbp, _fbc ที่ Meta Pixel ตั้งไว้
  function getCookie(name) {
    try {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) { return ''; }
  }

  var visitor = keep('localStorage', 'kp_vid');    // คนเดิมกลับมาอีกวันก็ยังเป็นไอดีเดิม
  var session = keep('sessionStorage', 'kp_sid');  // ปิดแท็บแล้วเริ่มรอบใหม่

  var params = new URLSearchParams(location.search);
  // fbclid ติดมากับลิงก์ที่กดจากเฟซบุ๊ก · เก็บไว้ทั้งรอบ เพราะคนมักกดเข้าหน้าแรกก่อนแล้วค่อยไปสั่ง
  var fbclid = params.get('fbclid') || storage.get('sessionStorage', 'kp_fbclid') || '';
  if (params.get('fbclid')) storage.set('sessionStorage', 'kp_fbclid', fbclid);

  var campaign = {
    source: params.get('utm_source') || storage.get('sessionStorage', 'kp_src') || '',
    medium: params.get('utm_medium') || storage.get('sessionStorage', 'kp_med') || '',
    campaign: params.get('utm_campaign') || storage.get('sessionStorage', 'kp_cmp') || '',
    // เก็บ utm_content เพื่อรู้ว่าภาพแอดไหนพาคนเข้ามา
    content: params.get('utm_content') || storage.get('sessionStorage', 'kp_cnt') || ''
  };
  if (params.get('utm_source')) {
    storage.set('sessionStorage', 'kp_src', campaign.source);
    storage.set('sessionStorage', 'kp_med', campaign.medium);
    storage.set('sessionStorage', 'kp_cmp', campaign.campaign);
  }
  // utm_content อาจมาโดยไม่มี utm_source (เช่น ลิงก์ที่ใส่แค่ content เพื่อแยกภาพ)
  if (params.get('utm_content')) {
    storage.set('sessionStorage', 'kp_cnt', campaign.content);
  }

  // ตรวจว่าเป็นบอท (navigator.webdriver = true ใน Headless Chrome, Puppeteer ฯลฯ)
  var isWebdriver = navigator.webdriver === true;

  function sendOurs(eventName, options) {
    var payload = {
      event: eventName,
      eventId: options.eventId,
      visitor: visitor,
      session: session,
      path: location.pathname + location.search.slice(0, 120),
      referrer: document.referrer || '',
      source: campaign.source,
      medium: campaign.medium,
      campaign: campaign.campaign,
      content: campaign.content,
      fbclid: fbclid,
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
      wd: isWebdriver,
      value: options.value,
      currency: options.value ? 'THB' : '',
      orderId: options.orderId || '',
      // สินค้าที่เกี่ยวกับ event นี้ · server ตรวจ whitelist เอง · ไม่มีมาก็ไม่เป็นไร
      contentIds: options.contentIds,
      numItems: options.numItems
    };
    var text = JSON.stringify(payload);
    try {
      // sendBeacon ส่งต่อได้แม้ผู้ใช้กดปิดแท็บทันที · เหมาะกับ Purchase ที่ยิงตอนกำลังเปลี่ยนหน้า
      if (navigator.sendBeacon) {
        var blob = new Blob([text], { type: 'application/json' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: text,
        keepalive: true
      }).catch(function () { /* นับไม่ได้ ดีกว่าหน้าเว็บสะดุด */ });
    } catch (error) { /* เช่นเดียวกัน */ }
  }

  window.KUAPAPOH_PIXEL_ID = PIXEL_ID;

  if (PIXEL_ID) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    PIXEL_IDS.forEach(function (id) { fbq('init', id); });
  }

  /**
   * ยิง event · ใช้จากหน้าไหนก็ได้ เช่น kpTrack('AddToCart', { value: 350 })
   * ส่งเข้าที่เก็บของเราเสมอ และส่งเข้า Meta ด้วยถ้าใส่ ID ไว้
   */
  window.kpTrack = function (eventName, params) {
    var options = params || {};
    var eventId = options.eventID || uid();
    try {
      sendOurs(eventName, {
        eventId: eventId,
        value: options.value,
        orderId: options.orderId || options.order_id,
        // รับทั้ง snake_case (ที่หน้าเว็บส่งมา) และ camelCase · ส่งต่อให้ server ทางเดียว ไม่เข้า fbq
        contentIds: options.content_ids || options.contentIds,
        numItems: options.num_items || options.numItems
      });
    } catch (error) { /* ไม่ให้ tracking ทำให้หน้าเว็บสะดุด */ }
    if (!PIXEL_ID) return;
    // บอท (webdriver) ไม่ต้องยิง fbq · ยังส่งเข้า /api/track เพื่อให้ server ติดธงบอทได้
    if (isWebdriver) return;
    try {
      var forMeta = {};
      for (var key in options) {
        // orderId ส่งแยกแล้ว · contentIds/numItems เป็นของ server ไม่ต้องเข้า fbq
        if (Object.prototype.hasOwnProperty.call(options, key) && key !== 'orderId' && key !== 'contentIds' && key !== 'numItems') forMeta[key] = options[key];
      }
      forMeta.currency = forMeta.currency || 'THB';
      // eventID เดียวกับที่เก็บฝั่งเรา · ส่งย้อนเข้า Conversions API ทีหลังแล้วไม่นับซ้ำ
      fbq('track', eventName, forMeta, { eventID: eventId });
    } catch (error) { /* เช่นเดียวกัน */ }
  };

  window.kpTrack('PageView');

  // หน้าไหนยิง event ก่อนไฟล์นี้โหลดเสร็จ จะฝากไว้ใน kpPending · เก็บให้ครบตรงนี้
  var pending = window.kpPending || [];
  window.kpPending = { push: function (item) { window.kpTrack(item[0], item[1]); } };
  for (var i = 0; i < pending.length; i++) {
    try { window.kpTrack(pending[i][0], pending[i][1]); } catch (error) { /* ข้ามตัวที่พัง */ }
  }
})();
