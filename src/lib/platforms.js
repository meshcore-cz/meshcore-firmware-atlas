// Platform slugs from software.yaml `platforms` — labels and Iconify icon ids.

/** @typedef {{ label: string, icon?: string }} PlatformMeta */

/** @type {Record<string, PlatformMeta>} */
export const PLATFORMS = {
  android: { label: 'Android', icon: 'simple-icons:android' },
  arduino: { label: 'Arduino', icon: 'simple-icons:arduino' },
  'commodore-64': { label: 'Commodore 64', icon: 'simple-icons:commodore' },
  docker: { label: 'Docker', icon: 'simple-icons:docker' },
  domoticz: { label: 'Domoticz' },
  'esp-idf': { label: 'ESP-IDF', icon: 'simple-icons:espressif' },
  esp32: { label: 'ESP32', icon: 'simple-icons:espressif' },
  esphome: { label: 'ESPHome', icon: 'simple-icons:esphome' },
  haiku: { label: 'Haiku' },
  'home-assistant': { label: 'Home Assistant', icon: 'simple-icons:homeassistant' },
  ios: { label: 'iOS', icon: 'simple-icons:apple' },
  ipados: { label: 'iPadOS', icon: 'simple-icons:apple' },
  kubernetes: { label: 'Kubernetes', icon: 'simple-icons:kubernetes' },
  linux: { label: 'Linux', icon: 'simple-icons:linux' },
  'm5stack-cardputer': { label: 'M5Stack Cardputer', icon: 'simple-icons:m5stack' },
  macos: { label: 'macOS', icon: 'simple-icons:apple' },
  nixos: { label: 'NixOS', icon: 'simple-icons:nixos' },
  nrf52: { label: 'nRF52', icon: 'simple-icons:nordicsemiconductor' },
  picomite: { label: 'Picomite', icon: 'simple-icons:micropython' },
  proxmox: { label: 'Proxmox', icon: 'simple-icons:proxmox' },
  'raspberry-pi': { label: 'Raspberry Pi', icon: 'simple-icons:raspberrypi' },
  'raspberry-pi-pico': { label: 'Raspberry Pi Pico', icon: 'simple-icons:raspberrypi' },
  stm32: { label: 'STM32', icon: 'simple-icons:stmicroelectronics' },
  web: { label: 'Web', icon: 'lucide:globe' },
  windows: { label: 'Windows', icon: 'simple-icons:windows' }
};

/** @param {string} slug */
export function platformMeta(slug) {
  const known = PLATFORMS[slug];
  if (known) return known;
  return { label: slug.replace(/-/g, ' ') };
}

/** @param {string} slug */
export function platformIconifyId(slug) {
  return PLATFORMS[slug]?.icon ?? null;
}

/** Dedupe platforms that share the same icon (e.g. ios + ipados). */
export function uniquePlatformsForIcons(platforms) {
  const seen = new Set();
  const out = [];
  for (const p of platforms) {
    const key = platformIconifyId(p) ?? p;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
