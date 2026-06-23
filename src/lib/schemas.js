// The schema bundle is produced by `npm run build:data` (scripts/build-data.js)
// from the YAML files under schema/. It powers the in-app schema explorer.
// The same content is also published at /schemas.json.
import bundle from '$lib/generated/schemas.json';

/** Every schema, in the order they were read (alphabetical by filename). */
export function allSchemas() {
  return bundle.schemas;
}

/** Look up one schema entry by its id (the YAML filename without extension). */
export function getSchema(id) {
  return bundle.schemas.find((s) => s.id === id) ?? null;
}

// Resolve an internal `#/$defs/<name>` reference against a root schema's $defs.
// Returns null for external or unknown refs so the renderer can show the raw
// $ref instead of breaking.
export function resolveRef(ref, root) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  const path = ref.slice(2).split('/');
  let node = root;
  for (const key of path) {
    if (node == null || typeof node !== 'object') return null;
    node = node[decodeURIComponent(key.replace(/~1/g, '/').replace(/~0/g, '~'))];
  }
  return node ?? null;
}

// A short human label for a schema node's type, e.g. "string", "string[]",
// "object", "number | null", or the referenced $def name.
export function typeLabel(schema, root) {
  if (!schema || typeof schema !== 'object') return '';
  if (schema.$ref) {
    const name = schema.$ref.startsWith('#/$defs/') ? schema.$ref.slice('#/$defs/'.length) : schema.$ref;
    return name;
  }
  if (schema.enum) return 'enum';
  if (schema.const !== undefined) return 'const';
  if (Array.isArray(schema.oneOf)) return 'one of';
  if (Array.isArray(schema.anyOf)) return 'any of';
  if (Array.isArray(schema.allOf)) return 'all of';
  let t = schema.type;
  if (Array.isArray(t)) return t.join(' | ');
  if (t === 'array') {
    const items = schema.items;
    if (items && !Array.isArray(items)) return `${typeLabel(items, root) || 'any'}[]`;
    return 'array';
  }
  return t ?? 'any';
}

// Collect the validation constraints worth surfacing as small chips, as
// [label, value] pairs. Skips structural keywords handled elsewhere
// (properties, items, $ref, description, examples…).
export function constraintChips(schema) {
  if (!schema || typeof schema !== 'object') return [];
  const chips = [];
  const add = (label, value) => {
    if (value !== undefined && value !== null) chips.push([label, value]);
  };
  add('format', schema.format);
  add('pattern', schema.pattern);
  add('min', schema.minimum);
  add('min', schema.exclusiveMinimum !== undefined ? `> ${schema.exclusiveMinimum}` : undefined);
  add('max', schema.maximum);
  add('max', schema.exclusiveMaximum !== undefined ? `< ${schema.exclusiveMaximum}` : undefined);
  add('minLength', schema.minLength);
  add('maxLength', schema.maxLength);
  add('minItems', schema.minItems);
  add('maxItems', schema.maxItems);
  add('minProps', schema.minProperties);
  add('uniqueItems', schema.uniqueItems ? 'true' : undefined);
  if (schema.default !== undefined) add('default', JSON.stringify(schema.default));
  return chips;
}
