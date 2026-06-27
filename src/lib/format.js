// Small formatting helpers shared across release listings.
import { getLocale } from '$lib/paraglide/runtime.js';
import { m } from '$lib/paraglide/messages.js';

// Routes an English singular noun to its plural-aware Paraglide message. The
// per-locale plural rules live in the message definitions (messages/*.json), so
// adding a language needs no code change here.
const COUNT_MESSAGES = {
  device: m.count_device,
  firmware: m.count_firmware,
  print: m.count_print,
  board: m.count_board,
  variant: m.count_variant,
  release: m.count_release,
  person: m.count_person,
  commit: m.count_commit,
  'MeshCore firmware': m.count_meshcore_firmware,
  'MeshCore-compatible device': m.count_meshcore_device
};

/** Count + noun, pluralized per the active locale via message definitions:
 *  pluralize(2, 'device'). Unknown nouns fall back to naive English. */
export function pluralize(n, singular, plural = `${singular}s`) {
  const msg = COUNT_MESSAGES[singular];
  if (msg) return msg({ count: n });
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Compact GitHub star count: 1240 → "1.2k", 980 → "980". */
export function fmtStars(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** Prefix bare numeric versions with "v" (e.g. 1.16.0 → v1.16.0). */
export function displayVersion(v) {
  return /^\d/.test(v) ? 'v' + v : v;
}

/** ISO datetime → "2026-06-06 14:32 UTC"; a date-only string passes through. */
export function fmtDateTime(dt) {
  if (!dt) return '';
  return dt.length <= 10 ? dt : dt.slice(0, 16).replace('T', ' ') + ' UTC';
}

/** Human "x days ago" relative to now (evaluated at render time). Unit phrasing
 *  and pluralization come from message definitions, so it localizes per-locale. */
export function relativeTime(dt) {
  if (!dt) return '';
  const then = new Date(dt).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return m.time_just_now();
  const min = Math.round(s / 60);
  if (min < 60) return m.time_minutes_ago({ count: min });
  const h = Math.round(min / 60);
  if (h < 24) return m.time_hours_ago({ count: h });
  const d = Math.round(h / 24);
  if (d < 30) return m.time_days_ago({ count: d });
  const mo = Math.round(d / 30);
  if (mo < 12) return m.time_months_ago({ count: mo });
  return m.time_years_ago({ count: Math.round(d / 365) });
}

/** Full localized date/time for hover text and other precise timestamps. */
export function fullDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleString(getLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

/** Tailwind text colour for a release date — fresh, aging, or stale. */
export function releaseFreshnessTone(dt) {
  if (!dt) return 'text-dim/80';
  const then = new Date(dt).getTime();
  if (Number.isNaN(then)) return 'text-dim/80';
  const ageMs = Date.now() - then;
  if (ageMs < 0) return 'text-dim/80';
  const day = 24 * 60 * 60 * 1000;
  if (ageMs <= 7 * day) return 'text-ok';
  if (ageMs <= 30 * day) return 'text-dim/80';
  if (ageMs <= 90 * day) return 'text-warn';
  return 'text-bad';
}

/** Use relative time only for fresh timestamps, falling back to a full date. */
export function recentTimeLabel(dt, maxAgeDays = 7) {
  if (!dt) return '';
  const then = new Date(dt).getTime();
  if (Number.isNaN(then)) return '';
  const age = Date.now() - then;
  if (age >= 0 && age < maxAgeDays * 24 * 60 * 60 * 1000) return relativeTime(dt);
  return fullDateTime(dt);
}
