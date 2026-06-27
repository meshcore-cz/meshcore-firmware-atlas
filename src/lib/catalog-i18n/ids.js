import { normalizeSourceText } from './normalize.js';

/** Derive a stable kebab-case id from verification note text. */
export function noteId(text) {
  const slug = normalizeSourceText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'note';
}

/** Assign stable ids to an array of note strings; suffix on collision. */
export function noteIdsForTexts(texts) {
  const seen = new Map();
  return texts.map((text) => {
    let id = noteId(text);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count + 1}`;
    return id;
  });
}

export const STABLE_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
