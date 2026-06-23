import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import { software, getSoftware, groupReleases } from '$lib/data.js';

export function entries() {
  return software.map((s) => ({ id: s.id }));
}

export async function load({ params, fetch }) {
  const meta = getSoftware(params.id);
  if (!meta) throw error(404, `Unknown software: ${params.id}`);

  // The global dataset omits release notes (the rendered changelog HTML used
  // only on this page and the detail page); fetch the full per-record JSON.
  const res = await fetch(`${base}/software/${params.id}.json`);
  const item = res.ok ? await res.json() : meta;
  return { software: item, groups: groupReleases(item.releases) };
}
