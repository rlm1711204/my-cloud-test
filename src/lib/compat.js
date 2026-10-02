// Other free AI services that speak the OpenAI "chat completions" format: OpenRouter, Groq, Mistral,
// Cerebras, or any compatible address. Same prompts and card format as Gemini and Claude.
// Models are read from each service's own list, so new models are picked up without an app update.
import { LIST_SCHEMA, RESULT_SCHEMA, enrichInstruction, listInstruction, systemPrompt } from "./ai.js";
import { pdfForChat } from "./extract.js";

/** Services offered in Settings. `base` is the API address; `keys` is where to get a free key. */
export const SERVICES = {
  openrouter: {
    label: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    keys: "https://openrouter.ai/keys",
    note: "Many free models in one place (the ones ending in :free). Can read photos.",
  },
  groq: {
    label: "Groq",
    base: "https://api.groq.com/openai/v1",
    keys: "https://console.groq.com/keys",
    note: "Very fast, generous free tier. Some models can read photos.",
  },
  mistral: {
    label: "Mistral",
    base: "https://api.mistral.ai/v1",
    keys: "https://console.mistral.ai/api-keys",
    note: "Free 'Experiment' plan. Pixtral models can read photos.",
  },
  cerebras: {
    label: "Cerebras",
    base: "https://api.cerebras.ai/v1",
    keys: "https://cloud.cerebras.ai",
    note: "Fast free tier. Text only, so photos and scanned pages go to another service.",
  },
  custom: {
    label: "Other (OpenAI-compatible)",
    base: "",
    keys: "",
    note: "Any service with an OpenAI-compatible API: paste its address (ending in /v1) and key.",
  },
};

const MAX_MODEL_TRIES = 4;
// Wording services use when a model is retired or can't be used ("model … has been decommissioned").
const MODEL_GONE = /not found|does not exist|decommission|deprecat|not supported|no longer|unavailable|retired/i;

export class CompatError extends Error {
  constructor(message, { status = 0, quota = false, badKey = false, modelGone = false, cantRead = false } = {}) {
    super(message);
    this.status = status;
    this.quota = quota;
    this.badKey = badKey;
    this.modelGone = modelGone;
    this.cantRead = cantRead;
  }
}

/** The service entries saved in Settings that have a key. */
export const extraServicesOf = (s) => (Array.isArray(s.extraAIs) ? s.extraAIs : []).filter((e) => e && e.key && e.provider);

export const serviceBase = (e) => String(e.provider === "custom" ? e.base || "" : SERVICES[e.provider]?.base || "").replace(/\/+$/, "");

/** "Groq", or "Groq 2" when the same service is added twice. */
export function serviceName(s, entry) {
  const label = SERVICES[entry.provider]?.label?.replace(/ \(.*\)$/, "") || "AI service";
  const same = extraServicesOf(s).filter((e) => e.provider === entry.provider);
  return same.length > 1 ? `${label} ${same.indexOf(entry) + 1}` : label;
}

const headers = (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

// Models that never write text: speech, embeddings, safety filters, image generators.
const NOT_CHAT = /embed|whisper|tts|speech|audio|transcri|guard|moderation|rerank|dall-e|imagen|image-gen|flux|stable-diffusion|ocr|realtime|search/i;
const LOOKS_VISION = /vision|-vl|vl-|llama-4|scout|maverick|pixtral|gemma-3|gpt-4o|gpt-4\.1|gemini|claude|qwen2\.5-vl|qwen3-vl|mistral-small-3|mistral-medium/i;
// Families that write good structured answers; ranked above unknown models of similar size.
const STRONG = /deepseek|gemini|gpt-oss|qwen3|qwen-3|llama-4|llama-3\.3|kimi|glm|mistral-large|mistral-medium|command-a|maverick/i;

/** Rough model size in billions of parameters from its name ("llama-3.3-70b" → 70, "8x22b" → 176). */
export function sizeOf(id) {
  const moe = /(\d+)x(\d+(?:\.\d+)?)b/i.exec(id);
  if (moe) return Number(moe[1]) * Number(moe[2]);
  const m = /(\d+(?:\.\d+)?)b(?![a-z])/i.exec(id);
  return m ? Number(m[1]) : 0;
}

/**
 * Rank a service's model list for this job. Pure; unit-tested.
 * @param {object[]} list   entries from GET /models ({id, pricing?, architecture?, capabilities?, context_length?})
 * @param {{provider: string, needVision?: boolean}} opts
 * @returns {string[]} model ids, best first
 */
export function rankCompatModels(list, { provider, needVision = false } = {}) {
  const free = (m) =>
    provider !== "openrouter" ||
    /:free$/.test(m.id) ||
    (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0);
  const vision = (m) =>
    m.architecture?.input_modalities?.includes("image") ?? m.capabilities?.vision ?? LOOKS_VISION.test(m.id);
  const score = (m) =>
    Math.min(sizeOf(m.id), 400) +
    (STRONG.test(m.id) ? 150 : 0) +
    (/instruct|chat|versatile/i.test(m.id) ? 10 : 0) +
    Math.min(Number(m.context_length || 0) / 20000, 20) -
    (/preview|beta|exp/i.test(m.id) ? 5 : 0);
  return list
    .filter((m) => m && typeof m.id === "string" && !NOT_CHAT.test(m.id) && free(m))
    .filter((m) => !needVision || vision(m))
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
    .map((m) => m.id);
}

const modelLists = new Map(); // base+key -> raw model list
const goneModels = new Map(); // base+key -> models that answered "not found"
const lastGood = new Map(); // base+key+vision -> model that last worked

async function fetchModels(entry) {
  const id = serviceBase(entry) + entry.key;
  if (modelLists.has(id)) return modelLists.get(id);
  let res;
  try {
    res = await fetch(`${serviceBase(entry)}/models`, { headers: headers(entry.key) });
  } catch {
    throw unreachable(entry);
  }
  if (!res.ok) throw await toError(res, entry);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.data || json.models || [];
  modelLists.set(id, list);
  return list;
}

async function candidateModels(entry, needVision) {
  const id = serviceBase(entry) + entry.key;
  const gone = goneModels.get(id) || new Set();
  if (entry.model && entry.model !== "auto") return [entry.model];
  const ranked = rankCompatModels(await fetchModels(entry), { provider: entry.provider, needVision });
  const first = lastGood.get(`${id}|${needVision}`);
  return [...new Set([first, ...ranked].filter(Boolean))].filter((m) => !gone.has(m));
}

const unreachable = (entry) =>
  new CompatError(
    `Couldn't reach ${SERVICES[entry.provider]?.label || "the service"}. Check your internet — or this service may not allow apps that run in a browser.`,
  );

async function toError(res, entry) {
  let msg = "";
  try {
    const j = await res.json();
    msg = j.error?.message || j.message || j.detail || (typeof j.error === "string" ? j.error : "") || "";
  } catch {
    /* not JSON */
  }
  const name = SERVICES[entry.provider]?.label || "Service";
  if (res.status === 429) return new CompatError(`${name} free limit reached for now.`, { status: 429, quota: true });
  if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key|unauthori[sz]ed|invalid key/i.test(msg))) {
    return new CompatError(`${name} didn't accept the key. Check it in Settings.`, { status: res.status, badKey: true });
  }
  if (res.status === 402) return new CompatError(`${name}: this model needs credits.`, { status: 402, modelGone: true });
  if (res.status === 404 || (res.status === 400 && MODEL_GONE.test(msg) && /model/i.test(msg))) {
    return new CompatError(`${name}: model not available.`, { status: res.status, modelGone: true });
  }
  if (res.status === 400 && /image|vision|multimodal|content type/i.test(msg)) {
    return new CompatError(`${name}: this model can't read images.`, { status: 400, modelGone: true });
  }
  if (res.status >= 500) return new CompatError(`${name} is busy right now.`, { status: res.status });
  return new CompatError(`${name} error ${res.status}: ${msg.slice(0, 160)}`, { status: res.status });
}

/** Pull {words: [...]} out of a chat reply, tolerating ```json fences and text around it. Pure; unit-tested. */
export function parseWords(text) {
  const t = String(text || "").replace(/```(?:json)?/gi, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(t);
  } catch {
    const m = /\{[\s\S]*\}/.exec(t);
    if (!m) throw new CompatError("The reply wasn't in the expected format.");
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      throw new CompatError("The reply was cut off or not valid JSON.");
    }
  }
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed?.words) ? parsed.words : [];
}

const jsonRule = (schema) =>
  "Reply with ONLY a JSON object, no other text, matching this JSON Schema:\n" + JSON.stringify(schema);

async function chat(entry, model, messages, jsonMode) {
  const body = { model, messages, temperature: 0.2, max_tokens: 16000 };
  if (jsonMode) body.response_format = { type: "json_object" };
  let res;
  try {
    res = await fetch(`${serviceBase(entry)}/chat/completions`, { method: "POST", headers: headers(entry.key), body: JSON.stringify(body) });
  } catch {
    throw unreachable(entry);
  }
  return res;
}

/** Try the ranked models in turn: a retired or unsuitable model is skipped and remembered. */
async function run(s, entry, userContent, schema, { needVision = false, onProgress } = {}) {
  const name = serviceName(s, entry);
  const id = serviceBase(entry) + entry.key;
  const models = await candidateModels(entry, needVision);
  if (!models.length) {
    throw new CompatError(
      needVision ? `${name} has no free model that can read images.` : `${name} has no free model available right now.`,
      { modelGone: true, cantRead: needVision },
    );
  }
  const messages = [
    { role: "system", content: `${systemPrompt(s)}\n\n${jsonRule(schema)}` },
    { role: "user", content: userContent },
  ];
  let lastErr;
  for (const model of models.slice(0, MAX_MODEL_TRIES)) {
    onProgress?.(`${name} (${model}) is working…`);
    let res = await chat(entry, model, messages, true);
    if (res.status === 400) {
      // Some models reject the JSON switch; the prompt alone still asks for JSON.
      let msg = "";
      try {
        const j = await res.clone().json();
        msg = j.error?.message || j.message || "";
      } catch {
        /* not JSON */
      }
      if (/response_format|json/i.test(msg)) res = await chat(entry, model, messages, false);
    }
    if (res.ok) {
      const json = await res.json();
      const choice = json.choices?.[0];
      if (choice?.finish_reason === "length") {
        lastErr = new CompatError("The page had too many words for one go. Upload fewer pages at a time.");
        continue;
      }
      const words = parseWords(choice?.message?.content);
      lastGood.set(`${id}|${needVision}`, model);
      return { words, model };
    }
    lastErr = await toError(res, entry);
    if (lastErr.modelGone) {
      if (!goneModels.has(id)) goneModels.set(id, new Set());
      goneModels.get(id).add(model);
      continue;
    }
    if (lastErr.quota || lastErr.status >= 500) continue;
    break; // bad key or a problem with the request: another model won't help
  }
  throw lastErr;
}

/** Step 1: list the words in photos/PDFs/text. Scanned PDF pages are sent as pictures. */
export async function compatList(s, entry, sources, onProgress) {
  const content = [];
  let needVision = false;
  for (const src of sources) {
    if (src.kind === "image") {
      needVision = true;
      content.push({ type: "image_url", image_url: { url: `data:${src.mediaType};base64,${src.data}` } });
    } else if (src.kind === "pdf") {
      const pdf = await pdfForChat(src.data, onProgress);
      if (pdf.text) content.push({ type: "text", text: `Source "${src.name}":\n${pdf.text}` });
      for (const img of pdf.images) {
        needVision = true;
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } });
      }
    } else {
      content.push({ type: "text", text: `Source "${src.name}":\n${src.text}` });
    }
  }
  content.push({ type: "text", text: listInstruction() });
  // Text-only models get a plain string (some reject the array form).
  const userContent = needVision ? content : content.map((c) => c.text).join("\n\n");
  return run(s, entry, userContent, LIST_SCHEMA, { needVision, onProgress });
}

export async function compatEnrich(s, entry, words, notes, onProgress) {
  return run(s, entry, enrichInstruction(words, notes), RESULT_SCHEMA, { onProgress });
}

/** Check a key when it's added: lists the models it can use. Resolves {ok, message}. */
export async function testService(entry) {
  try {
    const list = await fetchModels(entry);
    const n = rankCompatModels(list, { provider: entry.provider }).length;
    const v = rankCompatModels(list, { provider: entry.provider, needVision: true }).length;
    if (!n) return { ok: false, message: "Key works, but no free models were found on it." };
    return { ok: true, message: `Works ✓ ${n} free model${n === 1 ? "" : "s"}${v ? `, ${v} can read photos` : ", text only"}.` };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
