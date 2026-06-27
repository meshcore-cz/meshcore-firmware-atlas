import { software } from '$lib/data.js';
import { localizeCollection } from '$lib/catalog-overlay.js';

export function load() {
  return { software: localizeCollection('software', software) };
}
