// Built-in Word Bank: 1000+ exam words bundled with the app (for learning/practice only).
// Kept separate from the user's master list; its revision progress is stored in state.bank.
import { makeWord, wordKey } from "./words.js";

export const BANK_PREFIX = "b:";
export const isBankId = (id) => String(id).startsWith(BANK_PREFIX);

/** Parse the compact data format: word|pos|meaning|hindi|syn1;syn2|ant1;ant2|example sentence */
export function parseBank(...chunks) {
  const seen = new Set();
  const out = [];
  for (const chunk of chunks) {
    for (const line of String(chunk).split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const [word, pos, meaning, hindi, syn = "", ant = "", example = ""] = t.split("|").map((x) => x.trim());
      const key = wordKey(word);
      if (!key || !meaning || seen.has(key)) continue;
      seen.add(key);
      out.push({
        word,
        pos,
        meaning,
        hindi,
        synonyms: syn.split(";").map((s) => s.trim()).filter((s) => s && s !== "—"),
        antonyms: ant.split(";").map((s) => s.trim()).filter((s) => s && s !== "—"),
        sentences: example ? [example] : [],
      });
    }
  }
  return out;
}

/** Stable pseudo-random rank so bank words are learnt in a mixed (not alphabetical) order. */
function rank(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36).padStart(7, "0");
}

const SRS_FIELDS = ["box", "due", "reviews", "lapses", "lastReviewed", "starred", "updatedAt"];
export const progressOf = (w) => Object.fromEntries(SRS_FIELDS.map((k) => [k, w[k]]));

/** A bank entry plus the learner's saved progress, shaped like a normal word record. */
export function bankRecord(entry, progress = {}) {
  const key = wordKey(entry.word);
  return {
    ...makeWord({
      ...entry,
      id: BANK_PREFIX + key,
      source: "Word Bank",
      // Sorts after the learner's own words (new words are introduced oldest-added first).
      addedAt: `9${rank(key)}`,
      updatedAt: progress.updatedAt || "1970-01-01T00:00:00.000Z",
      difficulty: 4,
      ...progress,
    }),
    bank: true,
  };
}

let bankPromise = null;
let bankEntries = null;

/** Load the bundled word bank (lazy chunks). */
export function loadBank() {
  bankPromise ??= Promise.all([
    import("../data/bank1.js"),
    import("../data/bank2.js"),
    import("../data/bank3.js"),
    import("../data/bank4.js"),
    import("../data/bank5.js"),
    import("../data/bank6.js"),
  ]).then((mods) => (bankEntries = parseBank(...mods.map((m) => m.default))));
  return bankPromise;
}

/** Bank entries if already loaded (synchronous access for rendering). */
export const bankLoaded = () => bankEntries;
