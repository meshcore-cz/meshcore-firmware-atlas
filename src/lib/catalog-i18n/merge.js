import { noteIdsForTexts } from './ids.js';
import { noteStableId, noteText } from './keys.js';
import { parseFeaturesField } from './normalize.js';

/**
 * Resolve a dotted path against a resource overlay object.
 * @param {Record<string, unknown>|undefined} resource
 * @param {string} path
 * @returns {string|undefined}
 */
export function resolveOverlayPath(resource, path) {
  if (!resource) return undefined;

  if (path === 'description' || path === 'notes') {
    const v = resource[path];
    return typeof v === 'string' ? v : undefined;
  }

  if (path.startsWith('screenshots.')) {
    const rest = path.slice('screenshots.'.length);
    const dot = rest.lastIndexOf('.');
    if (dot === -1) return undefined;
    const file = rest.slice(0, dot);
    const field = rest.slice(dot + 1);
    if (field !== 'caption') return undefined;
    const shot = resource.screenshots?.[file];
    const cap = shot?.caption;
    return typeof cap === 'string' ? cap : undefined;
  }

  if (path.startsWith('verificationNotes.')) {
    const id = path.slice('verificationNotes.'.length);
    const v = resource.verificationNotes?.[id];
    return typeof v === 'string' ? v : undefined;
  }

  if (path.startsWith('deviceNotes.')) {
    const id = path.slice('deviceNotes.'.length);
    const v = resource.deviceNotes?.[id];
    return typeof v === 'string' ? v : undefined;
  }

  if (path.startsWith('softwareCapabilities.')) {
    const slug = path.slice('softwareCapabilities.'.length);
    const v = resource.softwareCapabilities?.[slug];
    return typeof v === 'string' ? v : undefined;
  }

  if (path.startsWith('commands.')) {
    const rest = path.slice('commands.'.length);
    const dot = rest.indexOf('.');
    if (dot === -1) return undefined;
    const cmdKey = rest.slice(0, dot);
    const field = rest.slice(dot + 1);
    const v = resource.commands?.[cmdKey]?.[field];
    return typeof v === 'string' ? v : undefined;
  }

  if (path.startsWith('groups.')) {
    const rest = path.slice('groups.'.length);
    const dot = rest.indexOf('.');
    if (dot === -1) return undefined;
    const groupId = rest.slice(0, dot);
    const field = rest.slice(dot + 1);
    const v = resource.groups?.[groupId]?.[field];
    return typeof v === 'string' ? v : undefined;
  }

  const parts = path.split('.');
  let cur = resource;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * Apply a compact resource overlay onto a catalog record copy.
 * @param {Record<string, unknown>} record
 * @param {Record<string, unknown>|undefined} overlay
 */
export function applyResourceOverlay(record, overlay) {
  if (!overlay) return record;

  const out = { ...record };

  if (typeof overlay.description === 'string') out.description = overlay.description;
  if (typeof overlay.notes === 'string') out.notes = overlay.notes;
  if (Array.isArray(overlay.features)) out.features = overlay.features;
  if (Array.isArray(overlay.tags)) out.tags = overlay.tags;

  if (overlay.screenshots && Array.isArray(out.screenshots)) {
    out.screenshots = out.screenshots.map((shot) => {
      const cap = overlay.screenshots?.[shot.file]?.caption;
      return typeof cap === 'string' ? { ...shot, caption: cap } : shot;
    });
  }

  if (overlay.screenshots && Array.isArray(out.screenshotUrls)) {
    out.screenshotUrls = out.screenshotUrls.map((shot) => {
      const cap = overlay.screenshots?.[shot.file]?.caption;
      return typeof cap === 'string' ? { ...shot, caption: cap } : shot;
    });
  }

  if (overlay.verificationNotes && out.verification?.notes) {
    const notes = out.verification.notes;
    const autoIds = noteIdsForTexts(notes.map(noteText));
    out.verification = {
      ...out.verification,
      notes: notes.map((note, i) => {
        const text = noteText(note);
        const id = noteStableId(note, autoIds[i]);
        return overlay.verificationNotes[id] ?? text;
      })
    };
  }

  if (overlay.deviceNotes && Array.isArray(out.devices)) {
    out.devices = out.devices.map((dev) => {
      const notes = overlay.deviceNotes[dev.id];
      return typeof notes === 'string' ? { ...dev, notes } : dev;
    });
  }

  if (overlay.family || overlay.radio || overlay.display || overlay.gnss) {
    for (const section of ['family', 'radio', 'display', 'gnss', 'architecture', 'frequency']) {
      if (!overlay[section] || !out[section]) continue;
      out[section] = mergeGlobalsSection(out[section], overlay[section]);
    }
  }

  return out;
}

export { applyRepeaterCommandsOverlay } from './repeater-commands.js';

/** @param {Record<string, unknown>} base @param {Record<string, unknown>} patch */
function mergeGlobalsSection(base, patch) {
  const out = { ...base };
  for (const [key, entry] of Object.entries(patch)) {
    if (!entry || typeof entry !== 'object') continue;
    const current = out[key];
    if (!current || typeof current !== 'object') {
      out[key] = entry;
      continue;
    }
    const merged = { ...current };
    if (typeof entry.description === 'string') merged.description = entry.description;
    if (entry.models && merged.models) {
      const models = { ...merged.models };
      for (const [modelKey, modelPatch] of Object.entries(entry.models)) {
        if (!modelPatch || typeof modelPatch !== 'object') continue;
        models[modelKey] = { ...(models[modelKey] ?? {}), ...modelPatch };
      }
      merged.models = models;
    }
    out[key] = merged;
  }
  return out;
}
