#!/usr/bin/env node
// Translate a single catalog field (or arbitrary text) for prompt/provider testing.
//
// Examples:
//   npm run i18n:translate:test -- --locale cs --text "Self-hosted mobile-first web client"
//   npm run i18n:translate:test -- --locale cs --resource software/mc-webui --field description
//   npm run i18n:translate:test -- --locale cs --resource software/mc-webui --field screenshots.main-window.png.caption
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadI18nConfig } from '../route-slugs.js';
import { createTranslationProvider } from './provider.js';
import { translationPrompt } from './prompt.js';
import { localeLanguageName } from './locale-names.js';
import { extractTranslatableFields } from '../../src/lib/catalog-i18n/fields.js';
import { formatTranslateStats, previewText } from './log.js';
import { sourceHash } from '../../src/lib/catalog-i18n/source-hash.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function usage() {
  console.log(`Usage:
  i18n:translate:test --locale <code> --text "<english prose>"
  i18n:translate:test --locale <code> --resource <kind/id> --field <path>

Options:
  --locale <code>     Target locale (required), e.g. cs
  --text <string>     Ad-hoc English text to translate
  --resource <key>    Catalog resource, e.g. software/mc-webui
  --field <path>      Field path within the resource, e.g. description
  --show-prompt       Print the system prompt and exit (no API call)
  --backend <name>    ollama | openai | stub (default: $I18N_TRANSLATOR or ollama)
  --model <name>      Override model (OLLAMA_MODEL / OPENAI_MODEL)
`);
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
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

/**
 * @param {string} resourceKey e.g. software/mc-webui
 * @param {string} fieldPath
 */
function loadFieldFromCatalog(resourceKey, fieldPath) {
  const slash = resourceKey.indexOf('/');
  if (slash === -1) throw new Error(`invalid --resource "${resourceKey}" (expected kind/id)`);
  const kind = resourceKey.slice(0, slash);
  const id = resourceKey.slice(slash + 1);

  const plural = {
    device: 'devices',
    firmware: 'firmwares',
    software: 'software',
    vendor: 'vendors',
    network: 'networks'
  };
  const collection = plural[kind];
  if (!collection) throw new Error(`unsupported resource kind "${kind}"`);

  const staticPath = join(root, 'static', kind, `${id}.json`);
  const dataPath = join(root, 'src/lib/generated/data.json');

  let record;
  if (existsSync(staticPath)) {
    record = JSON.parse(readFileSync(staticPath, 'utf8'));
  } else if (existsSync(dataPath)) {
    const catalog = JSON.parse(readFileSync(dataPath, 'utf8'));
    const list = catalog[`${collection}`] ?? catalog[collection];
    record = list?.find((r) => r.id === id);
  }

  if (!record) throw new Error(`resource not found: ${resourceKey} (run npm run build:data)`);

  const fields = extractTranslatableFields(kind, record);
  const field = fields.find((f) => f.path === fieldPath);
  if (!field) {
    const available = fields.map((f) => f.path).join(', ') || '(none)';
    throw new Error(`field "${fieldPath}" not found on ${resourceKey}. Available: ${available}`);
  }
  return field;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  usage();
  process.exit(0);
}

const locale = typeof args.locale === 'string' ? args.locale : '';
if (!locale) {
  usage();
  process.exit(1);
}

const { baseLocale } = loadI18nConfig(root);
if (locale === baseLocale) {
  console.error(`target --locale must not be the base locale (${baseLocale})`);
  process.exit(1);
}

if (args['show-prompt']) {
  const sample = typeof args.text === 'string' ? args.text : '{source_text}';
  console.log(translationPrompt(locale, sample));
  process.exit(0);
}

let text = typeof args.text === 'string' ? args.text : '';
let fieldPath = typeof args.field === 'string' ? args.field : 'adhoc';

if (!text) {
  const resource = typeof args.resource === 'string' ? args.resource : '';
  const field = typeof args.field === 'string' ? args.field : '';
  if (!resource || !field) {
    usage();
    process.exit(1);
  }
  const loaded = loadFieldFromCatalog(resource, field);
  text = loaded.value;
  fieldPath = loaded.path;
}

const backend =
  typeof args.backend === 'string' ? args.backend : process.env.I18N_TRANSLATOR ?? 'ollama';
const provider = createTranslationProvider({
  backend,
  model: typeof args.model === 'string' ? args.model : undefined
});

if (backend === 'ollama' && !provider.model) {
  await provider.resolveModel();
}

console.error(`backend: ${backend} · model: ${provider.model}`);
console.error(`target: ${localeLanguageName(locale)} (${locale})`);
console.error(`field: ${fieldPath}`);
console.error(`source: ${previewText(text)}`);
console.error(`hash: ${sourceHash(text)}`);
console.error('---');

const result = await provider.translate({
  text,
  sourceLocale: baseLocale,
  targetLocale: locale,
  fieldPath
});

console.log(result.value);
console.error(formatTranslateStats(result.stats));
