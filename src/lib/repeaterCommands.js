// Cheat-sheet data for the MeshCore *repeater* serial / remote-admin CLI.
//
// Sourced from the real firmware: the shared command handler in
// `src/helpers/CommonCLI.cpp` plus the repeater-only additions in
// `examples/simple_repeater/MyMesh.cpp` (setperm, get acl, discover.neighbors).
//
// Only the CURRENT release's full command catalogue lives in this module (it is
// what the page shows by default, so it belongs in the main bundle). Older
// releases are described by *when each command first appeared* (`addedIn`) — the
// page reuses this same catalogue and simply filters it per version, so no
// duplicate command lists are shipped. The heavier per-version metadata and
// changelog text live in `repeaterCommandsHistory.js`, which is loaded on demand
// (see `loadHistory`) so picking the current version costs nothing extra.

/** Upstream MeshCore firmware repository these commands are sourced from. */
export const FIRMWARE_REPO = 'https://github.com/meshcore-dev/MeshCore';

/** The newest tracked release — shown by default. */
export const CURRENT_VERSION = 'v1.16.0';

/** Earliest release tracked by this cheat sheet; the catalogue baseline. */
export const BASE_VERSION = 'v1.0.0a';

/**
 * Every tracked `repeater-*` release, oldest → newest. Ordering is by position
 * here (not numeric parsing) so pre-release suffixes like `v1.0.0a` sort
 * correctly. Just the strings — cheap to keep in the main bundle so version
 * filtering works without the history chunk.
 */
export const VERSION_ORDER = [
  'v1.0.0a', 'v1.0.0c', 'v1.0.0d',
  'v1.2.0', 'v1.2.1', 'v1.2.2',
  'v1.3.0',
  'v1.4.0', 'v1.4.1', 'v1.4.2', 'v1.4.3',
  'v1.5.0', 'v1.5.1',
  'v1.6.0', 'v1.6.1', 'v1.6.2',
  'v1.7.0', 'v1.7.1', 'v1.7.2', 'v1.7.3', 'v1.7.4',
  'v1.8.0', 'v1.8.1',
  'v1.9.0', 'v1.9.1',
  'v1.10.0', 'v1.11.0', 'v1.12.0', 'v1.13.0',
  'v1.14.0', 'v1.14.1',
  'v1.15.0', 'v1.16.0'
];

/** Repo-relative CLI source files (identical paths across all tracked tags). */
export const SOURCE_FILES = [
  { label: 'CommonCLI.cpp', path: 'src/helpers/CommonCLI.cpp' },
  { label: 'simple_repeater / MyMesh.cpp', path: 'examples/simple_repeater/MyMesh.cpp' }
];

/** Tag naming on the firmware repo, e.g. v1.16.0 -> repeater-v1.16.0. */
export function sourceRef(version) {
  return `repeater-${version}`;
}

/** Metadata for the current release (kept inline; history holds the rest). */
export const CURRENT_META = {
  version: CURRENT_VERSION,
  label: CURRENT_VERSION,
  date: '2026-06-06',
  current: true
};

/**
 * Build a link to a firmware source file at a given git ref.
 * @param {string} path  Repo-relative path.
 * @param {string} ref   Tag / branch / commit.
 */
export function firmwareSourceUrl(path, ref) {
  return `${FIRMWARE_REPO}/blob/${ref}/${path}`;
}

/** Compare two release strings by their position in VERSION_ORDER. */
export function cmpVersion(a, b) {
  const ia = VERSION_ORDER.indexOf(a);
  const ib = VERSION_ORDER.indexOf(b);
  return ia === ib ? 0 : ia < ib ? -1 : 1;
}

/** Is `entry` present (and not yet removed) in firmware `version`? */
export function availableIn(entry, version) {
  const since = entry.addedIn ?? BASE_VERSION;
  return cmpVersion(since, version) <= 0;
}

/** Is `entry` marked deprecated as of firmware `version`? */
export function deprecatedIn(entry, version) {
  return entry.deprecatedAt != null && cmpVersion(entry.deprecatedAt, version) <= 0;
}

/** Stable overlay / i18n key for a command entry (`start ota` → `start.ota`). */
export function commandKey(c) {
  if (c.cmd) return c.cmd.replace(/\s+/g, '.');
  return c.name ?? '';
}

/** Lazily load the (heavier) historical metadata + changelogs. */
export function loadHistory() {
  return import('./repeaterCommandsHistory.js');
}

/**
 * @typedef {Object} Command
 * @property {string} [cmd]   Standalone command (no get/set pair).
 * @property {string} [args]  Argument hint shown after `cmd`.
 * @property {string} [name]  Config key for a get/set pair.
 * @property {boolean} [get]  Has a `get <name>` form.
 * @property {string|boolean} [set] Has a `set <name> …` form; string = arg hint.
 * @property {string} desc    One-line, plain-language description.
 * @property {string} [range] Allowed values / units.
 * @property {string[]} [flags] Any of: serial, reboot, destructive, build.
 * @property {string} [addedIn] First firmware version the command appeared in.
 * @property {string} [deprecatedAt] Version from which it is deprecated.
 */

/** @type {{ id: string, label: string, blurb?: string, commands: Command[] }[]} */
export const COMMAND_GROUPS = [
  {
    id: 'power',
    label: 'Power & reboot',
    commands: [
      { cmd: 'reboot', desc: 'Restart the node.' },
      { cmd: 'poweroff', desc: 'Power the device off (alias: shutdown).', flags: ['destructive'], addedIn: 'v1.14.1' },
      { cmd: 'shutdown', desc: 'Same as poweroff.', flags: ['destructive'], addedIn: 'v1.14.1' },
      { cmd: 'clkreboot', desc: 'Reset the clock to a fixed epoch, then reboot.', addedIn: 'v1.12.0' },
      { cmd: 'start ota', desc: 'Begin an over-the-air firmware update.' },
      {
        cmd: 'erase',
        desc: 'Format the filesystem — wipes all settings (factory reset).',
        flags: ['serial', 'destructive']
      },
      {
        name: 'powersaving',
        get: true,
        set: 'on|off',
        desc: 'Low-power mode (nRF52: instant, ESP32: after 2 min).',
        flags: ['build'],
        addedIn: 'v1.12.0'
      }
    ]
  },
  {
    id: 'info',
    label: 'Identity & info',
    commands: [
      { cmd: 'ver', desc: 'Firmware version and build date.' },
      { cmd: 'board', desc: 'Hardware / manufacturer name.', addedIn: 'v1.9.1' },
      { name: 'role', get: true, desc: 'Configured node role.', addedIn: 'v1.4.2' },
      { name: 'public.key', get: true, desc: 'This node’s public key (hex).', addedIn: 'v1.4.2' },
      { name: 'prv.key', get: true, set: '<hex>', desc: 'Private key — rekeys the node.', flags: ['serial', 'reboot'], addedIn: 'v1.8.0' },
      { name: 'name', get: true, set: '<text>', desc: 'Node name shown in adverts.' },
      { name: 'owner.info', get: true, set: '<text>', desc: 'Owner / contact note (use | for newlines).', addedIn: 'v1.12.0' },
      { name: 'bootloader.ver', get: true, desc: 'Bootloader version (nRF52 only).', flags: ['build'], addedIn: 'v1.14.0' }
    ]
  },
  {
    id: 'access',
    label: 'Passwords & access control',
    commands: [
      { cmd: 'password', args: '<new>', desc: 'Set the admin password.' },
      { name: 'guest.password', get: true, set: '<text>', desc: 'Set the guest (read-only) password.' },
      {
        name: 'allow.read.only',
        get: true,
        set: 'on|off',
        desc: 'Allow guests to read config without the admin password.',
        addedIn: 'v1.4.1'
      },
      {
        cmd: 'setperm',
        args: '<pubkey> <0-3>',
        desc: 'Set a client’s permission: 0 guest · 1 read-only · 2 read-write · 3 admin.',
        addedIn: 'v1.9.0'
      },
      { cmd: 'get acl', desc: 'Print the access-control list.', flags: ['serial'], addedIn: 'v1.9.0' }
    ]
  },
  {
    id: 'radio',
    label: 'Radio',
    commands: [
      {
        name: 'radio',
        get: true,
        set: '<freq>,<bw>,<sf>,<cr>',
        desc: 'LoRa frequency (MHz), bandwidth (kHz), spreading factor and coding rate.',
        range: 'freq 150–2500 · bw 7.8–500 · sf 5–12 · cr 5–8',
        flags: ['reboot']
      },
      { name: 'freq', get: true, set: '<mhz>', desc: 'Frequency only (MHz).', flags: ['serial', 'reboot'] },
      { name: 'tx', get: true, set: '<dbm>', desc: 'Transmit power.', range: '-9 to 30 dBm' },
      {
        cmd: 'tempradio',
        args: '<freq>,<bw>,<sf>,<cr>,<mins>',
        desc: 'Switch radio params temporarily, then auto-revert.',
        range: 'mins > 0',
        addedIn: 'v1.7.4'
      },
      {
        name: 'radio.rxgain',
        get: true,
        set: 'on|off',
        desc: 'RX boosted gain (SX1262/1268/LR1110).',
        flags: ['build'],
        addedIn: 'v1.14.1'
      }
    ]
  },
  {
    id: 'forwarding',
    label: 'Forwarding & routing',
    commands: [
      { name: 'repeat', get: true, set: 'on|off', desc: 'Whether this node repeats (forwards) packets.' },
      {
        name: 'loop.detect',
        get: true,
        set: 'off|minimal|moderate|strict',
        desc: 'Routing loop-detection strictness.',
        addedIn: 'v1.14.0'
      },
      { name: 'path.hash.mode', get: true, set: '<0-2>', desc: 'Path-ID hash size.', range: '0, 1 or 2', addedIn: 'v1.14.0' },
      { name: 'flood.max', get: true, set: '<0-64>', desc: 'Max hops for scoped floods.', range: '0–64', addedIn: 'v1.3.0' },
      { name: 'flood.max.unscoped', get: true, set: '<0-64>', desc: 'Max hops for unscoped floods.', range: '0–64', addedIn: 'v1.16.0' },
      { name: 'flood.max.advert', get: true, set: '<0-64>', desc: 'Max hops for advert floods.', range: '0–64', addedIn: 'v1.16.0' },
      { name: 'multi.acks', get: true, set: '<0|1>', desc: 'Allow multiple ACKs per packet.', range: '0 or 1', addedIn: 'v1.7.4' }
    ]
  },
  {
    id: 'timing',
    label: 'Timing & airtime',
    commands: [
      { name: 'dutycycle', get: true, set: '<1-100>', desc: 'Target TX duty-cycle percent.', range: '1–100', addedIn: 'v1.15.0' },
      { name: 'af', get: true, set: '<value>', desc: 'Airtime factor.', deprecatedAt: 'v1.15.0' },
      { name: 'rxdelay', get: true, set: '<value>', desc: 'Base receive delay.', range: '0–20' },
      { name: 'txdelay', get: true, set: '<value>', desc: 'Flood retransmit delay factor.', range: '0–2' },
      { name: 'direct.txdelay', get: true, set: '<value>', desc: 'Direct-traffic delay factor.', range: '0–2' },
      { name: 'int.thresh', get: true, set: '<value>', desc: 'Interference (noise) threshold.', addedIn: 'v1.7.0' },
      {
        name: 'agc.reset.interval',
        get: true,
        set: '<secs>',
        desc: 'AGC reset interval (rounded to multiples of 4s).',
        addedIn: 'v1.7.1'
      }
    ]
  },
  {
    id: 'advert',
    label: 'Advertising',
    commands: [
      { cmd: 'advert', desc: 'Send a flood advertisement now.' },
      { cmd: 'advert.zerohop', desc: 'Send a zero-hop (neighbours-only) advert now.', addedIn: 'v1.14.0' },
      {
        name: 'advert.interval',
        get: true,
        set: '<mins>',
        desc: 'Zero-hop advert interval.',
        range: '60–240 min (0 = off)'
      },
      {
        name: 'flood.advert.interval',
        get: true,
        set: '<hours>',
        desc: 'Flood advert interval.',
        range: '3–168 h (0 = off)',
        addedIn: 'v1.4.1'
      }
    ]
  },
  {
    id: 'location',
    label: 'Location',
    commands: [
      { name: 'lat', get: true, set: '<deg>', desc: 'Node latitude.' },
      { name: 'lon', get: true, set: '<deg>', desc: 'Node longitude.' },
      { name: 'adc.multiplier', get: true, set: '<value>', desc: 'Battery ADC calibration (0 = board default).', range: '0–10', addedIn: 'v1.11.0' }
    ]
  },
  {
    id: 'neighbors',
    label: 'Neighbours',
    commands: [
      { cmd: 'neighbors', desc: 'List recently heard neighbours.', addedIn: 'v1.6.0' },
      { cmd: 'neighbor.remove', args: '<pubkey>', desc: 'Forget a neighbour by public key.', addedIn: 'v1.8.0' },
      { cmd: 'discover.neighbors', desc: 'Send a zero-hop neighbour-discovery request.', addedIn: 'v1.14.0' }
    ]
  },
  {
    id: 'clock',
    label: 'Clock',
    commands: [
      { cmd: 'clock', desc: 'Show current UTC time.' },
      { cmd: 'clock sync', desc: 'Sync clock to the sender’s timestamp.' },
      { cmd: 'time', args: '<epoch>', desc: 'Set clock to a Unix epoch (cannot go backwards).' }
    ]
  },
  {
    id: 'stats',
    label: 'Stats & logging',
    commands: [
      { cmd: 'clear stats', desc: 'Reset all statistics counters.', addedIn: 'v1.6.1' },
      { cmd: 'stats-core', desc: 'Battery, uptime, queue length, debug flags.', flags: ['serial'], addedIn: 'v1.10.0' },
      { cmd: 'stats-radio', desc: 'Noise floor, RSSI/SNR, airtime, errors.', flags: ['serial'], addedIn: 'v1.10.0' },
      { cmd: 'stats-packets', desc: 'Sent / received packet counters.', flags: ['serial'], addedIn: 'v1.10.0' },
      { cmd: 'log start', desc: 'Start capturing the receive log to storage.' },
      { cmd: 'log stop', desc: 'Stop capturing the receive log.' },
      { cmd: 'log erase', desc: 'Delete the stored log.' },
      { cmd: 'log', desc: 'Dump the stored log to the serial console.', flags: ['serial'] }
    ]
  },
  {
    id: 'regions',
    label: 'Regions',
    blurb:
      'Region scoping controls where floods propagate. `region` with no argument lists every defined region.',
    commands: [
      { cmd: 'region', desc: 'List all defined regions.', addedIn: 'v1.10.0' },
      { cmd: 'region get', args: '<name>', desc: 'Show one region and its parent / flood flag.', addedIn: 'v1.15.0' },
      { cmd: 'region put', args: '<name> [parent]', desc: 'Create a region (flood allowed by default).', addedIn: 'v1.15.0' },
      { cmd: 'region def', args: '<tokens>', desc: 'Define a hierarchy in one line (| or , branches).', addedIn: 'v1.16.0' },
      { cmd: 'region remove', args: '<name>', desc: 'Delete a region (must be empty).', addedIn: 'v1.15.0' },
      { cmd: 'region load', desc: 'Begin bulk indented region load (blank line ends it).', addedIn: 'v1.15.0' },
      { cmd: 'region save', desc: 'Persist region changes to storage.', addedIn: 'v1.15.0' },
      { cmd: 'region home', args: '[name]', desc: 'View or set the home region.', addedIn: 'v1.15.0' },
      { cmd: 'region default', args: '[name]', desc: 'View or set the default scope (<null> to clear).', addedIn: 'v1.15.0' },
      { cmd: 'region allowf', args: '<name>', desc: 'Allow flooding in a region (* = wildcard).', addedIn: 'v1.15.0' },
      { cmd: 'region denyf', args: '<name>', desc: 'Deny flooding in a region.', addedIn: 'v1.15.0' },
      { cmd: 'region list', args: 'allowed|denied', desc: 'List regions by flood permission.', addedIn: 'v1.15.0' }
    ]
  },
  {
    id: 'gps',
    label: 'GPS',
    blurb: 'Available only on GPS-enabled builds.',
    commands: [
      { cmd: 'gps', desc: 'Show GPS status (fix, sats).', flags: ['build'], addedIn: 'v1.10.0' },
      { cmd: 'gps on', desc: 'Enable the GPS hardware.', flags: ['build'], addedIn: 'v1.10.0' },
      { cmd: 'gps off', desc: 'Disable the GPS hardware.', flags: ['build'], addedIn: 'v1.10.0' },
      { cmd: 'gps sync', desc: 'Sync the clock from GPS time.', flags: ['build'], addedIn: 'v1.10.0' },
      { cmd: 'gps setloc', desc: 'Copy the current GPS fix into node lat/lon.', flags: ['build'], addedIn: 'v1.10.0' },
      {
        cmd: 'gps advert',
        args: '[none|share|prefs]',
        desc: 'View / set the location-sharing policy for adverts.',
        flags: ['build'],
        addedIn: 'v1.10.0'
      }
    ]
  },
  {
    id: 'sensors',
    label: 'Sensors',
    commands: [
      { cmd: 'sensor list', args: '[start]', desc: 'List custom sensor variables.', addedIn: 'v1.10.0' },
      { cmd: 'sensor get', args: '<key>', desc: 'Read one sensor variable.', addedIn: 'v1.10.0' },
      { cmd: 'sensor set', args: '<key> <value>', desc: 'Write one sensor variable.', addedIn: 'v1.10.0' }
    ]
  },
  {
    id: 'bridge',
    label: 'Bridge & power mgmt',
    blurb: 'Bridge keys appear only on bridge builds; pwrmgt on nRF52 power-managed builds.',
    commands: [
      { name: 'bridge.type', get: true, desc: 'Configured bridge type (rs232 / espnow / none).', addedIn: 'v1.10.0' },
      { name: 'bridge.enabled', get: true, set: 'on|off', desc: 'Enable / disable the bridge.', flags: ['build'], addedIn: 'v1.10.0' },
      { name: 'bridge.delay', get: true, set: '<ms>', desc: 'Bridge routing delay.', range: '0–10000 ms', flags: ['build'], addedIn: 'v1.10.0' },
      { name: 'bridge.source', get: true, set: 'logRx|logTx', desc: 'Which packet stream to bridge.', flags: ['build'], addedIn: 'v1.10.0' },
      { name: 'bridge.baud', get: true, set: '<rate>', desc: 'RS-232 baud rate.', range: '9600–115200', flags: ['build'], addedIn: 'v1.10.0' },
      { name: 'bridge.channel', get: true, set: '<1-14>', desc: 'ESP-NOW channel.', range: '1–14', flags: ['build'], addedIn: 'v1.10.0' },
      { name: 'bridge.secret', get: true, set: '<text>', desc: 'ESP-NOW shared secret (≤15 chars).', flags: ['build'], addedIn: 'v1.10.0' },
      { name: 'pwrmgt.support', get: true, desc: 'Whether power management is supported.', flags: ['build'], addedIn: 'v1.12.0' },
      { name: 'pwrmgt.source', get: true, desc: 'Current power source (external / battery).', flags: ['build'], addedIn: 'v1.12.0' },
      { name: 'pwrmgt.bootreason', get: true, desc: 'Last reset / shutdown reason.', flags: ['build'], addedIn: 'v1.12.0' },
      { name: 'pwrmgt.bootmv', get: true, desc: 'Boot voltage in mV.', flags: ['build'], addedIn: 'v1.12.0' }
    ]
  }
];

/** Short explanations for the flag badges, shown in the page legend. */
export const COMMAND_FLAGS = {
  serial: { label: 'USB only', tone: 'amber', desc: 'Serial console only — not accepted over-the-air.' },
  reboot: { label: 'Reboot', tone: 'sky', desc: 'Takes effect only after a reboot.' },
  destructive: { label: 'Careful', tone: 'rose', desc: 'Irreversible — double-check before running.' },
  build: { label: 'Build-gated', tone: 'violet', desc: 'Only on firmware compiled with this feature.' }
};
