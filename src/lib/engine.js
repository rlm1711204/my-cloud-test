// Chooses who writes the word cards: Gemini (free) → other free AI services → Claude (paid) → free dictionaries.
// Each AI provider is tried in turn; if all fail the caller falls back to the free dictionary path.
import { claudeEnrich, claudeList, explainClaudeError } from "./ai.js";
import { geminiEnrich, geminiKeysOf, geminiList, pickedKeyNumber } from "./gemini.js";
import { compatEnrich, compatList, extraServicesOf, serviceName } from "./compat.js";
import { wordKey } from "./words.js";

export const hasAI = (s) => Boolean(geminiKeysOf(s).length || extraServicesOf(s).length || s.apiKey);

/**
 * The AI chosen by hand on the Add screen: {kind: "gemini"} (one Gemini key) or {kind: "extra", entry}.
 * null means Auto — every AI in order.
 */
export function pickedAI(s) {
  const pick = String(s.aiPick || "");
  if (pick.startsWith("extra:")) {
    const entry = extraServicesOf(s).find((e) => e.id === pick.slice(6));
    if (entry) return { kind: "extra", entry };
  }
  if (pickedKeyNumber(s)) return { kind: "gemini" };
  return null;
}

/** Cards per request: small enough that a reply never gets cut off, even with long explanations. */
export const BATCH = 25;
const COOLDOWN_MS = 10 * 60 * 1000;
const cooldown = new Map(); // provider name -> time it may be tried again (after hitting a limit)

const extraProvider = (s, entry) => ({
  name: serviceName(s, entry),
  list: (st, sources, onProgress) => compatList(st, entry, sources, onProgress),
  enrich: (st, words, notes, onProgress) => compatEnrich(st, entry, words, notes, onProgress),
  explain: (e) => e.message,
});

function providers(s) {
  const list = [];
  const picked = pickedAI(s);
  // An AI chosen by hand is the only one used (the free dictionary still steps in if it fails).
  if (picked?.kind === "extra") return [extraProvider(s, picked.entry)];
  if (geminiKeysOf(s).length) {
    // A hand-picked key gets its own name, so a limit hit in Auto mode doesn't block trying that key.
    const n = pickedKeyNumber(s);
    list.push({ name: n ? `Gemini key ${n}` : "Gemini", list: geminiList, enrich: geminiEnrich, explain: (e) => e.message });
    if (n) return list;
  }
  for (const entry of extraServicesOf(s)) list.push(extraProvider(s, entry));
  if (s.apiKey) {
    list.push({
      name: "Claude",
      list: async (...a) => ({ words: await claudeList(...a), model: s.model }),
      enrich: async (...a) => ({ words: await claudeEnrich(...a), model: s.model }),
      explain: explainClaudeError,
    });
  }
  return list;
}

export class AllProvidersFailed extends Error {
  constructor(reasons) {
    super(reasons.map((r) => `${r.name}: ${r.reason}`).join(" · ") || "No AI key set.");
    this.reasons = reasons;
  }
}

const isLimit = (e) => e?.quota || e?.status === 429;

async function tryInOrder(s, op, args, onProgress) {
  const reasons = [];
  for (const p of providers(s)) {
    if ((cooldown.get(p.name) ?? 0) > Date.now()) {
      reasons.push({ name: p.name, reason: "limit reached recently" });
      continue;
    }
    try {
      const { words } = await p[op](s, ...args, onProgress);
      return { words, provider: p.name, skipped: reasons };
    } catch (e) {
      if (isLimit(e)) cooldown.set(p.name, Date.now() + COOLDOWN_MS);
      reasons.push({ name: p.name, reason: p.explain(e) });
      onProgress?.(`${p.name} unavailable (${p.explain(e)}) — trying the next option…`);
    }
  }
  throw new AllProvidersFailed(reasons);
}

/** Step 1 — list every word in the uploaded material. Resolves {words: [{word, context}], provider, skipped}. */
export const aiList = (s, sources, onProgress) => tryInOrder(s, "list", [sources], onProgress);

/** Build word cards for one small batch. Resolves {words, provider, skipped}. */
export const aiEnrich = (s, words, onProgress, notes = []) => tryInOrder(s, "enrich", [words, notes], onProgress);

/**
 * Step 2 — build cards for any number of words, BATCH at a time, so long lists (200+) never get cut off.
 * A batch that no AI can handle is returned without details (the free dictionary fills those in later).
 * @param {{word: string, context?: string}[]} items
 * @returns {Promise<{words: object[], notes: string[], failed: number}>}
 */
export async function aiEnrichAll(s, items, onProgress) {
  const words = [];
  const notes = new Set();
  let failed = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    onProgress?.(`Writing word cards ${i + 1}–${i + batch.length} of ${items.length}…`);
    try {
      const res = await aiEnrich(s, batch.map((b) => b.word), null, batch.map((b) => b.context || ""));
      const note = fallbackNote(res.skipped, res.provider);
      if (note) notes.add(note);
      const byKey = new Map(res.words.map((r) => [wordKey(r.word), r]));
      batch.forEach((b, j) => {
        const r = byKey.get(wordKey(b.word)) ?? (res.words.length === batch.length ? res.words[j] : null);
        if (r) words.push({ ...r, context: b.context || r.context || "" });
        else (words.push({ word: b.word, context: b.context || "" }), (failed += 1));
      });
    } catch (e) {
      if (!(e instanceof AllProvidersFailed)) throw e;
      notes.add(`${e.message} → free dictionary`);
      for (const b of batch) words.push({ word: b.word, context: b.context || "" });
      failed += batch.length;
    }
  }
  return { words, notes: [...notes], failed };
}

/** One-line note like "Gemini: limit reached → used Claude" for a toast; "" when nothing was skipped. */
export const fallbackNote = (skipped, usedName) =>
  skipped.length ? `${skipped.map((r) => `${r.name}: ${r.reason}`).join("; ")} → used ${usedName}` : "";
