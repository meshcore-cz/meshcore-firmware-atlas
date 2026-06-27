// Server hook (runs at build/prerender time on this static site). Paraglide's
// middleware resolves the active locale from the request URL so getLocale() and
// the message functions work during prerendering, and transformPageChunk fills
// the <html lang="%lang%"> placeholder in app.html per page.
import { paraglideMiddleware } from '$lib/paraglide/server.js';
import { getTextDirection } from '$lib/paraglide/runtime.js';

/** @type {import('@sveltejs/kit').Handle} */
export const handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;
    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale))
    });
  });
