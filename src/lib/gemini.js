// Google Gemini (free tier) as a word-card provider, via the Generative Language REST API.
// Same prompts and card schema as the Claude provider, so cards look identical.
import { LIST_SCHEMA, RESULT_SCHEMA, enrichInstruction, listInstruction, systemPrompt } from "./ai.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_AUTO = "auto";
// Used when the model list can't be fetched, and as extra fallbacks. Tried in order; free-tier Flash models.
// The "-latest" aliases always point at Google's newest Flash, so they keep working when versions are retired
// (2.5 was closed to new accounts in 2026). Named versions follow in case an alias is ever unavailable.
const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];
// At most this many models per request (retired ones don't count against the second limit), so a key
// that is out of quota hands over to the next key or service quickly.
const MAX_MODEL_TRIES = 6;
const MAX_QUOTA_TRIES = 3;

export class GeminiError extends Error {
  /** badKey: the key itself was refused. modelGone: this model is retired or not open to the key. */
  constructor(message, { status = 0, quota = false, badKey = false, modelGone = false } = {}) {
    super(message);
    this.status = status;
    this.quota = quota;
    this.badKey = badKey;
    this.modelGone = modelGone;
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
 * Rank Gemini models for this job: newest Flash first (stable before preview within a version), then
 * Flash-Lite (larger free quota). Newest first because Google closes older models to new accounts.
 * Special-purpose variants (image, audio, TTS, live, experimental) are skipped. Pure; unit-tested.
 */
export function rankModels(models) {
  // "-latest" aliases count as the newest version of all.
  const version = (id) => (id.endsWith("-latest") ? Infinity : Number((/gemini-(\d+(?:\.\d+)?)/.exec(id) || [])[1] || 0));
  return models
    .filter((m) => (m.supportedGenerationMethods || ["generateContent"]).includes("generateContent"))
    .map((m) => String(m.name || "").replace(/^models\//, ""))
    .filter((id) => /^gemini-([\d.]+-)?flash(-lite)?(-\d{3})?(-preview(-[\d-]+)?)?(-latest)?$/.test(id) && !/^gemini-flash(-lite)?$/.test(id))
    .sort(
      (a, b) =>
        Number(a.includes("-lite")) - Number(b.includes("-lite")) ||
        version(b) - version(a) ||
        Number(a.includes("preview")) - Number(b.includes("preview")) ||
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
    if (err.badKey) badKeys.add(key);
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
const goneModels = new Map(); // key -> models that answered 404 (retired / closed to this account)
const lastGood = new Map(); // key -> the model that last answered, tried first next time
let lastRanked = []; // most recent model list, for the Model menu in Settings

const usable = (key, models) => [...new Set(models)].filter((m) => !goneModels.get(key)?.has(m));

/** Models this key can use, best first: Google's own list when it loads, then the built-in fallbacks. */
async function candidateModels(settings, key) {
  if (settings.geminiModel && settings.geminiModel !== GEMINI_AUTO) {
    return usable(key, [settings.geminiModel, ...(modelCache.get(key) || []), ...FALLBACK_MODELS]);
  }
  if (!modelCache.has(key)) {
    try {
      const res = await fetch(`${BASE}/models?pageSize=200`, { headers: authHeaders(key) });
      if (res.ok) {
        const ranked = rankModels((await res.json()).models || []);
        if (ranked.length) {
          modelCache.set(key, ranked);
          lastRanked = ranked;
        }
      } else {
        const err = await toError(res);
        if (err.badKey) throw err;
      }
    } catch (e) {
      if (e instanceof GeminiError) throw e;
      /* network hiccup: use the built-in list */
    }
  }
  return usable(key, [lastGood.get(key), ...(modelCache.get(key) || []), ...FALLBACK_MODELS].filter(Boolean));
}

/** Models for the Settings menu: ones that worked first, then Google's list and the built-in one, minus retired ones. */
export function knownModels() {
  const gone = new Set([...goneModels.values()].flatMap((set) => [...set]));
  return [...new Set([...lastGood.values(), ...lastRanked, ...FALLBACK_MODELS])].filter((m) => !gone.has(m));
}

/** Google's 404 often names the replacement ("…use models/gemini-3.5-flash-lite…"). Pure; unit-tested. */
export function suggestedModels(message, current = "") {
  return [...String(message || "").matchAll(/models\/(gemini-[\w.-]*[\w])/g)].map((m) => m[1]).filter((m) => m !== current);
}

async function toError(res) {
  let msg = "";
  try {
    msg = (await res.json()).error?.message || "";
  } catch {
    /* not JSON */
  }
  if (res.status === 429) return new GeminiError("Gemini free limit reached for now.", { status: 429, quota: true });
  if (res.status === 400 && /API key/i.test(msg)) {
    return new GeminiError("Gemini API key is not valid. Check it in Settings.", { status: 400, badKey: true });
  }
  if (res.status === 401) {
    return new GeminiError(
      /ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(msg)
        ? "Google rejected this key type for your account (a known Google issue with some new AQ. keys). Try a key from another Google account."
        : "Gemini key not accepted (401). Check the key or create a new one.",
      { status: 401, badKey: true },
    );
  }
  if (res.status === 403) {
    return new GeminiError("Gemini refused this key (API not enabled or region not supported).", { status: 403, badKey: true });
  }
  if (res.status === 400 && /model/i.test(msg) && /not found|not supported|deprecat|unavailable|no longer|retired/i.test(msg)) {
    // A model problem, not a key problem: skip this model, keep the key.
    const err = new GeminiError("This Gemini model can't be used for this.", { status: 400, modelGone: true });
    err.detail = msg;
    return err;
  }
  if (res.status >= 500) return new GeminiError("Gemini is busy right now.", { status: res.status });
  if (res.status === 404) {
    const err = new GeminiError("This Gemini model isn't available to your account any more.", { status: 404, modelGone: true });
    err.detail = msg;
    return err;
  }
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
  let quotaHits = 0;
  const queue = await candidateModels(settings, key);
  const tried = new Set();
  for (let i = 0; i < queue.length && tried.size < MAX_MODEL_TRIES; i++) {
    const model = queue[i];
    if (tried.has(model)) continue;
    tried.add(model);
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
    if (res.ok) {
      const words = readResponse(await res.json());
      if (!settings.geminiModel || settings.geminiModel === GEMINI_AUTO) lastGood.set(key, model);
      return { words, model };
    }
    lastErr = await toError(res);
    if (lastErr.modelGone) {
      // Retired or closed to new accounts: never try it again with this key, and try Google's suggestion next.
      if (!goneModels.has(key)) goneModels.set(key, new Set());
      goneModels.get(key).add(model);
      for (const m of suggestedModels(lastErr.detail, model).reverse()) if (!tried.has(m)) queue.splice(i + 1, 0, m);
      continue;
    }
    // Quota or overload: try the next model (each has its own free allowance); a bad key won't work on any model.
    if (lastErr.quota && ++quotaHits >= MAX_QUOTA_TRIES) break;
    if (!(lastErr.quota || lastErr.status >= 500)) break;
  }
  if (lastErr?.modelGone) {
    throw new GeminiError("None of the Gemini models tried are open to this key. Set Settings → Gemini → Model to Auto, or try another key.", {
      status: 404,
      modelGone: true,
    });
  }
  throw lastErr ?? new GeminiError("No Gemini model available.");
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
      } else if (e.badKey) {
        badKeys.add(key);
      } else if (!e.modelGone && (!e.status || e.status < 500)) {
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
    else if (e.badKey) badKeys.add(key);
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
