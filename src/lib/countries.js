// Maps free-text vendor `country` values (data/vendors/*/vendor.yaml) to ISO
// 3166-1 alpha-2 codes so we can render a flag via `country-flag-icons`.
// Returns null for unknown names or non-country values like "Various" — callers
// fall back to no flag. Lookup is case-insensitive and trims whitespace.

/** @type {Record<string, string>} */
const NAME_TO_ISO = {
  australia: 'AU',
  austria: 'AT',
  belgium: 'BE',
  brazil: 'BR',
  canada: 'CA',
  china: 'CN',
  'czech republic': 'CZ',
  czechia: 'CZ',
  denmark: 'DK',
  estonia: 'EE',
  finland: 'FI',
  france: 'FR',
  germany: 'DE',
  'hong kong': 'HK',
  hungary: 'HU',
  india: 'IN',
  ireland: 'IE',
  israel: 'IL',
  italy: 'IT',
  japan: 'JP',
  netherlands: 'NL',
  'new zealand': 'NZ',
  norway: 'NO',
  poland: 'PL',
  portugal: 'PT',
  romania: 'RO',
  singapore: 'SG',
  slovakia: 'SK',
  'south korea': 'KR',
  korea: 'KR',
  spain: 'ES',
  sweden: 'SE',
  switzerland: 'CH',
  taiwan: 'TW',
  ukraine: 'UA',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  us: 'US'
};

/**
 * ISO 3166-1 alpha-2 code for a country name, or null if unknown.
 * @param {string|null|undefined} name
 */
export function countryCode(name) {
  if (!name) return null;
  return NAME_TO_ISO[String(name).trim().toLowerCase()] ?? null;
}
