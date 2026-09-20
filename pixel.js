/* ═══════════════════════════════════════════════════════════
   Meta Pixel · กั่วป่าโพ้ (kuapapoh.com)
   ใส่ Pixel ID ที่บรรทัดล่างบรรทัดเดียวจบ ทั้งเว็บจะเริ่มเก็บข้อมูลทันที
   ID ว่าง = สคริปต์ไม่ทำอะไรเลย (ไม่มี error ไม่มีคำขอออกนอกเว็บ)
   วิธีหา ID: Meta Events Manager → เลือก Dataset → คัดลอกตัวเลขใต้ชื่อ
   ═══════════════════════════════════════════════════════════ */
(function () {
  var PIXEL_ID = '';   // ← ใส่ตัวเลข Pixel ID ตรงนี้ เช่น '1234567890123456'

  window.kpTrack = function () {};          // ตัวสำรอง กันหน้าเว็บพังถ้ายังไม่ได้ใส่ ID
  window.KUAPAPOH_PIXEL_ID = PIXEL_ID;
  if (!PIXEL_ID) return;

  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
  (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  // ยิง event มาตรฐาน · ใช้จากหน้าไหนก็ได้: kpTrack('AddToCart', {value:350})
  window.kpTrack = function (eventName, params) {
    try {
      fbq('track', eventName, Object.assign({ currency: 'THB' }, params || {}));
    } catch (error) {
      /* ไม่ให้ tracking ทำให้หน้าเว็บสะดุด */
    }
  };
})();
