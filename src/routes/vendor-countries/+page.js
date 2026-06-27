import { vendors } from '$lib/data.js';
import { countryCode } from '$lib/countries.js';

// Rank vendor home countries by how many catalogued hardware makers are based in
// each, carrying the device total each country contributes. Vendors without a
// `country` are counted only in the "placed" vs total summary.
export function load() {
  /** @type {Map<string, { country: string, code: string|null, vendors: number, devices: number }>} */
  const byCountry = new Map();

  for (const v of vendors) {
    const name = v.country?.trim();
    if (!name) continue;
    const entry = byCountry.get(name) ?? {
      country: name,
      code: countryCode(name),
      vendors: 0,
      devices: 0
    };
    entry.vendors += 1;
    entry.devices += v.deviceCount ?? 0;
    byCountry.set(name, entry);
  }

  const countries = [...byCountry.values()].sort(
    (a, b) => b.vendors - a.vendors || b.devices - a.devices || a.country.localeCompare(b.country)
  );

  const placed = countries.reduce((n, c) => n + c.vendors, 0);

  return { countries, totalVendors: vendors.length, placed };
}
