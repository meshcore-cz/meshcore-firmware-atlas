import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import { firmwares, getFirmware, getDevice } from '$lib/data.js';
import { localizeRecord } from '$lib/catalog-overlay.js';

// Tell the static adapter which firmware pages to prerender.
export function entries() {
  return firmwares.map((fw) => ({ id: fw.id }));
}

export async function load({ params, fetch }) {
  const meta = getFirmware(params.id);
  if (!meta) throw error(404, `Unknown firmware: ${params.id}`);

  // The global dataset omits release notes (~1MB of changelog HTML used only
  // here); fetch the full per-record JSON for the rendered release previews.
  const res = await fetch(`${base}/firmware/${params.id}.json`);
  const raw = res.ok ? await res.json() : meta;
  const firmware = localizeRecord('firmware', raw);

  const devices = (firmware.devices ?? []).map((d) => ({
    ...d,
    device: getDevice(d.id) ?? { id: d.id, name: d.id }
  }));

  return { firmware, devices };
}
