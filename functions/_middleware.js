// One canonical host: kuapapoh.pages.dev and www.kuapapoh.com → kuapapoh.com
// (301, keeps path + query). Preview URLs like <hash>.kuapapoh.pages.dev still
// serve the build so deploys can be checked.
const CANONICAL_HOST = 'kuapapoh.com';
const REDIRECT_HOSTS = new Set(['kuapapoh.pages.dev', 'www.kuapapoh.com']);

// Internal repo notes (admin passcode, D1 ids, SQL) must never be served,
// even if an old copy is still sitting in the edge cache.
const PRIVATE_PATH = /^\/(PROJECT_MEMORY\.md|wrangler(\.dev)?\.toml|README\.md|docs\/|migrations\/|scripts\/)/i;

export async function onRequest(context) {
  const url = new URL(context.request.url);
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
