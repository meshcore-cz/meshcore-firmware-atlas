// Guards against the locale registry drifting from the Paraglide config.
//
// `project.inlang/settings.json` is the source of truth for *which* locales
// ship; `src/lib/locales.js` is the source of truth for their *metadata*. Every
// shipped locale must have a complete metadata entry and vice versa, so adding a
// language can't silently miss the switcher, SEO or translation tooling.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE_META, LOCALE_CODES, LOCALE_META_FIELDS } from '../src/lib/locales.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const settings = JSON.parse(readFileSync(join(root, 'project.inlang/settings.json'), 'utf8'));
const declared = settings.locales ?? [];

/** @type {string[]} */
const errors = [];

const missingMeta = declared.filter((l) => !LOCALE_CODES.includes(l));
if (missingMeta.length) {
  errors.push(
    `locales in settings.json without metadata in src/lib/locales.js: ${missingMeta.join(', ')}`
  );
}

const orphanMeta = LOCALE_CODES.filter((l) => !declared.includes(l));
if (orphanMeta.length) {
  errors.push(
    `metadata in src/lib/locales.js for locales not in settings.json: ${orphanMeta.join(', ')}`
  );
}

if (settings.baseLocale && !LOCALE_CODES.includes(settings.baseLocale)) {
  errors.push(`baseLocale "${settings.baseLocale}" has no metadata in src/lib/locales.js`);
}

for (const [code, meta] of Object.entries(LOCALE_META)) {
  for (const field of LOCALE_META_FIELDS) {
    if (!meta[field]) errors.push(`locale "${code}" is missing required metadata field "${field}"`);
  }
}

if (errors.length) {
  console.error('✗ locale registry out of sync:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ locale registry in sync — ${LOCALE_CODES.join(', ')}`);
