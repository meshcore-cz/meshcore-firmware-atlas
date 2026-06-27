/** Display names for catalog target locales (used in translation prompts). */
import { LOCALE_META } from '../../src/lib/locales.js';

/** English language name per shipped locale, sourced from the central registry. */
const LOCALE_LANGUAGE_NAMES = Object.fromEntries(
  Object.entries(LOCALE_META).map(([code, meta]) => [code, meta.name])
);

/**
 * Human-readable language name for a locale code.
 * @param {string} locale BCP-47 / project locale id, e.g. `cs`
 * @param {string} [inLocale] Language to render the name in
 */
export function localeLanguageName(locale, inLocale = 'en') {
  if (LOCALE_LANGUAGE_NAMES[locale]) return LOCALE_LANGUAGE_NAMES[locale];
  try {
    const name = new Intl.DisplayNames([inLocale], { type: 'language' }).of(locale);
    if (name) return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    // fall through
  }
  return locale;
}
