import { noteIdsForTexts } from './ids.js';
import { noteStableId, noteText } from './keys.js';
import { parseFeaturesField, parseTagsField, serializeFeaturesField, serializeTagsField } from './normalize.js';
import { sourceHash } from './source-hash.js';
import {
  mergeRepeaterCommandsOverlayField,
  extractRepeaterCommandsFields
} from './repeater-commands.js';

export { resourceKey, singularKind } from './keys.js';

/** @typedef {{ path: string, value: string, sourceHash: string }} TranslatableField */

/**
 * @param {string} kind
 * @param {Record<string, unknown>} record
 * @param {{ firmwareId?: string, firmwareVersion?: string, deviceId?: string }} [ctx]
 * @returns {TranslatableField[]}
 */
export function extractTranslatableFields(kind, record, ctx = {}) {
  /** @type {TranslatableField[]} */
  const fields = [];

  const add = (path, value) => {
    if (typeof value !== 'string' || !value.trim()) return;
    fields.push({ path, value, sourceHash: sourceHash(value) });
  };

  add('description', record.description);

  if (kind === 'software' || kind === 'softwares') {
    for (const shot of record.screenshots ?? []) {
      if (shot?.file) add(`screenshots.${shot.file}.caption`, shot.caption);
    }
    const tags = serializeTagsField(record.tags);
    if (tags) add('tags', tags);
  }

  if (kind === 'firmware' || kind === 'firmwares') {
    for (const dev of record.devices ?? []) {
      if (dev?.id) add(`deviceNotes.${dev.id}`, dev.notes);
    }
    const features = serializeFeaturesField(record.features);
    if (features) add('features', features);
  }

  const notes = record.verification?.notes ?? [];
  const autoIds = noteIdsForTexts(notes.map(noteText));
  notes.forEach((note, i) => {
    const text = noteText(note);
    const id = noteStableId(note, autoIds[i]);
    add(`verificationNotes.${id}`, text);
  });

  if (kind === 'compatibility') {
    add('notes', record.notes);
  }

  if (kind === 'globals') {
    for (const [section, entries] of Object.entries(record)) {
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
      for (const [key, entry] of Object.entries(entries)) {
        if (!entry || typeof entry !== 'object') continue;
        add(`${section}.${key}.description`, entry.description);
        if (entry.models && typeof entry.models === 'object') {
          for (const [modelKey, model] of Object.entries(entry.models)) {
            if (model && typeof model === 'object') {
              add(`${section}.${key}.models.${modelKey}.description`, model.description);
            }
          }
        }
      }
    }
  }

  if (kind === 'taxonomy') {
    for (const [slug, label] of Object.entries(record.softwareCapabilities ?? {})) {
      if (typeof label === 'string') add(`softwareCapabilities.${slug}`, label);
    }
  }

  if (kind === 'repeater-commands') {
    return extractRepeaterCommandsFields(record.groups ?? [], record.flags ?? {});
  }

  return fields;
}

/**
 * Convert flat source field paths to nested runtime overlay resource object.
 * @param {Record<string, { value: string }>} fields
 */
export function fieldsToResourceOverlay(fields) {
  /** @type {Record<string, unknown>} */
  const out = {};

  for (const [path, entry] of Object.entries(fields)) {
    const value = entry.value;
    if (path === 'description' || path === 'notes') {
      out[path] = value;
      continue;
    }

    if (path === 'features') {
      const parsed = parseFeaturesField(value);
      if (parsed) out.features = parsed;
      continue;
    }

    if (path === 'tags') {
      const parsed = parseTagsField(value);
      if (parsed) out.tags = parsed;
      continue;
    }

    if (path.startsWith('screenshots.')) {
      const rest = path.slice('screenshots.'.length);
      const dot = rest.lastIndexOf('.');
      if (dot === -1) continue;
      const file = rest.slice(0, dot);
      const field = rest.slice(dot + 1);
      if (field !== 'caption') continue;
      out.screenshots ??= {};
      out.screenshots[file] = { caption: value };
      continue;
    }

    if (path.startsWith('verificationNotes.')) {
      const id = path.slice('verificationNotes.'.length);
      out.verificationNotes ??= {};
      out.verificationNotes[id] = value;
      continue;
    }

    if (path.startsWith('deviceNotes.')) {
      const id = path.slice('deviceNotes.'.length);
      out.deviceNotes ??= {};
      out.deviceNotes[id] = value;
      continue;
    }

    if (path.startsWith('softwareCapabilities.')) {
      const slug = path.slice('softwareCapabilities.'.length);
      out.softwareCapabilities ??= {};
      out.softwareCapabilities[slug] = value;
      continue;
    }

    if (mergeRepeaterCommandsOverlayField(out, path, value)) continue;

    if (path.startsWith('family.') || path.startsWith('radio.') || path.startsWith('display.')) {
      setNested(out, path.split('.'), value);
    }
  }

  return out;
}

/** @param {Record<string, unknown>} obj @param {string[]} parts @param {string} value */
function setNested(obj, parts, value) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
    cur = /** @type {Record<string, unknown>} */ (cur[key]);
  }
  cur[parts.at(-1)] = value;
}

/** Supported flat field path prefixes for validation. */
export const SUPPORTED_FIELD_PREFIXES = [
  'description',
  'notes',
  'features',
  'tags',
  'screenshots.',
  'verificationNotes.',
  'deviceNotes.',
  'softwareCapabilities.',
  'rc.flags',
  'rc.groups.',
  'family.',
  'radio.',
  'display.',
  'gnss.',
  'architecture.',
  'frequency.'
];

/** @param {string} path */
export function isSupportedFieldPath(path) {
  return SUPPORTED_FIELD_PREFIXES.some(
    (prefix) => path === prefix.replace(/\.$/, '') || path.startsWith(prefix)
  );
}
