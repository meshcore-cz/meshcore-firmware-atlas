// Server-only: scans the per-network area shapes (data/networks/<id>/area.geojson)
// and totals their sizes. These are published to static/network-area/<id>.geojson
// and fetched at runtime as one combined all.geojson — separate from the data.json
// bundle. Powers the "Network area shapes" section of the /bundle page.
import { statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import dataset from '$lib/generated/data.json';

const ROOT = process.cwd();

/**
 * Per-network GeoJSON footprint, ranked by source bytes, plus the size of the
 * combined all.geojson the map actually fetches in a single request.
 * @returns {{ items: Array<{id, name, href, bytes, areaKm2: number|null}>, total: number, count: number, combinedBytes: number|null }}
 */
export function geojsonSizes() {
  const items = [];
  let total = 0;

  for (const n of dataset.networks ?? []) {
    if (!n.area) continue;
    const path = join(ROOT, 'data', 'networks', n.id, n.area);
    let bytes;
    try {
      bytes = statSync(path).size;
    } catch {
      continue; // referenced file missing — skip
    }
    total += bytes;
    items.push({
      id: n.id,
      name: n.name ?? n.id,
      href: `/network/${n.id}/`,
      bytes,
      areaKm2: n.areaKm2 ?? null
    });
  }

  items.sort((a, b) => b.bytes - a.bytes);

  // The map loads every shape in one combined request (built by build-data.js).
  const combinedPath = join(ROOT, 'static', 'network-area', 'all.geojson');
  const combinedBytes = existsSync(combinedPath) ? statSync(combinedPath).size : null;

  return { items, total, count: items.length, combinedBytes };
}
