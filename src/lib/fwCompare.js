// Firmware comparison selection. Mirrors compare.js (devices) but with its own
// sessionStorage key so the two selections don't collide.
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'atlas:fwcompare';

function initial() {
  if (!browser) return [];
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export const fwCompareIds = writable(initial());

if (browser) {
  fwCompareIds.subscribe((ids) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      // ignore quota / privacy-mode errors
    }
  });
}

export function toggleFwCompare(id) {
  fwCompareIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
}

export function clearFwCompare() {
  fwCompareIds.set([]);
}
