import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import { software, getSoftware } from '$lib/data.js';
import { localizeRecord } from '$lib/catalog-overlay.js';

// Tell the static adapter which software pages to prerender.
export function entries() {
  return software.map((s) => ({ id: s.id }));
}

export async function load({ params, fetch }) {
  const meta = getSoftware(params.id);
  if (!meta) throw error(404, `Unknown software: ${params.id}`);

  // The global dataset omits release notes (the rendered changelog HTML used
  // only here); fetch the full per-record JSON for the releases section. That
  // JSON is the raw record, so it lacks the bundler-hashed asset URLs that
  // $lib/data.js resolves — overlay imageUrl/screenshotUrls from `meta`.
  const res = await fetch(`${base}/software/${params.id}.json`);
  const full = res.ok ? await res.json() : null;
  const item = full
    ? localizeRecord('software', {
        ...full,
        imageUrl: meta.imageUrl,
        screenshotUrls: meta.screenshotUrls
      })
    : meta;
  return { software: item };
}
