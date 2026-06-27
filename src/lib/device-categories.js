// Device list category slugs — shared by the route matcher, URL de-localization,
// and filtered list pages.
export const DEVICE_CATEGORY_SLUGS = new Set([
  'development-board',
  'companion-radio',
  'standalone',
  'tracker',
  'repeater',
  'other'
]);

/** @param {string} slug */
export function isDeviceCategory(slug) {
  return DEVICE_CATEGORY_SLUGS.has(slug);
}

/**
 * When list and detail routes share a localized slug (e.g. both "zarizeni" in
 * Czech), de-localization matches the detail pattern first. Known device
 * category segments are rewritten to the list route.
 * @param {string} canonical
 */
export function resolveDevicesCanonical(canonical) {
  const m = canonical.match(/^\/device\/([^/]+)\/?$/);
  if (!m) return canonical;
  const segment = m[1];
  return isDeviceCategory(segment) ? `/devices/${segment}/` : canonical;
}
