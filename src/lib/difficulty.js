// Offline "is this word difficult?" filter, based on SCOWL word-frequency levels
// (wordlist-english, © Kevin Atkinson). Levels 10–20 ≈ the ~10k most common English words.
import { baseForms, wordKey } from "./words.js";

export const EASY_MAX_LEVEL = 20;
const LEVELS = [10, 20, 35, 40, 50, 55, 60];

let levelsPromise = null;

/** Lazily load a Map(word -> SCOWL level). ~75k words, only fetched when first needed. */
export function loadLevels() {
  levelsPromise ??= Promise.all(
    [
      () => import("wordlist-english/english-words-10.json"),
      () => import("wordlist-english/english-words-20.json"),
      () => import("wordlist-english/english-words-35.json"),
      () => import("wordlist-english/english-words-40.json"),
      () => import("wordlist-english/english-words-50.json"),
      () => import("wordlist-english/english-words-55.json"),
      () => import("wordlist-english/english-words-60.json"),
    ].map((load) => load().then((m) => m.default)),
  ).then((lists) => {
    const map = new Map();
    lists.forEach((list, i) => {
      for (const w of list) if (!map.has(w)) map.set(w, LEVELS[i]);
    });
    return map;
  });
  return levelsPromise;
}

/** Frequency level of a word or of its most likely base form; undefined if not a known word. */
export function levelOf(word, levels) {
  let best;
  for (const f of baseForms(word)) {
    const l = levels.get(f);
    if (l !== undefined && (best === undefined || l < best)) best = l;
  }
  return best;
}

export const isEasy = (word, levels) => {
  const l = levelOf(word, levels);
  return l !== undefined && l <= EASY_MAX_LEVEL;
};

/** Map a SCOWL level to the app's 1–5 difficulty scale. */
export const difficultyFromLevel = (l) => (l === undefined ? 3 : l <= 20 ? 1 : l <= 35 ? 3 : l <= 50 ? 4 : 5);

/**
 * Pull difficult-word candidates out of raw text (OCR or PDF).
 * Drops common words and anything not in the dictionary (OCR garbage, names — the lists are lowercase-only).
 * @returns {{word: string, level: number, count: number, context: string}[]}
 */
export function candidatesFromText(text, levels, { minLength = 4 } = {}) {
  const clean = String(text).replace(/-\s*\n\s*/g, "").replace(/\s+/g, " "); // re-join hyphenated line breaks
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const found = new Map();
  for (const sentence of sentences) {
    for (const m of sentence.matchAll(/[A-Za-z][A-Za-z'’]*[A-Za-z]/g)) {
      const raw = m[0];
      const key = wordKey(raw);
      if (key.length < minLength) continue;
      const level = levelOf(key, levels);
      if (level === undefined || level <= EASY_MAX_LEVEL) continue;
      const entry = found.get(key) ?? { word: key, level, count: 0, context: "" };
      entry.count += 1;
      if (!entry.context) entry.context = sentence.trim().slice(0, 220);
      found.set(key, entry);
    }
  }
  return [...found.values()].sort((a, b) => b.level - a.level || a.word.localeCompare(b.word));
}
