// Register platform icons for offline use — keyed by Iconify id in platforms.js.
import { addCollection } from '@iconify/svelte';
import { getIcons } from '@iconify/utils';
import { icons as simpleIcons } from '@iconify-json/simple-icons';
import { icons as lucideIcons } from '@iconify-json/lucide';
import { PLATFORMS } from '$lib/platforms.js';

const SOURCES = {
  'simple-icons': simpleIcons,
  lucide: lucideIcons
};

/** @type {Record<string, Set<string>>} */
const namesByPrefix = {};
for (const { icon } of Object.values(PLATFORMS)) {
  if (!icon) continue;
  const [prefix, name] = icon.split(':');
  if (!prefix || !name) continue;
  (namesByPrefix[prefix] ??= new Set()).add(name);
}

for (const [prefix, names] of Object.entries(namesByPrefix)) {
  const source = SOURCES[prefix];
  if (!source) continue;
  const subset = getIcons(source, [...names]);
  if (subset) addCollection(subset);
}
