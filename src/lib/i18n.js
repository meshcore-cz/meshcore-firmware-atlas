// Locale-aware internal links for the static, prerendered site.
//
// English (the base locale) stays unprefixed; other locales get a prefix and
// translated slugs, e.g. `/devices/` (en) vs `/cs/zarizeni/` (cs). Links also
// carry the deploy `base` path (empty in production, set for GitHub-Pages
// subpaths).
//
// `getLocale()` resolves the active locale from the URL (the `url` strategy),
// both client-side and during prerender (via the server middleware in
// hooks.server.js), so links automatically stay within the visitor's locale.
import { base } from '$app/paths';
import {
  getLocale,
  baseLocale,
  locales,
  localizeHref,
  deLocalizeHref
} from '$lib/paraglide/runtime.js';
import { resolveDevicesCanonical } from '$lib/route-path.js';

// Absolute deploy base path (empty in production, "/<repo>" on GitHub-Pages
// project sites). `$app/paths` `base` is *relative* in this static build, so it
// can't be used to strip the base off an absolute `url.pathname`; this mirrors
// what vite.config.js injects and seo.js reads.
const ABS_BASE = (import.meta.env?.VITE_BASE_PATH ?? '').replace(/\/+$/, '');

/**
 * Locale-aware, base-prefixed internal link.
 * @param {string} path Canonical (English) app path, e.g. `/devices/` or `/`.
 * @param {string} [locale] Target locale; defaults to the active one.
 */
export function href(path, locale = getLocale()) {
  return base + localizeHref(path, { locale });
}

/**
 * Strip a leading locale prefix and localized slugs from a rooted pathname (with
 * `base` already removed), yielding the canonical base-locale path.
 * `/cs/zarizeni/` → `/devices/`.
 * @param {string} path
 */
export function deLocalize(path) {
  return resolveDevicesCanonical(deLocalizeHref(path));
}

/**
 * Bare, locale- and base-independent canonical route path for an absolute
 * `url.pathname` (e.g. `/meshcore-ninja/cs/zarizeni/` → `/devices/`). Use this
 * to feed `href()` or to build per-locale alternates.
 * @param {string} pathname
 */
export function routePath(pathname) {
  const withoutBase =
    ABS_BASE && pathname.startsWith(ABS_BASE) ? pathname.slice(ABS_BASE.length) : pathname;
  return deLocalize(withoutBase || '/') || '/';
}

export { locales, getLocale, baseLocale };
