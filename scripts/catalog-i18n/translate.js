import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadI18nConfig } from '../route-slugs.js';
import { loadTranslationSource, sourceFilePath, SOURCES_DIR } from './build-overlays.js';
import { extractTranslatableFields, resourceKey } from '../../src/lib/catalog-i18n/fields.js';
import { COMMAND_GROUPS, COMMAND_FLAGS } from '../../src/lib/repeaterCommands.js';
import { createTranslationProvider } from './provider.js';
import { logTranslatedField, logTranslateSummary } from './log.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * @param {string} value
 * @param {string} sourceHash
 * @param {string} generatedAt
 * @param {string} model
 * @param {{ durationMs?: number, promptTokens?: number, completionTokens?: number }} stats
 */
function fieldEntry(value, sourceHash, generatedAt, model, stats) {
  /** @type {Record<string, unknown>} */
  const entry = { value, sourceHash, generatedAt, model };
  if (stats.durationMs != null) entry.durationMs = stats.durationMs;
  if (stats.promptTokens != null) entry.promptTokens = stats.promptTokens;
  if (stats.completionTokens != null) entry.completionTokens = stats.completionTokens;
  return entry;
}

/**
 * @param {string} locale
 * @param {string} kind
 * @param {string} id
 * @param {string} resource
 * @param {Record<string, Record<string, unknown>>} fields
 * @param {string} [resourceFromExisting]
 */
function writeTranslationSource(locale, kind, id, resource, fields, resourceFromExisting) {
  const path = sourceFilePath(root, locale, kind, id);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        resource: resourceFromExisting ?? resource,
        locale,
        fields
      },
      null,
      2
    ) + '\n'
  );
  return path;
}

/**
 * Resolve which locale(s) to translate.
 * @param {string|undefined} requestedLocale Single locale from --locale / -l
 * @param {{ baseLocale: string, locales: string[] }} config
 * @returns {string[]}
 */
export function resolveTargetLocales(requestedLocale, { baseLocale, locales }) {
  if (!requestedLocale) {
    return locales.filter((l) => l !== baseLocale);
  }
  if (requestedLocale === baseLocale) {
    throw new Error(`target locale must not be the base locale (${baseLocale})`);
  }
  if (!locales.includes(requestedLocale)) {
    throw new Error(`unknown locale "${requestedLocale}" — configured: ${locales.join(', ')}`);
  }
  return [requestedLocale];
}

/**
 * @param {{
 *   devices: Record<string, unknown>[],
 *   firmwares: Record<string, unknown>[],
 *   software: Record<string, unknown>[],
 *   vendors: Record<string, unknown>[],
 *   networks: Record<string, unknown>[],
 *   compatibility: Record<string, unknown>[],
 *   globals: Record<string, unknown>
 * }} catalog
 * @param {{
 *   locale?: string,
 *   provider?: ReturnType<typeof createTranslationProvider>,
 *   quiet?: boolean,
 *   onProgress?: (summary: {
 *     updated: number,
 *     skipped: number,
 *     totalMs: number,
 *     promptTokens: number,
 *     completionTokens: number,
 *     model?: string,
 *     locales: string[]
 *   }) => void,
 *   onField?: (event: import('./log.js').TranslateStats & {
 *     locale: string,
 *     resource: string,
 *     fieldPath: string,
 *     source: string,
 *     translation: string,
 *     model?: string
 *   }) => void
 * }} [opts]
 */
export async function translateCatalog(catalog, opts = {}) {
  const { baseLocale, locales } = loadI18nConfig(root);
  const targetLocales = resolveTargetLocales(opts.locale, { baseLocale, locales });
  const provider = opts.provider ?? createTranslationProvider();

  if (provider.resolveModel) {
    await provider.resolveModel();
  }

  const collections = [
    ['devices', catalog.devices],
    ['firmwares', catalog.firmwares],
    ['software', catalog.software],
    ['vendors', catalog.vendors],
    ['networks', catalog.networks],
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
    ['taxonomy', [{ id: 'taxonomy', record: catalog.taxonomy ?? {} }]],
    [
      'repeater-commands',
      [{ id: 'repeater-commands', record: { groups: catalog.repeaterCommands ?? COMMAND_GROUPS, flags: catalog.repeaterCommandFlags ?? COMMAND_FLAGS } }]
    ]
  ];

  const kindSingular = {
    devices: 'device',
    firmwares: 'firmware',
    software: 'software',
    vendors: 'vendor',
    networks: 'network',
    compatibility: 'compatibility',
    taxonomy: 'taxonomy',
    'repeater-commands': 'repeater-commands'
  };

  let updated = 0;
  let skipped = 0;
  let totalMs = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const runStart = performance.now();

  const snapshot = () => ({
    updated,
    skipped,
    totalMs: Math.round(performance.now() - runStart),
    promptTokens,
    completionTokens,
    model: provider.model,
    locales: targetLocales
  });

  if (!opts.quiet) {
    const backend = process.env.I18N_TRANSLATOR ?? 'ollama';
    console.log(`Translating catalog → ${targetLocales.join(', ')} (${backend} · ${provider.model})`);
  }

  for (const locale of targetLocales) {
    for (const [kind, items] of collections) {
      for (const item of items) {
        const record = item.record ?? item;
        const ctx = item.ctx;
        const id = item.id ?? record.id ?? record.deviceId;
        const singular = kindSingular[kind];
        const resource = resourceKey(singular, record, ctx);
        const fields = extractTranslatableFields(singular, record, ctx);
        if (!fields.length) continue;

        const existing = loadTranslationSource(root, locale, kind, id) ?? {
          resource,
          locale,
          fields: {}
        };

        /** @type {Record<string, { value: string, sourceHash: string, generatedAt?: string, model?: string }>} */
        const nextFields = { ...existing.fields };

        for (const field of fields) {
          const current = nextFields[field.path];
          if (current?.sourceHash === field.sourceHash) {
            skipped += 1;
            continue;
          }

          const result = await provider.translate({
            text: field.value,
            sourceLocale: baseLocale,
            targetLocale: locale,
            fieldPath: field.path
          });

          const generatedAt = new Date().toISOString();
          nextFields[field.path] = fieldEntry(
            result.value,
            field.sourceHash,
            generatedAt,
            provider.model,
            result.stats
          );
          updated += 1;

          totalMs += result.stats.durationMs ?? 0;
          promptTokens += result.stats.promptTokens ?? 0;
          completionTokens += result.stats.completionTokens ?? 0;

          const savedPath = writeTranslationSource(
            locale,
            kind,
            id,
            resource,
            nextFields,
            existing.resource
          );

          const event = {
            locale,
            resource,
            fieldPath: field.path,
            source: field.value,
            translation: result.value,
            stats: result.stats,
            model: provider.model
          };

          if (opts.onField) opts.onField(event);
          else if (!opts.quiet) {
            logTranslatedField(event);
            console.log(`  saved ${savedPath.replace(`${root}/`, '')}`);
          }

          opts.onProgress?.(snapshot());
        }
      }
    }
  }

  const summary = snapshot();
  return summary;
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      out.help = true;
      continue;
    }
    if (arg === '-l' || arg === '--locale') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        out.localeMissing = true;
        continue;
      }
      out.locale = next;
      i++;
      continue;
    }
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i++;
  }
  return out;
}

function usage() {
  const { baseLocale, locales } = loadI18nConfig(root);
  const targets = locales.filter((l) => l !== baseLocale);
  console.log(`Usage:
  npm run i18n:translate [-- --locale <code>]
  npm run i18n:translate -- -l cs

Translate catalog overlay sources under data/i18n/sources/.

Options:
  -l, --locale <code>   Translate only this locale (default: all non-base)
  --quiet               Less console output
  --help, -h            Show this help

Base locale: ${baseLocale}
Configured target locales: ${targets.join(', ') || '(none)'}

Examples:
  npm run i18n:translate -- --locale cs
  npm run i18n:translate -- -l pt --quiet
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    usage();
    process.exit(0);
  }
  if (args.localeMissing) {
    console.error('error: --locale requires a locale code\n');
    usage();
    process.exit(1);
  }

  const { baseLocale, locales } = loadI18nConfig(root);
  const requestedLocale = typeof args.locale === 'string' ? args.locale : undefined;
  try {
    resolveTargetLocales(requestedLocale, { baseLocale, locales });
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }

  const { buildData } = await import('../build-data.js');
  const counts = await buildData(root);
  const catalog = JSON.parse(readFileSync(join(root, 'src/lib/generated/data.json'), 'utf8'));
  const fullFirmwares = [];
  const fullSoftware = [];
  for (const fw of catalog.firmwares) {
    const p = join(root, 'static/firmware', `${fw.id}.json`);
    if (existsSync(p)) fullFirmwares.push(JSON.parse(readFileSync(p, 'utf8')));
    else fullFirmwares.push(fw);
  }
  for (const sw of catalog.software) {
    const p = join(root, 'static/software', `${sw.id}.json`);
    if (existsSync(p)) fullSoftware.push(JSON.parse(readFileSync(p, 'utf8')));
    else fullSoftware.push(sw);
  }

  /** @type {Awaited<ReturnType<typeof translateCatalog>> | null} */
  let latestSummary = null;

  process.on('SIGINT', () => {
    console.error('\nInterrupted — translated fields saved progressively.');
    if (latestSummary) logTranslateSummary(latestSummary, SOURCES_DIR);
    process.exit(130);
  });

  const summary = await translateCatalog(
    {
      devices: catalog.devices,
      firmwares: fullFirmwares,
      software: fullSoftware,
      vendors: catalog.vendors,
      networks: catalog.networks,
      compatibility: catalog.compatibility,
      globals: catalog.globals ?? {},
      taxonomy: catalog.taxonomy ?? {},
      repeaterCommands: COMMAND_GROUPS,
      repeaterCommandFlags: COMMAND_FLAGS
    },
    {
      locale: requestedLocale,
      quiet: Boolean(args.quiet),
      onProgress: (s) => {
        latestSummary = s;
      }
    }
  );

  logTranslateSummary(summary, SOURCES_DIR);
  void counts;
}
