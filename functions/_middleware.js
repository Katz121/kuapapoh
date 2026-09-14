// One canonical host: kuapapoh.pages.dev and www.kuapapoh.com → kuapapoh.com
// (301, keeps path + query). Preview URLs like <hash>.kuapapoh.pages.dev still
// serve the build so deploys can be checked.
const CANONICAL_HOST = 'kuapapoh.com';
const REDIRECT_HOSTS = new Set(['kuapapoh.pages.dev', 'www.kuapapoh.com']);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.protocol = 'https:';
    url.hostname = CANONICAL_HOST;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
