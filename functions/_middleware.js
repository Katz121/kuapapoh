// kuapapoh.pages.dev → kuapapoh.com (301, keeps path + query)
// Only the production pages.dev host is redirected; preview URLs like
// <hash>.kuapapoh.pages.dev still serve the build so deploys can be checked.
const OLD_HOST = 'kuapapoh.pages.dev';
const NEW_HOST = 'kuapapoh.com';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === OLD_HOST) {
    url.protocol = 'https:';
    url.hostname = NEW_HOST;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
