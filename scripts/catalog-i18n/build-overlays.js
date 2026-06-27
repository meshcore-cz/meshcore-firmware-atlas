import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import Ajv from 'ajv/dist/2020.js';
import { loadI18nConfig } from '../route-slugs.js';
import { sourceHash, SOURCE_HASH_RE } from '../../src/lib/catalog-i18n/source-hash.js';
import {
  extractTranslatableFields,
  fieldsToResourceOverlay,
  isSupportedFieldPath,
  resourceKey
} from '../../src/lib/catalog-i18n/fields.js';
import { COMMAND_GROUPS, COMMAND_FLAGS } from '../../src/lib/repeaterCommands.js';

export const SOURCES_DIR = 'data/i18n/sources';

/**
 * @param {string} root
 * @param {string} locale
 * @param {string} kind
 * @param {string} id
 */
export function sourceFilePath(root, locale, kind, id) {
  return join(root, SOURCES_DIR, locale, kind, `${id}.json`);
}

/**
 * @param {string} root
 * @param {string} locale
 */
export function loadTranslationSource(root, locale, kind, id) {
  const path = sourceFilePath(root, locale, kind, id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * @param {Record<string, unknown>} source
 * @param {import('ajv').ValidateFunction} validate
 * @param {string} where
 * @param {(where: string, msg: string) => void} err
 */
export function validateTranslationSource(source, validate, where, err) {
  if (!validate(source)) {
    for (const e of validate.errors ?? []) {
      err(where, `${e.instancePath || '/'} ${e.message}`);
    }
    return false;
  }

  if ('generatedAt' in source || 'model' in source) {
    err(where, 'document-level generatedAt/model are not allowed; set them on each field');
    return false;
  }

  const fields = source.fields ?? {};
  const paths = Object.keys(fields);
  const dupes = paths.filter((p, i) => paths.indexOf(p) !== i);
  if (dupes.length) {
    err(where, `duplicate field paths: ${[...new Set(dupes)].join(', ')}`);
    return false;
  }

  for (const [path, entry] of Object.entries(fields)) {
    if (!isSupportedFieldPath(path)) {
      err(where, `unsupported field path "${path}"`);
      continue;
    }
    if (!entry || typeof entry !== 'object') {
      err(where, `field "${path}" must be an object`);
      continue;
    }
    const hash = entry.sourceHash;
    if (typeof hash !== 'string' || !SOURCE_HASH_RE.test(hash)) {
      err(where, `field "${path}" has invalid sourceHash`);
    }
    if (typeof entry.value !== 'string') {
      err(where, `field "${path}" value must be a string`);
    }
    if (typeof entry.generatedAt !== 'string' || !entry.generatedAt) {
      err(where, `field "${path}" missing generatedAt`);
    }
    if (typeof entry.model !== 'string' || !entry.model) {
      err(where, `field "${path}" missing model`);
    }
    for (const key of ['durationMs', 'promptTokens', 'completionTokens']) {
      const n = entry[key];
      if (n === undefined) continue;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
        err(where, `field "${path}" ${key} must be a non-negative integer`);
      }
    }
  }

  return true;
}

/**
 * Build current runtime overlay entries from translation sources.
 * @param {Record<string, unknown>} canonicalFields path → { value, sourceHash }
 * @param {Record<string, { value: string, sourceHash: string }>} sourceFields
 */
export function currentOverlayFields(canonicalFields, sourceFields) {
  /** @type {Record<string, { value: string }>} */
  const current = {};

  for (const [path, { value, sourceHash: expected }] of Object.entries(canonicalFields)) {
    const translated = sourceFields[path];
    if (!translated) continue;
    if (translated.sourceHash !== expected) continue;
    if (typeof translated.value !== 'string') continue;
    current[path] = { value: translated.value };
  }

  return current;
}

/**
 * @param {{
 *   root: string,
 *   locale: string,
 *   collections: Record<string, Array<{ id: string, record: Record<string, unknown>, ctx?: Record<string, string> }>>,
 *   generatedAt?: string
 * }} opts
 */
export function buildRuntimeOverlay({ root, locale, collections, generatedAt = new Date().toISOString() }) {
  /** @type {Record<string, unknown>} */
  const resources = {};

  for (const [kind, items] of Object.entries(collections)) {
    for (const { id, record, ctx } of items) {
      const canonical = extractTranslatableFields(kind, record, ctx);
      const canonicalMap = Object.fromEntries(canonical.map((f) => [f.path, f]));

      const source = loadTranslationSource(root, locale, pluralKind(kind), id);
      const sourceFields = source?.fields ?? {};

      const current = currentOverlayFields(
        Object.fromEntries(canonical.map((f) => [f.path, { value: f.value, sourceHash: f.sourceHash }])),
        sourceFields
      );

      if (!Object.keys(current).length) continue;
      const key = resourceKey(kind, record, ctx);
      resources[key] = fieldsToResourceOverlay(current);
    }
  }

  return {
    schemaVersion: 1,
    locale,
    generatedAt,
    resources
  };
}

/** @param {string} kind */
function pluralKind(kind) {
  const map = {
    device: 'devices',
    firmware: 'firmwares',
    vendor: 'vendors',
    network: 'networks',
    software: 'software',
    compatibility: 'compatibility',
    globals: 'globals',
    taxonomy: 'taxonomy',
    'repeater-commands': 'repeater-commands'
  };
  return map[kind] ?? kind;
}

/**
 * @param {string} root
 * @param {{
 *   devices: Record<string, unknown>[],
 *   firmwares: Record<string, unknown>[],
 *   software: Record<string, unknown>[],
 *   vendors: Record<string, unknown>[],
 *   networks: Record<string, unknown>[],
 *   compatibility: Record<string, unknown>[],
 *   globals: Record<string, unknown>
 *   taxonomy: Record<string, unknown>
 * }} catalog
 */
export function buildAllRuntimeOverlays(root, catalog) {
  const { baseLocale, locales } = loadI18nConfig(root);
  const generatedAt = new Date().toISOString();

  const collections = {
    device: catalog.devices.map((record) => ({ id: record.id, record })),
    firmware: catalog.firmwares.map((record) => ({ id: record.id, record })),
    software: catalog.software.map((record) => ({ id: record.id, record })),
    vendor: catalog.vendors.map((record) => ({ id: record.id, record })),
    network: catalog.networks.map((record) => ({ id: record.id, record })),
    compatibility: catalog.compatibility.map((record) => ({
      id: record.deviceId,
      record,
      ctx: {
        firmwareId: record.firmwareId,
        firmwareVersion: record.firmwareVersionSlug ?? record.firmwareVersion,
        deviceId: record.deviceId
      }
    })),
    globals: [{ id: 'globals', record: catalog.globals }],
    taxonomy: [{ id: 'taxonomy', record: catalog.taxonomy }],
    'repeater-commands': [
      { id: 'repeater-commands', record: { groups: COMMAND_GROUPS, flags: COMMAND_FLAGS } }
    ]
  };

  /** @type {Record<string, unknown>} */
  const overlays = {};

  for (const locale of locales) {
    if (locale === baseLocale) continue;
    overlays[locale] = buildRuntimeOverlay({ root, locale, collections, generatedAt });
  }

  return overlays;
}

/**
 * @param {string} root
 * @param {Record<string, unknown>} overlays
 */
export function writeRuntimeOverlays(root, overlays) {
  for (const [locale, overlay] of Object.entries(overlays)) {
    const json = JSON.stringify(overlay, null, 2) + '\n';
    for (const target of [
      join(root, 'src', 'lib', 'generated', 'overlays', `${locale}.json`),
      join(root, 'static', 'overlays', `${locale}.json`)
    ]) {
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, json);
    }
  }
}

/**
 * Translation coverage for one locale.
 * @param {string} root
 * @param {string} locale
 * @param {ReturnType<typeof buildAllRuntimeOverlays>} _unused
 * @param {{
 *   devices: Record<string, unknown>[],
 *   firmwares: Record<string, unknown>[],
 *   software: Record<string, unknown>[],
 *   vendors: Record<string, unknown>[],
 *   networks: Record<string, unknown>[],
 *   compatibility: Record<string, unknown>[],
 *   globals: Record<string, unknown>
 *   taxonomy: Record<string, unknown>
 * }} catalog
 */
export function coverageForLocale(root, locale, catalog) {
  const collections = [
    ['device', catalog.devices],
    ['firmware', catalog.firmwares],
    ['software', catalog.software],
    ['vendor', catalog.vendors],
    ['network', catalog.networks],
    [
      'compatibility',
      catalog.compatibility.map((r) => ({
        record: r,
        ctx: {
          firmwareId: r.firmwareId,
          firmwareVersion: r.firmwareVersionSlug ?? r.firmwareVersion,
          deviceId: r.deviceId
        }
      }))
    ],
    ['globals', [{ record: catalog.globals }]],
    ['taxonomy', [{ record: catalog.taxonomy }]],
    ['repeater-commands', [{ record: { groups: COMMAND_GROUPS, flags: COMMAND_FLAGS } }]]
  ];

  let current = 0;
  let stale = 0;
  let missing = 0;
  let total = 0;

  for (const [kind, items] of collections) {
    for (const item of items) {
      const record = item.record ?? item;
      const ctx = item.ctx;
      const id = record.id ?? 'globals';
      const fields = extractTranslatableFields(kind, record, ctx);
      const source = loadTranslationSource(root, locale, pluralKind(kind), id === 'globals' ? 'globals' : id);
      const sourceFields = source?.fields ?? {};

      for (const field of fields) {
        total += 1;
        const translated = sourceFields[field.path];
        if (!translated) {
          missing += 1;
          continue;
        }
        if (translated.sourceHash !== field.sourceHash) {
          stale += 1;
          continue;
        }
        current += 1;
      }
    }
  }

  return { locale, current, stale, missing, total };
}

/**
 * @param {string} root
 * @param {(where: string, msg: string) => void} err
 */
export function validateAllTranslationSources(root, err) {
  const ajv = new Ajv({ allErrors: true });
  const schema = load(readFileSync(join(root, 'schema', 'i18n-source.yaml'), 'utf8'));
  const validate = ajv.compile(schema);

  const base = join(root, SOURCES_DIR);
  if (!existsSync(base)) return;

  for (const locale of readdirSync(base, { withFileTypes: true })) {
    if (!locale.isDirectory()) continue;
    const localePath = join(base, locale.name);
    for (const kind of readdirSync(localePath, { withFileTypes: true })) {
      if (!kind.isDirectory()) continue;
      for (const file of readdirSync(join(localePath, kind.name), { withFileTypes: true })) {
        if (!file.isFile() || !file.name.endsWith('.json')) continue;
        const where = `${SOURCES_DIR}/${locale.name}/${kind.name}/${file.name}`;
        try {
          const source = JSON.parse(readFileSync(join(localePath, kind.name, file.name), 'utf8'));
          validateTranslationSource(source, validate, where, err);
        } catch (e) {
          err(where, `JSON parse error: ${e.message}`);
        }
      }
    }
  }
}

export { sourceHash };
