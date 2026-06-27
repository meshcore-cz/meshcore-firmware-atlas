import { translationPrompt, cleanTranslationOutput, repeaterCommandsChunkPrompt } from './prompt.js';
import { cleanJsonTranslationOutput } from '../../src/lib/catalog-i18n/normalize.js';
import { isRepeaterCommandsFieldPath } from '../../src/lib/catalog-i18n/repeater-commands.js';

/** @typedef {{ text: string, sourceLocale: string, targetLocale: string, fieldPath: string }} TranslateRequest */

/** @typedef {{ durationMs: number, promptTokens?: number, completionTokens?: number, totalTokens?: number }} TranslateStats */

/** @typedef {{ value: string, stats: TranslateStats }} TranslateResult */

/** @param {number} start */
function elapsedMs(start) {
  return Math.round(performance.now() - start);
}

/** @param {Record<string, unknown>} data */
function statsFromOllama(data, durationMs) {
  const promptTokens =
    typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : undefined;
  const completionTokens = typeof data.eval_count === 'number' ? data.eval_count : undefined;
  const totalTokens =
    promptTokens != null && completionTokens != null ? promptTokens + completionTokens : undefined;
  return { durationMs, promptTokens, completionTokens, totalTokens };
}

/** @param {Record<string, unknown>} data @param {number} durationMs */
function statsFromOpenAI(data, durationMs) {
  const usage = /** @type {{ prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }} */ (
    data.usage ?? {}
  );
  return {
    durationMs,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens
  };
}

export class StubTranslationProvider {
  constructor(opts = {}) {
    this.model = opts.model ?? 'stub';
  }

  /** @param {TranslateRequest} req */
  async translate(req) {
    const start = performance.now();
    return {
      value: `[${req.targetLocale}] ${req.text}`,
      stats: { durationMs: elapsedMs(start) }
    };
  }
}

export class OllamaTranslationProvider {
  /** @param {{ model?: string, host?: string }} [opts] */
  constructor(opts = {}) {
    this.host = (opts.host ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(
      /\/+$/,
      ''
    );
    this.model = opts.model ?? process.env.OLLAMA_MODEL ?? '';
    /** @type {Promise<string>|null} */
    this._resolvedModel = null;
  }

  async resolveModel() {
    if (this.model) return this.model;
    if (!this._resolvedModel) {
      this._resolvedModel = fetch(`${this.host}/api/tags`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Ollama tags request failed (${res.status})`);
          const data = await res.json();
          const name = data.models?.[0]?.name;
          if (!name) {
            throw new Error(
              'No Ollama models installed. Pull one (e.g. ollama pull llama3.2) or set OLLAMA_MODEL.'
            );
          }
          return name;
        })
        .then((name) => {
          this.model = name;
          return name;
        });
    }
    return this._resolvedModel;
  }

  /** @param {TranslateRequest} req @returns {Promise<TranslateResult>} */
  async translate(req) {
    const model = await this.resolveModel();
    const prompt =
      req.prompt ??
      (isRepeaterCommandsFieldPath(req.fieldPath)
        ? repeaterCommandsChunkPrompt(req.targetLocale, req.fieldPath, req.text)
        : translationPrompt(req.targetLocale, req.text));
    const start = performance.now();

    const res = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
        options: { temperature: 0.2 }
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Ollama request failed (${res.status}): ${body}\n` +
          `Set OLLAMA_MODEL to an installed model (see: ollama list).`
      );
    }

    const data = await res.json();
    const raw = data.message?.content;
    const text = isRepeaterCommandsFieldPath(req.fieldPath)
      ? cleanJsonTranslationOutput(raw)
      : cleanTranslationOutput(raw);
    if (!text) throw new Error('Ollama returned empty translation');
    return {
      value: text,
      stats: statsFromOllama(data, elapsedMs(start))
    };
  }
}

export class OpenAITranslationProvider {
  /** @param {{ model?: string }} [opts] */
  constructor(opts = {}) {
    this.model = opts.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  /** @param {TranslateRequest} req @returns {Promise<TranslateResult>} */
  async translate(req) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const start = performance.now();
    const prompt =
      req.prompt ??
      (isRepeaterCommandsFieldPath(req.fieldPath)
        ? repeaterCommandsChunkPrompt(req.targetLocale, req.fieldPath, req.text)
        : translationPrompt(req.targetLocale, req.text));
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI request failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    const text = isRepeaterCommandsFieldPath(req.fieldPath)
      ? cleanJsonTranslationOutput(raw)
      : cleanTranslationOutput(raw);
    if (!text) throw new Error('OpenAI returned empty translation');
    return {
      value: text,
      stats: statsFromOpenAI(data, elapsedMs(start))
    };
  }
}

/**
 * @param {{ model?: string, host?: string, backend?: string }} [opts]
 * @returns {StubTranslationProvider | OllamaTranslationProvider | OpenAITranslationProvider}
 */
export function createTranslationProvider(opts = {}) {
  const backend = (opts.backend ?? process.env.I18N_TRANSLATOR ?? 'ollama').toLowerCase();
  if (backend === 'stub') return new StubTranslationProvider(opts);
  if (backend === 'openai') return new OpenAITranslationProvider(opts);
  return new OllamaTranslationProvider(opts);
}
