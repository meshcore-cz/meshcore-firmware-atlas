import { firmwares } from '$lib/data.js';
import { localizeCollection } from '$lib/catalog-overlay.js';

export function load() {
  return { firmwares: localizeCollection('firmware', firmwares) };
}
