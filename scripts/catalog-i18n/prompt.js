import { localeLanguageName } from './locale-names.js';
import {
  isRepeaterCommandsFieldPath,
  REPEATER_COMMANDS_FLAGS_PATH
} from '../../src/lib/catalog-i18n/repeater-commands.js';

const GROUP_PATH_PREFIX = 'rc.groups.';

/**
 * Full translation prompt sent to the model.
 * @param {string} targetLocale BCP-47 / project locale id, e.g. `cs`
 * @param {string} sourceText English catalog prose to translate
 */
export function translationPrompt(targetLocale, sourceText) {
  const targetLanguage = localeLanguageName(targetLocale);
  return `You are a professional software localizer for ${targetLanguage} (${targetLocale}).

Translate the text naturally and idiomatically for a public software catalog. Preserve the meaning, but freely adapt sentence structure, word order, terminology, and sentence boundaries so the result reads as if originally written in the target language.

Avoid literal translations of English compound phrases, unnatural noun or adjective chains, and unnecessary loanwords. Prefer terminology commonly used in software documentation.

Preserve product names, technical terms, URLs, Markdown, code, placeholders, units, and numbers. Do not add information.

Return only the translation.

Source:
${sourceText}`;
}

/**
 * Translation prompt for one repeater-commands JSON chunk (group or flags).
 * @param {string} targetLocale
 * @param {string} fieldPath
 * @param {string} sourceJson
 */
export function repeaterCommandsChunkPrompt(targetLocale, fieldPath, sourceJson) {
  const targetLanguage = localeLanguageName(targetLocale);
  const scope =
    fieldPath === REPEATER_COMMANDS_FLAGS_PATH
      ? 'command flag legend'
      : `command group "${fieldPath.slice(GROUP_PATH_PREFIX.length)}"`;

  return `You are a professional software localizer for ${targetLanguage} (${targetLocale}).

Translate the user-visible string VALUES in this JSON ${scope} for a MeshCore repeater CLI reference page. Keep the JSON structure and keys unchanged. Translate only human-readable fields (label, blurb, desc, range). Preserve command names, technical tokens, units, numbers, and pipe-separated enums (e.g. on|off).

Return only valid JSON.

Source:
${sourceJson}`;
}

/** Strip wrapping quotes models sometimes add despite instructions. */
export function cleanTranslationOutput(text) {
  const trimmed = String(text ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('«') && trimmed.endsWith('»'))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
