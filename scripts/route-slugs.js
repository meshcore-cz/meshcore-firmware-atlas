// Localized URL routing — structure lives here; slug strings live in
// messages/{locale}.json as `route_slug_*` keys. Locales come from
// project.inlang/settings.json.
//
// SvelteKit route files stay canonical (English segments); hooks.js
// de-localizes incoming URLs before routing. Template order matters.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDevicesCanonical } from '../src/lib/device-categories.js';

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * URL templates. Static segments are `{messageKey}` placeholders resolved from
 * each locale's messages; dynamic SvelteKit params stay as `:id`, `:path(.*)?`, etc.
 * Most specific patterns first.
 *
 * @type {string[]}
 */
export const ROUTE_TEMPLATES = [
  '/{route_slug_software}/:id/{route_slug_releases}/',
  '/{route_slug_firmware}/:id/{route_slug_releases}/',
  '/{route_slug_device}/:id/:path(.*)?',
  '/{route_slug_device_rank}/:metric/:path(.*)?',
  '/{route_slug_network}/:id/:path(.*)?',
  '/{route_slug_vendor}/:id/:path(.*)?',
  '/{route_slug_firmware}/:id/:path(.*)?',
  '/{route_slug_software}/:id/:path(.*)?',
  '/{route_slug_compare_firmwares}/:path(.*)?',
  '/{route_slug_repeater_commands}/:path(.*)?',
  '/{route_slug_compare}/:path(.*)?',
  '/{route_slug_devices}/:path(.*)?',
  '/{route_slug_firmwares}/:path(.*)?',
  '/{route_slug_networks}/:path(.*)?',
  '/{route_slug_vendor_countries}/:path(.*)?',
  '/{route_slug_vendors}/:path(.*)?',
  '/{route_slug_software}/:path(.*)?',
  '/{route_slug_prints}/:path(.*)?',
  '/{route_slug_about}/:path(.*)?',
  '/{route_slug_bands}/:path(.*)?',
  '/{route_slug_bundle}/:path(.*)?',
  '/{route_slug_gallery}/:path(.*)?',
  '/{route_slug_languages}/:path(.*)?',
  '/{route_slug_matrix}/:path(.*)?',
  '/{route_slug_releases}/:path(.*)?',
  '/{route_slug_schemas}/:path(.*)?',
  '/{route_slug_status}/:path(.*)?',
  '/',
  '/:path(.*)?'
];

const ORIGIN_PREFIX = ':protocol://:domain(.*)::port?';
const SLUG_KEY_RE = /^route_slug_[a-z0-9_]+$/;
const SLUG_VALUE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** @type {Map<string, { baseLocale: string, locales: string[], messages: Record<string, Record<string, string>> }>} */
const configCache = new Map();

/** Message keys referenced by {@link ROUTE_TEMPLATES}. */
export function routeSlugKeys() {
  /** @type {Set<string>} */
  const keys = new Set();
  for (const template of ROUTE_TEMPLATES) {
    for (const match of template.matchAll(/\{([^}]+)\}/g)) keys.add(match[1]);
  }
  return [...keys].sort();
}

/**
 * @param {string} [root]
 * @returns {{ baseLocale: string, locales: string[], messages: Record<string, Record<string, string>> }}
 */
export function loadI18nConfig(root = defaultRoot) {
  const cached = configCache.get(root);
  if (cached) return cached;

  const settings = JSON.parse(readFileSync(join(root, 'project.inlang/settings.json'), 'utf8'));
  const baseLocale = settings.baseLocale;
  const locales = settings.locales;
  /** @type {Record<string, Record<string, string>>} */
  const messages = {};
  for (const locale of locales) {
    messages[locale] = JSON.parse(readFileSync(join(root, 'messages', `${locale}.json`), 'utf8'));
  }

  const config = { baseLocale, locales, messages };
  configCache.set(root, config);
  return config;
}

/**
 * @param {string} template
 * @param {Record<string, string>} localeMessages
 */
function renderTemplate(template, localeMessages) {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const value = localeMessages[key];
    if (typeof value !== 'string' || !value) {
      throw new Error(`Missing route slug message "${key}"`);
    }
    return value;
  });
}

/**
 * @param {{ baseLocale: string, locales: string[], messages: Record<string, Record<string, string>> }} config
 */
function buildLocalizedRoutes(config) {
  return ROUTE_TEMPLATES.map((template) => {
    const canonical = renderTemplate(template, config.messages[config.baseLocale]);
    /** @type {Record<string, string>} */
    const byLocale = {};
    for (const locale of config.locales) {
      byLocale[locale] = renderTemplate(template, config.messages[locale]);
    }
    return { template, canonical, byLocale };
  });
}

/**
 * @param {string} locale
 * @param {string} path
 * @param {{ baseLocale: string }} config
 */
function withLocalePrefix(locale, path, config) {
  if (locale === config.baseLocale) return path;
  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}

/**
 * Paraglide `urlPatterns` for vite.config.js.
 * @param {string} [basePath]
 * @param {string} [root]
 */
export function buildParaglideUrlPatterns(basePath = '', root = defaultRoot) {
  const config = loadI18nConfig(root);
  const routes = buildLocalizedRoutes(config);

  return routes.map(({ canonical, byLocale }) => ({
    pattern: `${ORIGIN_PREFIX}${basePath}${canonical}`,
    localized: config.locales
      .map((locale) => [
        locale,
        `${ORIGIN_PREFIX}${basePath}${withLocalePrefix(locale, byLocale[locale], config)}`
      ])
      .sort(([a], [b]) => {
        if (a === config.baseLocale) return 1;
        if (b === config.baseLocale) return -1;
        return 0;
      })
  }));
}

/**
 * Canonical path → localized path (no locale prefix, no deploy base).
 * @param {string} canonical
 * @param {string} locale
 * @param {string} [root]
 */
export function localizeCanonicalPath(canonical, locale, root = defaultRoot) {
  const config = loadI18nConfig(root);
  if (locale === config.baseLocale) return canonical;

  const path = canonical.startsWith('/') ? canonical : `/${canonical}`;
  const { pathname, search, hash } = splitPathQueryHash(path);
  const routes = buildLocalizedRoutes(config);

  for (const route of routes) {
    const match = matchPattern(route.canonical, pathname);
    if (!match) continue;
    const localized = fillPattern(route.byLocale[locale], match);
    return localized + search + hash;
  }
  return path;
}

/**
 * Public URL path for a canonical route in a locale (includes locale prefix).
 * @param {string} canonical
 * @param {string} locale
 * @param {string} [root]
 */
export function publicPathForLocale(canonical, locale, root = defaultRoot) {
  const config = loadI18nConfig(root);
  const localized = localizeCanonicalPath(canonical, locale, root);
  return withLocalePrefix(locale, localized, config);
}

/**
 * Strip locale prefix + localized slugs → canonical path.
 * @param {string} localizedPath
 * @param {string} [root]
 */
export function delocalizePath(localizedPath, root = defaultRoot) {
  const config = loadI18nConfig(root);
  let path = localizedPath.startsWith('/') ? localizedPath : `/${localizedPath}`;

  for (const locale of config.locales) {
    if (locale === config.baseLocale) continue;
    if (path === `/${locale}` || path === `/${locale}/`) {
      path = '/';
      break;
    }
    if (path.startsWith(`/${locale}/`)) {
      path = path.slice(locale.length + 1) || '/';
      break;
    }
  }

  const { pathname, search, hash } = splitPathQueryHash(path);
  const routes = buildLocalizedRoutes(config);

  for (const route of routes) {
    for (const locale of config.locales) {
      const match = matchPattern(route.byLocale[locale], pathname);
      if (!match) continue;
      const canonical = resolveDevicesCanonical(fillPattern(route.canonical, match));
      return canonical + search + hash;
    }
  }
  return localizedPath;
}

/** robots.txt Disallow lines for compare (all locales). @param {string} [root] */
export function compareDisallowPaths(root = defaultRoot) {
  const config = loadI18nConfig(root);
  return config.locales.map((locale) => {
    const slug = config.messages[locale].route_slug_compare;
    const prefix =
      locale === config.baseLocale ? '' : `/${locale}`;
    return `${prefix}/${slug}/`;
  });
}

/**
 * Validate route slug messages across locales.
 * @param {(where: string, msg: string) => void} report
 * @param {string} [root]
 */
export function validateRouteSlugs(report, root = defaultRoot) {
  const config = loadI18nConfig(root);
  const keys = routeSlugKeys();

  for (const key of keys) {
    if (!SLUG_KEY_RE.test(key)) {
      report('i18n', `invalid route slug key "${key}" in ROUTE_TEMPLATES`);
    }
  }

  for (const locale of config.locales) {
    const localeMessages = config.messages[locale];
    for (const key of keys) {
      const value = localeMessages[key];
      if (typeof value !== 'string' || !value) {
        report(`messages/${locale}.json`, `missing "${key}"`);
        continue;
      }
      if (!SLUG_VALUE_RE.test(value)) {
        report(
          `messages/${locale}.json`,
          `"${key}" must be a lowercase URL slug (got "${value}")`
        );
      }
    }
  }
}

/** @param {string} path */
function splitPathQueryHash(path) {
  const hashIdx = path.indexOf('#');
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : '';
  const beforeHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
  const qIdx = beforeHash.indexOf('?');
  const search = qIdx >= 0 ? beforeHash.slice(qIdx) : '';
  const pathname = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
  return { pathname, search, hash };
}

/**
 * @param {string} pattern
 * @param {string} pathname
 */
function matchPattern(pattern, pathname) {
  if (pattern === '/') {
    return pathname === '/' || pathname === '' ? {} : null;
  }

  const paramNames = [];
  let regexStr = '^';
  for (let i = 0; i < pattern.length; ) {
    if (pattern.startsWith(':path(.*)?', i)) {
      paramNames.push('path');
      regexStr += '(?:(.*))?';
      i += ':path(.*)?'.length;
      continue;
    }
    if (pattern[i] === ':') {
      const nameMatch = pattern.slice(i).match(/^:([A-Za-z]+)/);
      if (!nameMatch) throw new Error(`Invalid route param in "${pattern}"`);
      paramNames.push(nameMatch[1]);
      regexStr += '([^/]+)';
      i += nameMatch[0].length;
      continue;
    }
    if (pattern[i] === '/') {
      regexStr += '\\/';
      i++;
      continue;
    }
    regexStr += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    i++;
  }
  regexStr += '\\/?$';

  const m = pathname.match(new RegExp(regexStr));
  if (!m) return null;

  /** @type {Record<string, string>} */
  const groups = {};
  for (let i = 0; i < paramNames.length; i++) {
    const value = m[i + 1];
    if (value !== undefined && value !== '') groups[paramNames[i]] = value;
  }
  return groups;
}

/** @param {string} pattern @param {Record<string, string>} groups */
function fillPattern(pattern, groups) {
  if (pattern === '/') return '/';
  let out = pattern;
  out = out.replace(/\/:path\(\.\*\)\?/g, () => {
    const v = groups.path?.replace(/^\/+|\/+$/g, '');
    return v ? `/${v}` : '';
  });
  out = out.replace(/:([A-Za-z]+)/g, (_, name) => groups[name] ?? '');
  if (!out.endsWith('/')) out += '/';
  return out;
}
