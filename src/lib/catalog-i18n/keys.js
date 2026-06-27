import { noteId } from './ids.js';

/**
 * @param {string} kind
 * @param {Record<string, unknown>} record
 * @param {{ firmwareId?: string, firmwareVersion?: string, deviceId?: string }} [ctx]
 */
export function resourceKey(kind, record, ctx = {}) {
  if (kind === 'compatibility') {
    return `compatibility/${ctx.firmwareId}/${ctx.firmwareVersion}/${ctx.deviceId}`;
  }
  if (kind === 'globals') return 'globals';
  if (kind === 'taxonomy') return 'taxonomy';
  if (kind === 'repeater-commands') return 'repeater-commands';
  return `${singularKind(kind)}/${record.id}`;
}

/** @param {string} kind */
export function singularKind(kind) {
  const map = {
    devices: 'device',
    device: 'device',
    firmwares: 'firmware',
    firmware: 'firmware',
    software: 'software',
    vendors: 'vendor',
    vendor: 'vendor',
    networks: 'network',
    network: 'network',
    compatibility: 'compatibility',
    globals: 'globals',
    taxonomy: 'taxonomy',
    'repeater-commands': 'repeater-commands'
  };
  return map[kind] ?? kind;
}

/** @param {unknown} note */
export function noteText(note) {
  if (typeof note === 'string') return note;
  if (note && typeof note === 'object' && 'text' in note) return String(note.text);
  return '';
}

/** @param {unknown} note @param {string} [fallbackId] */
export function noteStableId(note, fallbackId) {
  if (note && typeof note === 'object' && 'id' in note && note.id) return String(note.id);
  return fallbackId ?? noteId(noteText(note));
}
