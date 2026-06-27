import { commandKey } from '../repeaterCommands.js';
import { sourceHash } from './source-hash.js';

export const REPEATER_COMMANDS_FLAGS_PATH = 'rc.flags';
const GROUP_PATH_PREFIX = 'rc.groups.';

/** @param {string} groupId */
export function repeaterCommandsGroupPath(groupId) {
  return `${GROUP_PATH_PREFIX}${groupId}`;
}

/** @param {string} path */
export function isRepeaterCommandsFieldPath(path) {
  return path === REPEATER_COMMANDS_FLAGS_PATH || path.startsWith(GROUP_PATH_PREFIX);
}

/**
 * @param {{ id: string, label: string, blurb?: string, commands: Array<Record<string, unknown>> }} group
 */
export function serializeGroupSlice(group) {
  /** @type {Record<string, { desc: string, range?: string }>} */
  const commands = {};
  for (const cmd of group.commands ?? []) {
    const key = commandKey(cmd);
    if (!key || typeof cmd.desc !== 'string') continue;
    commands[key] = { desc: cmd.desc };
    if (typeof cmd.range === 'string' && cmd.range.trim()) commands[key].range = cmd.range;
  }
  /** @type {{ label: string, blurb?: string, commands: Record<string, { desc: string, range?: string }> }} */
  const slice = { label: group.label, commands };
  if (typeof group.blurb === 'string' && group.blurb.trim()) slice.blurb = group.blurb;
  return JSON.stringify(slice, null, 2);
}

/** @param {string} json */
export function parseGroupSlice(json) {
  if (typeof json !== 'string' || !json.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.label !== 'string') return null;
    if (!parsed.commands || typeof parsed.commands !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {Record<string, { label: string, desc: string }>} flags */
export function serializeFlagsSlice(flags) {
  if (!flags || typeof flags !== 'object') return '';
  /** @type {Record<string, { label: string, desc: string }>} */
  const out = {};
  for (const [key, entry] of Object.entries(flags)) {
    if (!entry || typeof entry.label !== 'string' || typeof entry.desc !== 'string') continue;
    out[key] = { label: entry.label, desc: entry.desc };
  }
  return Object.keys(out).length ? JSON.stringify(out, null, 2) : '';
}

/** @param {string} json */
export function parseFlagsSlice(json) {
  if (typeof json !== 'string' || !json.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Translatable chunks: one JSON document per command group + one for flags.
 * @param {Array<{ id: string, label: string, blurb?: string, commands: Array<Record<string, unknown>> }>} groups
 * @param {Record<string, { label: string, desc: string }>} flags
 * @returns {import('./fields.js').TranslatableField[]}
 */
export function extractRepeaterCommandsFields(groups, flags) {
  /** @type {import('./fields.js').TranslatableField[]} */
  const fields = [];

  const flagsJson = serializeFlagsSlice(flags);
  if (flagsJson) {
    fields.push({
      path: REPEATER_COMMANDS_FLAGS_PATH,
      value: flagsJson,
      sourceHash: sourceHash(flagsJson)
    });
  }

  for (const group of groups) {
    if (!group?.id) continue;
    const value = serializeGroupSlice(group);
    if (!value) continue;
    fields.push({
      path: repeaterCommandsGroupPath(group.id),
      value,
      sourceHash: sourceHash(value)
    });
  }

  return fields;
}

/**
 * Merge one translated source chunk into a runtime overlay object.
 * @param {Record<string, unknown>} overlay
 * @param {string} path
 * @param {string} value
 */
export function mergeRepeaterCommandsOverlayField(overlay, path, value) {
  if (path === REPEATER_COMMANDS_FLAGS_PATH) {
    const parsed = parseFlagsSlice(value);
    if (parsed) overlay.flags = parsed;
    return true;
  }

  if (!path.startsWith(GROUP_PATH_PREFIX)) return false;

  const groupId = path.slice(GROUP_PATH_PREFIX.length);
  const slice = parseGroupSlice(value);
  if (!slice) return false;

  overlay.groups ??= {};
  overlay.groups[groupId] = {
    ...(typeof slice.label === 'string' ? { label: slice.label } : {}),
    ...(typeof slice.blurb === 'string' ? { blurb: slice.blurb } : {})
  };

  overlay.commands ??= {};
  for (const [cmdKey, texts] of Object.entries(slice.commands ?? {})) {
    if (!texts || typeof texts !== 'object') continue;
    overlay.commands[cmdKey] = {
      ...(typeof texts.desc === 'string' ? { desc: texts.desc } : {}),
      ...(typeof texts.range === 'string' ? { range: texts.range } : {})
    };
  }

  return true;
}

/**
 * Apply a repeater-commands overlay onto canonical groups and flag legend.
 * @param {Array<{ id: string, label: string, blurb?: string, commands: Array<Record<string, unknown>> }>} groups
 * @param {Record<string, { label: string, tone: string, desc: string }>} flags
 * @param {Record<string, unknown>|undefined} overlay
 */
export function applyRepeaterCommandsOverlay(groups, flags, overlay) {
  const localizedGroups = !overlay
    ? groups
    : groups.map((group) => {
        const groupPatch = overlay.groups?.[group.id];
        return {
          ...group,
          label: typeof groupPatch?.label === 'string' ? groupPatch.label : group.label,
          blurb: typeof groupPatch?.blurb === 'string' ? groupPatch.blurb : group.blurb,
          commands: group.commands.map((cmd) => {
            const patch = overlay.commands?.[commandKey(cmd)];
            if (!patch || typeof patch !== 'object') return cmd;
            return {
              ...cmd,
              desc: typeof patch.desc === 'string' ? patch.desc : cmd.desc,
              range: typeof patch.range === 'string' ? patch.range : cmd.range
            };
          })
        };
      });

  if (!overlay?.flags) return { groups: localizedGroups, flags };

  const localizedFlags = { ...flags };
  for (const [key, entry] of Object.entries(flags)) {
    const patch = overlay.flags?.[key];
    if (!patch || typeof patch !== 'object') continue;
    localizedFlags[key] = {
      ...entry,
      label: typeof patch.label === 'string' ? patch.label : entry.label,
      desc: typeof patch.desc === 'string' ? patch.desc : entry.desc
    };
  }

  return { groups: localizedGroups, flags: localizedFlags };
}
