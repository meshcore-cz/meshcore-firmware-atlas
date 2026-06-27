import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadI18nConfig } from '../route-slugs.js';
import { coverageForLocale } from './build-overlays.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function reportCatalogI18nStatus(catalog) {
  const { baseLocale, locales } = loadI18nConfig(root);
  const lines = [];

  for (const locale of locales) {
    if (locale === baseLocale) continue;
    const stats = coverageForLocale(root, locale, catalog);
    lines.push(
      `${locale}: ${stats.current} current, ${stats.missing} missing, ${stats.stale} stale (${stats.total} total)`
    );
  }

  return lines.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const catalog = JSON.parse(readFileSync(join(root, 'src/lib/generated/data.json'), 'utf8'));
  console.log(reportCatalogI18nStatus(catalog));
}
