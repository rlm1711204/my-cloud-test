// Chooses who writes the word cards: Gemini (free) → Claude (paid) → free dictionaries.
// Each AI provider is tried in turn; if all fail the caller falls back to the free dictionary path.
import { claudeEnrich, claudeExtract, explainClaudeError } from "./ai.js";
import { geminiEnrich, geminiExtract } from "./gemini.js";

export const hasAI = (s) => Boolean(s.geminiKey || s.apiKey);

function providers(s) {
  const list = [];
  if (s.geminiKey) list.push({ name: "Gemini", extract: geminiExtract, enrich: geminiEnrich, explain: (e) => e.message });
  if (s.apiKey) {
    list.push({
      name: "Claude",
      extract: async (...a) => ({ words: await claudeExtract(...a), model: s.model }),
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

async function tryInOrder(s, op, args, onProgress) {
  const reasons = [];
  for (const p of providers(s)) {
    try {
      const { words } = await p[op](s, ...args, onProgress);
      return { words, provider: p.name, skipped: reasons };
    } catch (e) {
      reasons.push({ name: p.name, reason: p.explain(e) });
      onProgress?.(`${p.name} unavailable (${p.explain(e)}) — trying the next option…`);
    }
  }
  throw new AllProvidersFailed(reasons);
}

/** Extract difficult words from uploaded material. Resolves {words, provider, skipped}. */
export const aiExtract = (s, sources, known, onProgress) => tryInOrder(s, "extract", [sources, known], onProgress);

/** Build word cards for a list of words. Resolves {words, provider, skipped}. */
export const aiEnrich = (s, words, onProgress) => tryInOrder(s, "enrich", [words], onProgress);

/** One-line note like "Gemini limit reached → used Claude" for a toast; "" when nothing was skipped. */
export const fallbackNote = (skipped, usedName) =>
  skipped.length ? `${skipped.map((r) => `${r.name}: ${r.reason}`).join("; ")} → used ${usedName}` : "";
