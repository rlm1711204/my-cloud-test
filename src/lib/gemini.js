// Google Gemini (free tier) as a word-card provider, via the Generative Language REST API.
// Same prompts and card schema as the Claude provider, so cards look identical.
import { RESULT_SCHEMA, enrichInstruction, extractInstruction, systemPrompt } from "./ai.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_AUTO = "auto";
// Used when the model list can't be fetched. Tried in order; free-tier Flash models.
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

export class GeminiError extends Error {
  constructor(message, { status = 0, quota = false } = {}) {
    super(message);
    this.status = status;
    this.quota = quota;
  }
}

/** Convert our JSON Schema to Gemini's responseSchema (OpenAPI subset: upper-case types, no additionalProperties). */
export function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "additionalProperties") continue;
    if (k === "type") out.type = String(v).toUpperCase();
    else if (k === "properties") out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toGeminiSchema(pv)]));
    else if (k === "items") out.items = toGeminiSchema(v);
    else out[k] = v;
  }
  if (schema.properties && schema.required) out.propertyOrdering = schema.required;
  return out;
}

/**
 * Rank Gemini models for this job: stable Flash before previews, newest first, then Flash-Lite (larger free
 * quota). Special-purpose variants (image, audio, TTS, live, experimental) are skipped. Pure; unit-tested.
 */
export function rankModels(models) {
  const version = (id) => Number((/gemini-(\d+(?:\.\d+)?)/.exec(id) || [])[1] || 0);
  return models
    .filter((m) => (m.supportedGenerationMethods || ["generateContent"]).includes("generateContent"))
    .map((m) => String(m.name || "").replace(/^models\//, ""))
    .filter((id) => /^gemini-[\d.]+-flash(-lite)?(-\d{3})?(-preview(-[\d-]+)?)?$/.test(id))
    .sort(
      (a, b) =>
        Number(a.includes("-lite")) - Number(b.includes("-lite")) ||
        Number(a.includes("preview")) - Number(b.includes("preview")) ||
        version(b) - version(a) ||
        a.length - b.length,
    );
}

let modelCache = { key: "", list: null };

async function candidateModels(settings) {
  if (settings.geminiModel && settings.geminiModel !== GEMINI_AUTO) {
    return [settings.geminiModel, ...FALLBACK_MODELS.filter((m) => m !== settings.geminiModel)];
  }
  if (modelCache.key === settings.geminiKey && modelCache.list) return modelCache.list;
  try {
    const res = await fetch(`${BASE}/models?pageSize=200&key=${encodeURIComponent(settings.geminiKey)}`);
    if (res.ok) {
      const ranked = rankModels((await res.json()).models || []);
      // Best Flash plus best Flash-Lite is enough: Lite is the quota fallback.
      const best = [ranked.find((m) => !m.includes("-lite")), ranked.find((m) => m.includes("-lite"))].filter(Boolean);
      if (best.length) {
        modelCache = { key: settings.geminiKey, list: best };
        return best;
      }
    } else if (res.status === 400 || res.status === 403) {
      throw await toError(res);
    }
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    /* network hiccup: use the built-in list */
  }
  return FALLBACK_MODELS;
}

async function toError(res) {
  let msg = "";
  try {
    msg = (await res.json()).error?.message || "";
  } catch {
    /* not JSON */
  }
  if (res.status === 429) return new GeminiError("Gemini free limit reached for now.", { status: 429, quota: true });
  if (res.status === 400 && /API key/i.test(msg)) return new GeminiError("Gemini API key is not valid. Check it in Settings.", { status: 400 });
  if (res.status === 403) return new GeminiError("Gemini refused this key (API not enabled or region not supported).", { status: 403 });
  if (res.status >= 500) return new GeminiError("Gemini is busy right now.", { status: res.status });
  return new GeminiError(`Gemini error ${res.status}: ${msg.slice(0, 160)}`, { status: res.status });
}

/** Pull the JSON text out of a generateContent response. Pure; unit-tested. */
export function readResponse(json) {
  if (json?.promptFeedback?.blockReason) throw new GeminiError(`Gemini blocked this content (${json.promptFeedback.blockReason}).`);
  const cand = json?.candidates?.[0];
  if (!cand) throw new GeminiError("Gemini returned no answer.");
  if (cand.finishReason === "MAX_TOKENS") throw new GeminiError("The page had too many words for one go. Upload fewer pages at a time.");
  if (cand.finishReason && !["STOP", "FINISH_REASON_UNSPECIFIED"].includes(cand.finishReason)) {
    throw new GeminiError(`Gemini stopped early (${cand.finishReason}).`);
  }
  const text = (cand.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = /\{[\s\S]*\}/.exec(text);
    if (!m) throw new GeminiError("Gemini's reply wasn't in the expected format. Try again.");
    parsed = JSON.parse(m[0]);
  }
  return Array.isArray(parsed.words) ? parsed.words : [];
}

async function run(settings, parts, onProgress) {
  if (!settings.geminiKey) throw new GeminiError("No Gemini key.");
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(settings) }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(RESULT_SCHEMA),
      maxOutputTokens: 32768,
    },
  };
  let lastErr;
  for (const model of await candidateModels(settings)) {
    onProgress?.(`Gemini (${model}) is preparing your word cards…`);
    let res;
    try {
      res = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(settings.geminiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new GeminiError("Couldn't reach Gemini. Check your internet connection.");
    }
    if (res.ok) return { words: readResponse(await res.json()), model };
    lastErr = await toError(res);
    // Quota, overload or retired model: try the next model; a bad key won't work on any model.
    if (!(lastErr.quota || lastErr.status >= 500 || lastErr.status === 404)) break;
  }
  throw lastErr;
}

export async function geminiExtract(settings, sources, known, onProgress) {
  const parts = sources.map((s) =>
    s.kind === "text"
      ? { text: `Source "${s.name}":\n${s.text}` }
      : { inlineData: { mimeType: s.kind === "pdf" ? "application/pdf" : s.mediaType, data: s.data } },
  );
  parts.push({ text: extractInstruction(known) });
  return run(settings, parts, onProgress);
}

export async function geminiEnrich(settings, words, onProgress) {
  return run(settings, [{ text: enrichInstruction(words) }], onProgress);
}
