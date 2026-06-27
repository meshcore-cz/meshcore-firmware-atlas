/** @typedef {{ durationMs: number, promptTokens?: number, completionTokens?: number, totalTokens?: number }} TranslateStats */

/**
 * @param {string} text
 * @param {number} [max]
 */
export function previewText(text, max = 120) {
  const oneLine = String(text).replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

/** @param {TranslateStats} stats */
export function formatTranslateStats(stats) {
  const parts = [`${stats.durationMs} ms`];
  if (stats.promptTokens != null && stats.completionTokens != null) {
    parts.push(`${stats.promptTokens}+${stats.completionTokens} tokens`);
  } else if (stats.totalTokens != null) {
    parts.push(`${stats.totalTokens} tokens`);
  }
  return parts.join(' · ');
}

/**
 * @param {{
 *   locale: string,
 *   resource: string,
 *   fieldPath: string,
 *   source: string,
 *   translation: string,
 *   stats: TranslateStats,
 *   model?: string
 * }} event
 */
export function logTranslatedField(event) {
  const model = event.model ? ` · ${event.model}` : '';
  console.log(`\n▸ ${event.resource} · ${event.fieldPath} (${event.locale})${model}`);
  console.log(`  source: ${previewText(event.source)}`);
  console.log(`  → ${previewText(event.translation)}`);
  console.log(`  ${formatTranslateStats(event.stats)}`);
}

/**
 * @param {{
 *   updated: number,
 *   skipped: number,
 *   totalMs: number,
 *   promptTokens: number,
 *   completionTokens: number,
 *   model?: string,
 *   locales: string[]
 * }} summary
 * @param {string} sourcesDir
 */
export function logTranslateSummary(summary, sourcesDir) {
  const totalTokens = summary.promptTokens + summary.completionTokens;
  console.log(`\n✓ Updated ${summary.updated} field(s) in ${sourcesDir}/`);
  if (summary.skipped > 0) {
    console.log(`  skipped ${summary.skipped} up-to-date field(s)`);
  }
  console.log(
    `  ${summary.totalMs} ms total` +
      (totalTokens > 0
        ? ` · ${totalTokens} tokens (${summary.promptTokens} prompt + ${summary.completionTokens} completion)`
        : '')
  );
  if (summary.model) console.log(`  model: ${summary.model}`);
  if (summary.locales.length) console.log(`  locale(s): ${summary.locales.join(', ')}`);
}
