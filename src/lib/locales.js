// Central registry of every locale the site ships.
//
// `project.inlang/settings.json` owns the canonical *list of locale codes* —
// Paraglide reads it at build time to compile messages and URL routing, and the
// generated `$lib/paraglide/runtime.js` re-exports it as `locales`. This module
// owns the per-locale *metadata* the rest of the app needs and that Paraglide
// knows nothing about: the locale-switcher endonym + flag, the English name used
// in translation tooling, and the OpenGraph locale.
//
// Adding a language is therefore a two-line change: add the code to
// `settings.json` and an entry here. `scripts/check-locales.js` (run by
// `npm test`) fails the build if the two ever drift, so nothing gets forgotten.
//
// Plain JS with no framework imports on purpose — both Svelte components
// (`$lib/locales.js`) and Node build scripts (`../src/lib/locales.js`) consume it.

/**
 * @typedef {Object} LocaleMeta
 * @property {string} endonym  Language name in its own language — shown in the switcher.
 * @property {string} name     English name — used in translation prompts / tooling.
 * @property {string} flag     ISO 3166-1 alpha-2 country code for the flag icon.
 * @property {string} [flagUrl] Static path to a custom flag SVG when no ISO code applies.
 * @property {string} ogLocale OpenGraph `og:locale` value, e.g. `pt_PT`.
 * @property {string} greeting Friendly banner greeting, written *in this language*,
 *                             shown to visitors whose browser prefers it (LocaleBanner).
 * @property {string} cta      Banner call-to-action label, in this language.
 * @property {string} dismiss  Banner dismiss button aria-label, in this language.
 */

/** @type {Record<string, LocaleMeta>} */
export const LOCALE_META = {
  en: {
    endonym: 'English',
    name: 'English',
    flag: 'GB',
    ogLocale: 'en_US',
    greeting: 'Hi there! This page is also available in English.',
    cta: 'View in English',
    dismiss: 'Dismiss'
  },
  cs: {
    endonym: 'Čeština',
    name: 'Czech',
    flag: 'CZ',
    ogLocale: 'cs_CZ',
    greeting: 'Ahoj, zdravíme tě! Tahle stránka je i v češtině.',
    cta: 'Zobrazit česky',
    dismiss: 'Zavřít'
  },
  pt: {
    endonym: 'Português',
    name: 'Portuguese',
    flag: 'PT',
    ogLocale: 'pt_PT',
    greeting: 'Olá! Esta página também está disponível em português.',
    cta: 'Ver em português',
    dismiss: 'Dispensar'
  },
  vi: {
    endonym: 'Tiếng Việt',
    name: 'Vietnamese',
    flag: 'VN',
    ogLocale: 'vi_VN',
    greeting: 'Xin chào! Trang này cũng có bản tiếng Việt.',
    cta: 'Xem bằng tiếng Việt',
    dismiss: 'Đóng'
  },
  uk: {
    endonym: 'Українська',
    name: 'Ukrainian',
    flag: 'UA',
    ogLocale: 'uk_UA',
    greeting: 'Привіт! Ця сторінка також доступна українською.',
    cta: 'Переглянути українською',
    dismiss: 'Закрити'
  },
  isv: {
    endonym: 'Medžuslovjansky',
    name: 'Interslavic',
    flag: 'isv',
    flagUrl: '/flags/isv.svg',
    ogLocale: 'isv',
    greeting: 'Privět! Ta stranica jest takože dostupna na medžuslovjanskom jezyku.',
    cta: 'Pogleděti na medžuslovjanskom',
    dismiss: 'Zatvoriti'
  }
};

/** Locale codes that have metadata, in declaration order. */
export const LOCALE_CODES = Object.keys(LOCALE_META);

/** Metadata fields every registry entry must define. */
export const LOCALE_META_FIELDS = ['endonym', 'name', 'flag', 'ogLocale', 'greeting', 'cta', 'dismiss'];

/**
 * Metadata for a locale, or `undefined` if it isn't in the registry.
 * @param {string} locale
 */
export function localeMeta(locale) {
  return LOCALE_META[locale];
}
