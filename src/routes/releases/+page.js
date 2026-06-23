import { allReleases } from '$lib/data.js';

export function load() {
  // Every release group across all firmwares and software, newest first.
  return { releases: allReleases() };
}
