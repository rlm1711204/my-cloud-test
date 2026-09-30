// Word records, duplicate detection and merge logic. Pure functions (no DOM), unit-tested.

export const todayISO = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

/** Canonical key for a word: lowercase, trimmed, curly quotes and possessives removed. */
export function wordKey(word) {
  return String(word || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .trim()
    .replace(/'s$/, "")
    .replace(/[^a-z' -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Likely dictionary base forms of an inflected word ("mitigated" -> "mitigate", "mitigat").
 * Used to spot near-duplicates such as "abates" when "abate" is already saved.
 */
export function baseForms(word) {
  const w = wordKey(word);
  const out = new Set([w]);
  const add = (s) => s.length >= 3 && out.add(s);
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  if (w.endsWith("es")) add(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss")) add(w.slice(0, -1));
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    if (w.at(-3) === w.at(-4)) add(w.slice(0, -3)); // "abetted" -> "abet"
  }
  if (w.endsWith("ing")) {
    add(w.slice(0, -3));
    add(w.slice(0, -3) + "e");
    if (w.at(-4) === w.at(-5)) add(w.slice(0, -4));
  }
  if (w.endsWith("ly")) add(w.slice(0, -2));
  if (w.endsWith("ily")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ness")) add(w.slice(0, -4));
  return [...out];
}

/**
 * Find a saved word that matches `word` exactly or as an inflection.
 * @returns {{match: object, exact: boolean} | null}
 */
export function findExisting(word, index) {
  const key = wordKey(word);
  if (index.has(key)) return { match: index.get(key), exact: true };
  for (const f of baseForms(key)) {
    if (index.has(f)) return { match: index.get(f), exact: false };
  }
  // The saved word may be the inflected one ("mitigated" saved, "mitigate" incoming).
  for (const [k, rec] of index) {
    if (Math.abs(k.length - key.length) <= 4 && baseForms(k).includes(key)) return { match: rec, exact: false };
  }
  return null;
}

/** Map of wordKey -> record for live (non-deleted) words. */
export function buildIndex(words) {
  const m = new Map();
  for (const w of words) if (!w.deleted) m.set(wordKey(w.word), w);
  return m;
}

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const clampInt = (n, lo, hi, dflt) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};

const strList = (v) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : []);

/** Normalise a partial word (from AI, OCR or the manual form) into a full record. */
export function makeWord(input, now = new Date()) {
  const stamp = now.toISOString();
  return {
    id: input.id || uid(),
    word: String(input.word || "").trim(),
    pos: String(input.pos || "").trim(),
    meaning: String(input.meaning || "").trim(),
    hindi: String(input.hindi || "").trim(),
    tamil: String(input.tamil || "").trim(),
    ipa: String(input.ipa || "").trim(),
    say: String(input.say || "").trim(),
    sentences: strList(input.sentences).slice(0, 3),
    synonyms: strList(input.synonyms).slice(0, 6),
    antonyms: strList(input.antonyms).slice(0, 6),
    examTip: String(input.examTip || "").trim(),
    context: String(input.context || "").trim(),
    difficulty: clampInt(input.difficulty, 1, 5, 3),
    source: String(input.source || "").trim(),
    tags: strList(input.tags),
    starred: Boolean(input.starred),
    addedAt: input.addedAt || stamp,
    updatedAt: input.updatedAt || stamp,
    // Spaced-repetition state (see srs.js)
    box: clampInt(input.box, 0, 7, 0),
    due: input.due || todayISO(now),
    reviews: clampInt(input.reviews, 0, 1e6, 0),
    lapses: clampInt(input.lapses, 0, 1e6, 0),
    lastReviewed: input.lastReviewed || null,
    deleted: Boolean(input.deleted),
  };
}

/** True when the record still lacks the fields that make it useful for revision. */
export const needsEnrichment = (w) => !w.meaning || !w.hindi || w.sentences.length < 2;

/**
 * Merge two copies of the master list (e.g. this device vs Google Drive).
 * The newer `updatedAt` wins per word; deletions are kept as tombstones so they propagate.
 */
export function mergeWordLists(a = [], b = []) {
  const byKey = new Map();
  for (const w of [...a, ...b]) {
    const k = wordKey(w.word);
    if (!k) continue;
    const cur = byKey.get(k);
    if (!cur || String(w.updatedAt) > String(cur.updatedAt)) byKey.set(k, w);
  }
  return [...byKey.values()].sort((x, y) => String(y.addedAt).localeCompare(String(x.addedAt)));
}

/** Split free text ("abate, cajole\nobdurate; mitigate") into distinct candidate words/phrases. */
export function parseTypedWords(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text).split(/[\n,;|•\t]+/)) {
    const cleaned = raw.replace(/^\s*(\d+[.)]|[-*])\s*/, "").trim();
    const key = wordKey(cleaned);
    if (key && key.length >= 2 && !seen.has(key)) {
      seen.add(key);
      out.push(cleaned.replace(/\s+/g, " "));
    }
  }
  return out;
}

const csvCell = (v) => {
  const s = Array.isArray(v) ? v.join(" | ") : v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_COLUMNS = [
  ["word", "Word"],
  ["pos", "Part of speech"],
  ["meaning", "Meaning"],
  ["hindi", "Hindi"],
  ["tamil", "Tamil"],
  ["ipa", "IPA"],
  ["say", "Say it"],
  ["sentences", "Example sentences"],
  ["synonyms", "Synonyms"],
  ["antonyms", "Antonyms"],
  ["examTip", "Exam tip"],
  ["difficulty", "Difficulty"],
  ["source", "Source"],
  ["box", "Memory level"],
  ["due", "Next review"],
  ["addedAt", "Added"],
];

export function toCSV(words) {
  const live = words.filter((w) => !w.deleted);
  const head = CSV_COLUMNS.map(([, h]) => h).join(",");
  const rows = live.map((w) => CSV_COLUMNS.map(([k]) => csvCell(k === "addedAt" ? String(w[k]).slice(0, 10) : w[k])).join(","));
  return [head, ...rows].join("\n");
}
