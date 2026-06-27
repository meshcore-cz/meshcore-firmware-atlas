// Universal reroute: map a localized URL (e.g. /cs/devices/) onto the existing
// base-locale route (/devices/) so a single set of route files serves every
// locale. Runs both client-side and during prerender.
import { deLocalizeUrl } from '$lib/paraglide/runtime.js';
import { resolveDevicesCanonical } from '$lib/route-path.js';

/** @type {import('@sveltejs/kit').Reroute} */
export function reroute(request) {
  return resolveDevicesCanonical(deLocalizeUrl(request.url).pathname);
}
