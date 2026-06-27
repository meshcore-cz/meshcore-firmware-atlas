// Catalog collections — labels, routes, icons and where each appears in the UI.
import { m } from '$lib/paraglide/messages.js';
import RadioTower from '@lucide/svelte/icons/radio-tower';
import CodeXml from '@lucide/svelte/icons/code-xml';
import CircuitBoard from '@lucide/svelte/icons/circuit-board';
import FileCog from '@lucide/svelte/icons/file-cog';
import Factory from '@lucide/svelte/icons/factory';

/** @typedef {'networks' | 'software' | 'devices' | 'firmwares' | 'vendors'} CollectionId */

/** @type {Record<CollectionId, { id: CollectionId, label: string, href: string, icon: import('svelte').Component, blurb: string, home: boolean, nav: boolean }>} */
export const COLLECTIONS = {
  networks: {
    id: 'networks',
    label: 'Networks',
    href: '/networks/',
    icon: RadioTower,
    blurb: 'Regional & national meshes — radio settings, coverage and how to join.',
    home: true,
    nav: true
  },
  software: {
    id: 'software',
    label: 'Software',
    href: '/software/',
    icon: CodeXml,
    blurb: 'Clients, integrations, gateways, monitoring, utilities, bots and libraries for the network.',
    home: true,
    nav: true
  },
  devices: {
    id: 'devices',
    label: 'Devices',
    href: '/devices/',
    icon: CircuitBoard,
    blurb: 'LoRa hardware that runs MeshCore — specs, radios and node roles.',
    home: true,
    nav: true
  },
  firmwares: {
    id: 'firmwares',
    label: 'Firmwares',
    href: '/firmwares/',
    icon: FileCog,
    blurb: 'The reference build plus community forks and custom variants.',
    home: true,
    nav: true
  },
  vendors: {
    id: 'vendors',
    label: 'Vendors',
    href: '/vendors/',
    icon: Factory,
    blurb: 'Hardware makers whose boards run MeshCore firmware.',
    home: false,
    nav: false
  }
};

/** Primary catalog sections on the home page, in display order. */
export const HOME_COLLECTIONS = ['networks', 'software', 'devices', 'firmwares'].map(
  (id) => COLLECTIONS[id]
);

/** Collections linked from the main site nav, in display order. */
export const NAV_COLLECTIONS = ['networks', 'software', 'devices', 'firmwares'].map(
  (id) => COLLECTIONS[id]
);

/** @param {CollectionId | string | null | undefined} id */
export function collectionById(id) {
  return id ? (COLLECTIONS[id] ?? null) : null;
}

/**
 * Localized label for a collection. Falls back to the English label baked into
 * COLLECTIONS if no message exists for the id.
 * @param {CollectionId | string} id
 */
export function collectionLabel(id) {
  return m[`collection_${id}_label`]?.() ?? COLLECTIONS[id]?.label ?? String(id);
}

/**
 * Localized blurb for a collection.
 * @param {CollectionId | string} id
 */
export function collectionBlurb(id) {
  return m[`collection_${id}_blurb`]?.() ?? COLLECTIONS[id]?.blurb ?? '';
}
