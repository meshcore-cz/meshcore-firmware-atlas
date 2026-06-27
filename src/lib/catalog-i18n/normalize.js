/** Normalize translatable source text (browser-safe; no hashing). */
export function normalizeSourceText(value) {
  if (value == null) return '';
  return String(value)
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** @param {unknown} features */
export function serializeFeaturesField(features) {
  return serializeStringArrayField(features);
}

/** @param {unknown} tags */
export function serializeTagsField(tags) {
  return serializeStringArrayField(tags);
}

/** @param {unknown} items */
export function serializeStringArrayField(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return JSON.stringify(items);
}

/** @param {unknown} value */
export function parseFeaturesField(value) {
  return parseStringArrayField(value);
}

/** @param {unknown} value */
export function parseTagsField(value) {
  return parseStringArrayField(value);
}

/** @param {unknown} value */
export function parseStringArrayField(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Strip wrapping quotes / markdown fences from a model JSON response. */
export function cleanJsonTranslationOutput(text) {
  let trimmed = String(text ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (fence) trimmed = fence[1].trim();
  return trimmed;
}
