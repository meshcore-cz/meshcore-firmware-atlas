// Runtime catalog overlay resolution — load locale bundles and apply translations
// without duplicating the canonical English catalog.
import dataset from '$lib/generated/data.json';
import { getLocale, baseLocale } from '$lib/paraglide/runtime.js';
import {
  resolveOverlayPath,
  applyResourceOverlay,
  applyRepeaterCommandsOverlay
} from '$lib/catalog-i18n/merge.js';
import { resourceKey, singularKind } from '$lib/catalog-i18n/keys.js';
import { COMMAND_GROUPS, COMMAND_FLAGS } from '$lib/repeaterCommands.js';

const overlayModules = import.meta.glob('$lib/generated/overlays/*.json', {
  eager: true,
  import: 'default'
});

/** @type {Map<string, Record<string, unknown>>} */
const overlayCache = new Map();

/**
 * Load the runtime overlay bundle for a locale (compact, hash-free).
 * @param {string} [locale]
 * @returns {Record<string, unknown>|null}
 */
export function getOverlay(locale = getLocale()) {
  if (locale === baseLocale) return null;
  if (overlayCache.has(locale)) return overlayCache.get(locale) ?? null;

  const mod =
    overlayModules[`/src/lib/generated/overlays/${locale}.json`] ??
    overlayModules[`../../src/lib/generated/overlays/${locale}.json`];

  const overlay = mod ?? null;
  overlayCache.set(locale, overlay);
  return overlay;
}

/**
 * Resolve a single translated field from the overlay bundle.
 *
 * @param {string} resource Resource key, e.g. `software/mc-webui`
 * @param {string} path Field path, e.g. `description` or `screenshots.main-window.png.caption`
 * @param {string} [fallback] English source value when no translation exists
 * @param {string} [locale]
 * @returns {string}
 */
export function getTranslatedField(resource, path, fallback = '', locale = getLocale()) {
  if (locale === baseLocale) return fallback;
  const bundle = getOverlay(locale);
  const resources = bundle?.resources;
  if (!resources || typeof resources !== 'object') return fallback;
  const entry = resources[resource];
  if (!entry || typeof entry !== 'object') return fallback;
  return resolveOverlayPath(entry, path) ?? fallback;
}

/** @param {string} slug software capability enum slug */
export function softwareCapabilityLabel(slug, locale = getLocale()) {
  const fallback = dataset.taxonomy?.softwareCapabilities?.[slug] ?? slug;
  return getTranslatedField('taxonomy', `softwareCapabilities.${slug}`, fallback, locale);
}

/** @param {string} firmwareId @param {string} deviceId @param {string} [fallback] @param {string} [locale] */
export function firmwareDeviceNote(firmwareId, deviceId, fallback = '', locale = getLocale()) {
  if (!fallback) return fallback;
  return getTranslatedField(`firmware/${firmwareId}`, `deviceNotes.${deviceId}`, fallback, locale);
}

/**
 * Apply the locale overlay to a catalog record (shallow collections preserved).
 *
 * @param {string} kind Collection kind, e.g. `software`, `device`, `firmware`
 * @param {Record<string, unknown>} record Canonical English record
 * @param {string} [locale]
 * @param {{ firmwareId?: string, firmwareVersion?: string, deviceId?: string }} [ctx]
 * @returns {Record<string, unknown>}
 */
export function localizeRecord(kind, record, locale = getLocale(), ctx = {}) {
  if (!record || locale === baseLocale) return record;
  const bundle = getOverlay(locale);
  const resources = bundle?.resources;
  if (!resources || typeof resources !== 'object') return record;
  const key = resourceKey(kind, record, ctx);
  const entry = resources[key];
  if (!entry || typeof entry !== 'object') return record;
  return applyResourceOverlay(record, entry);
}

/**
 * Localize every record in a catalog collection.
 * @param {string} kind
 * @param {Record<string, unknown>[]} records
 * @param {string} [locale]
 */
export function localizeCollection(kind, records, locale = getLocale()) {
  return records.map((record) => localizeRecord(kind, record, locale));
}

/**
 * Apply locale overlay to repeater command groups and flag legend.
 * @param {typeof COMMAND_GROUPS} groups
 * @param {typeof COMMAND_FLAGS} flags
 * @param {string} [locale]
 */
export function localizeRepeaterCommandsCatalog(groups, flags, locale = getLocale()) {
  if (locale === baseLocale) return { groups, flags };
  const bundle = getOverlay(locale);
  const resources = bundle?.resources;
  if (!resources || typeof resources !== 'object') return { groups, flags };
  const entry = resources['repeater-commands'];
  if (!entry || typeof entry !== 'object') return { groups, flags };
  return applyRepeaterCommandsOverlay(groups, flags, entry);
}

export { resourceKey, singularKind } from '$lib/catalog-i18n/keys.js';
