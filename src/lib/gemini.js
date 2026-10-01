// Google Gemini (free tier) as a word-card provider, via the Generative Language REST API.
// Same prompts and card schema as the Claude provider, so cards look identical.
import { LIST_SCHEMA, RESULT_SCHEMA, enrichInstruction, listInstruction, systemPrompt } from "./ai.js";

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

/** All Gemini keys in Settings, in order (older versions stored a single `geminiKey`). */
export const geminiKeysOf = (s) => [...new Set([...(s.geminiKeys || []), s.geminiKey].map((k) => String(k || "").trim()).filter(Boolean))];

/** The key chosen by hand on the Add screen, or null for Auto (or if that key was removed). */
export const pickedGeminiKey = (s) => {
  const pick = String(s.geminiKeyPick || "").trim();
  return pick && geminiKeysOf(s).includes(pick) ? pick : null;
};

/** 1-based position of the hand-picked key ("Key 2"), or 0 for Auto. */
export const pickedKeyNumber = (s) => {
  const pick = pickedGeminiKey(s);
  return pick ? geminiKeysOf(s).indexOf(pick) + 1 : 0;
};

/**
 * Keys go in the x-goog-api-key header. Google's newer "AQ." auth keys (issued since May 2026) only work
 * there, not as a ?key= URL parameter; older "AIza" keys work either way.
 */
const authHeaders = (key) => ({ "x-goog-api-key": key });

/** Loose shape check: "AIza…" (classic) or "AQ.…" (auth key); anything long without spaces is allowed. */
export const looksLikeGeminiKey = (k) => /^\S{20,}$/.test(String(k || "").trim());

/** Try a key right away (lists models). Resolves {ok, message}. */
export async function testKey(key) {
  try {
    const res = await fetch(`${BASE}/models?pageSize=5`, { headers: authHeaders(key) });
    if (res.ok) {
      badKeys.delete(key);
      return { ok: true, message: "Key works ✓" };
    }
    const err = await toError(res);
    if (err.status === 400 || err.status === 401 || err.status === 403) badKeys.add(key);
    return { ok: err.quota, message: err.message };
  } catch {
    return { ok: true, message: "Saved — couldn't test it now (no internet?)." };
  }
}

const KEY_REST_MS = 10 * 60 * 1000;
const keyRest = new Map(); // key -> time it may be used again (after hitting its free limit)
const badKeys = new Set(); // keys Google rejected as invalid, until the app is reopened

/** "ok" | "resting" (limit reached, with `until`) | "invalid" — shown next to each key in Settings. */
export function keyStatus(key) {
  if (badKeys.has(key)) return { state: "invalid" };
  const until = keyRest.get(key) ?? 0;
  return until > Date.now() ? { state: "resting", until } : { state: "ok" };
}

const modelCache = new Map(); // key -> ranked model list

async function candidateModels(settings, key) {
  if (settings.geminiModel && settings.geminiModel !== GEMINI_AUTO) {
    return [settings.geminiModel, ...FALLBACK_MODELS.filter((m) => m !== settings.geminiModel)];
  }
  if (modelCache.has(key)) return modelCache.get(key);
  try {
    const res = await fetch(`${BASE}/models?pageSize=200`, { headers: authHeaders(key) });
    if (res.ok) {
      const ranked = rankModels((await res.json()).models || []);
      // Best Flash plus best Flash-Lite is enough: Lite is the quota fallback.
      const best = [ranked.find((m) => !m.includes("-lite")), ranked.find((m) => m.includes("-lite"))].filter(Boolean);
      if (best.length) {
        modelCache.set(key, best);
        return best;
      }
    } else if (res.status === 400 || res.status === 401 || res.status === 403) {
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
  if (res.status === 401) {
    return new GeminiError(
      /ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(msg)
        ? "Google rejected this key type for your account (a known Google issue with some new AQ. keys). Try a key from another Google account."
        : "Gemini key not accepted (401). Check the key or create a new one.",
      { status: 401 },
    );
  }
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

async function runWithKey(settings, key, body, onProgress, label) {
  let lastErr;
  for (const model of await candidateModels(settings, key)) {
    onProgress?.(`Gemini${label} (${model}) is working…`);
    let res;
    try {
      res = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(key) },
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

/**
 * Try each saved key in turn. A key that hits its free limit rests for 10 minutes and the next key
 * takes over; an invalid key is skipped. Only when every key fails does Gemini report failure.
 * If a key was picked by hand, only that key is used (even if it was resting), and its errors say which key.
 */
async function run(settings, parts, onProgress, schema = RESULT_SCHEMA) {
  const all = geminiKeysOf(settings);
  if (!all.length) throw new GeminiError("No Gemini key.");
  const picked = pickedGeminiKey(settings);
  if (picked) return runPicked(settings, picked, all.indexOf(picked) + 1, parts, onProgress, schema);
  const keys = all;
  const body = requestBody(settings, parts, schema);
  let lastErr = null;
  let anyQuota = false;
  for (const [i, key] of keys.entries()) {
    if (badKeys.has(key)) continue;
    if ((keyRest.get(key) ?? 0) > Date.now()) {
      anyQuota = true;
      continue;
    }
    try {
      return await runWithKey(settings, key, body, onProgress, keys.length > 1 ? ` key ${i + 1}` : "");
    } catch (e) {
      if (!(e instanceof GeminiError)) throw e;
      lastErr = e;
      if (e.quota) {
        anyQuota = true;
        keyRest.set(key, Date.now() + KEY_REST_MS);
      } else if (e.status === 400 || e.status === 401 || e.status === 403) {
        badKeys.add(key);
      } else if (!e.status || e.status < 500) {
        throw e; // network or content problem: another key won't help
      }
      if (keys.length > 1) onProgress?.(`Gemini key ${i + 1}: ${e.message} Trying the next key…`);
    }
  }
  if (anyQuota) {
    throw new GeminiError(keys.length > 1 ? "All Gemini keys have reached their free limit for now." : "Gemini free limit reached for now.", {
      status: 429,
      quota: true,
    });
  }
  throw lastErr ?? new GeminiError("No working Gemini key. Check your keys in Settings.");
}

function requestBody(settings, parts, schema) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt(settings) }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(schema),
      maxOutputTokens: 32768,
    },
  };
}

/** Use only the key the learner chose. Failures name the key so they know to pick another. */
async function runPicked(settings, key, n, parts, onProgress, schema) {
  try {
    const res = await runWithKey(settings, key, requestBody(settings, parts, schema), onProgress, ` key ${n}`);
    keyRest.delete(key);
    badKeys.delete(key);
    return res;
  } catch (e) {
    if (!(e instanceof GeminiError)) throw e;
    if (e.quota) keyRest.set(key, Date.now() + KEY_REST_MS);
    else if (e.status === 400 || e.status === 401 || e.status === 403) badKeys.add(key);
    const hint = e.quota ? "reached its free limit" : e.message.replace(/\.$/, "");
    throw new GeminiError(`Key ${n} ${e.quota ? hint : `failed: ${hint}`}. Choose another key (or Auto) on the Add screen.`, {
      status: e.status,
      quota: e.quota,
    });
  }
}

/** Step 1: list the words in images/PDFs (or plain text). Resolves {words: [{word, context}], model}. */
export async function geminiList(settings, sources, onProgress) {
  const parts = sources.map((s) =>
    s.kind === "text"
      ? { text: `Source "${s.name}":\n${s.text}` }
      : { inlineData: { mimeType: s.kind === "pdf" ? "application/pdf" : s.mediaType, data: s.data } },
  );
  parts.push({ text: listInstruction() });
  return run(settings, parts, onProgress, LIST_SCHEMA);
}

export async function geminiEnrich(settings, words, notes, onProgress) {
  return run(settings, [{ text: enrichInstruction(words, notes) }], onProgress);
}
