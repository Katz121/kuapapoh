// One canonical host: kuapapoh.pages.dev and www.kuapapoh.com → kuapapoh.com
// (301, keeps path + query). Preview URLs like <hash>.kuapapoh.pages.dev still
// serve the build so deploys can be checked.
const CANONICAL_HOST = 'kuapapoh.com';
const REDIRECT_HOSTS = new Set(['kuapapoh.pages.dev', 'www.kuapapoh.com']);

// Internal repo notes (admin passcode, D1 ids, SQL) must never be served,
// even if an old copy is still sitting in the edge cache.
const PRIVATE_PATH = /^\/(PROJECT_MEMORY\.md|wrangler(\.dev)?\.toml|README\.md|docs\/|migrations\/|scripts\/)/i;

// ไฟล์ยืนยันเจ้าของ kuapapoh.pages.dev ใน Google Search Console (ใช้ทำ Change of Address → kuapapoh.com)
// ตอบตรงจากตรงนี้ทุก host · ห้ามโดน 301 ไม่งั้น Google ยืนยันไม่ผ่าน
const GSC_VERIFY_PATH = '/googlee5f5b3a808fac39a.html';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === GSC_VERIFY_PATH) {
    return new Response('google-site-verification: googlee5f5b3a808fac39a.html', {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (PRIVATE_PATH.test(url.pathname)) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  }
  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.protocol = 'https:';
    url.hostname = CANONICAL_HOST;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
