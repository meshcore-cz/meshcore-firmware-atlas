// Server-only load: compresses the bundle with node:zlib at prerender time, so
// the page can show gzip/zstd transfer sizes without shipping a compressor to
// the client. Mirrors exactly what build-data.js writes to static/data.min.json*.
import { gzipSync, zstdCompressSync } from 'node:zlib';
import dataset from '$lib/generated/data.json';
import { bundleSizeTree } from '$lib/bundleSize.js';
import { imageSizes } from '$lib/imageSizes.server.js';
import { geojsonSizes } from '$lib/geojsonSizes.server.js';
import { generatedAt } from '$lib/data.js';

export function load() {
  const minified = JSON.stringify(dataset);
  const compressed = {
    min: Buffer.byteLength(minified),
    gzip: gzipSync(minified, { level: 9 }).length,
    zstd: zstdCompressSync(minified).length
  };
  return { ...bundleSizeTree(), generatedAt, compressed, images: imageSizes(), geojson: geojsonSizes() };
}
