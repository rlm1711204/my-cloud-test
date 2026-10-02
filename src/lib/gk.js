// GK question records: shape, duplicate detection, and reading questions out of typed or scanned text when
// no AI is available (Q/A pairs, numbered MCQs with options and "Ans:", one-line "question? answer",
// "term – answer", and plain facts). Pure functions; unit-tested.
import { todayISO } from "./words.js";
import { ALL_CATEGORIES, CA, OTHER, TAXONOMY, CA_TOPICS, classify, subsOf } from "./gk-taxonomy.js";

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const str = (v, max = 1000) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Put a question in a known place of the tree; unknown or missing places are worked out from its text. */
export function placeOf(input, now = new Date()) {
  let category = str(input.category, 60);
  let sub = str(input.sub, 80);
  let year = clampInt(input.year, 0, 2100, 0);
  const text = `${input.q || ""} ${input.a || ""} ${input.explain || ""}`;
  if (!ALL_CATEGORIES.includes(category)) {
    const c = classify(text, { now });
    return { category: c.category, sub: c.sub, year: c.year };
  }
  if (category === CA) {
    if (!(sub in CA_TOPICS)) sub = classify(`${text} recently`, { now }).sub;
    return { category, sub, year: year || classify(`${text} recently`, { now }).year };
  }
  if (category === OTHER) return { category, sub: sub || "General", year: 0 };
  if (!subsOf(category).includes(sub)) {
    // Best chapter inside the given subject.
    const c = classify(text, { now });
    sub = c.category === category ? c.sub : subsOf(category)[0];
  }
  return { category, sub, year: 0 };
}

/** A complete GK question with spaced-repetition fields (same scheme as words and rules). */
export function makeItem(input = {}, now = new Date()) {
  const stamp = now.toISOString();
  const a = str(input.a ?? input.answer, 300);
  const options = [...new Set((Array.isArray(input.options) ? input.options : []).map((o) => str(o, 200)).filter((o) => o && o !== a))].slice(0, 4);
  return {
    id: input.id || uid(),
    q: str(input.q ?? input.question, 600) || "Untitled question",
    a,
    options, // WRONG options only (the answer is kept separately)
    explain: str(input.explain, 800),
    trick: str(input.trick, 500),
    ...placeOf(input, now),
    month: clampInt(input.month, 0, 12, 0),
    tags: (Array.isArray(input.tags) ? input.tags : []).map((t) => str(t, 40)).filter(Boolean).slice(0, 6),
    difficulty: clampInt(input.difficulty, 1, 5, 3),
    source: str(input.source, 160),
    context: str(input.context, 600),
    aiAnswered: Boolean(input.aiAnswered), // the answer was filled in by AI: worth a quick check
    starred: Boolean(input.starred),
    addedAt: input.addedAt || stamp,
    updatedAt: input.updatedAt || stamp,
    box: clampInt(input.box, 0, 7, 0),
    due: input.due || todayISO(now),
    reviews: clampInt(input.reviews, 0, 1e6, 0),
    lapses: clampInt(input.lapses, 0, 1e6, 0),
    lastReviewed: input.lastReviewed || null,
    deleted: Boolean(input.deleted),
  };
}

/** A fact to remember rather than a question with an answer. */
export const isFact = (it) => !it.a;

const STOP = new Set(
  "a an the of in on at to for by is are was were be been which who whom what when where how why does do did has have had and or with from as its it this that these those following name called known".split(" "),
);
const tokens = (s) =>
  new Set(
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
export const answerKey = (a) => String(a || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function questionSimilarity(x, y) {
  const a = tokens(x);
  const b = tokens(y);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

/** The saved question that is the same as `item` (same answer and very similar wording), or null. */
export function findDuplicate(item, list) {
  const ak = answerKey(item.a);
  let best = null;
  for (const x of list) {
    if (x.deleted || x.id === item.id) continue;
    const sim = questionSimilarity(item.q, x.q);
    const sameAnswer = ak && answerKey(x.a) === ak;
    if ((sameAnswer && sim >= 0.5) || sim >= 0.9) {
      if (!best || sim > best.score) best = { item: x, score: sim };
    }
  }
  return best?.item ?? null;
}

/** Newer `updatedAt` wins per id; deletions are kept so they sync. */
export function mergeItems(a = [], b = []) {
  const byId = new Map();
  for (const it of [...a, ...b]) {
    const cur = byId.get(it.id);
    if (!cur || String(it.updatedAt) > String(cur.updatedAt)) byId.set(it.id, it);
  }
  return [...byId.values()].sort((x, y) => String(y.addedAt).localeCompare(String(x.addedAt)));
}

// ---------- reading questions out of text (no AI) ----------
const NEW_ITEM = /^(?:q(?:uestion)?\s*\.?\s*\d*\s*[:.)\-–]|\d{1,3}\s*[.)]|\(\d{1,3}\))\s*/i;
// "Ans: b", "Answer - Delhi", "Correct answer: (c)", and "A: Delhi" (but not "a) Delhi", which is an option).
const ANSWER = /^(?:(?:ans(?:wer)?|correct answer|right answer|sol(?:ution)?)\b\s*(?:is\b)?\s*[.:\-–)]?|a\s*[:\-–])\s*(.+)$/i;
const OPTION = /^\(?([a-dA-D])\s*[).]\s+(.+)$/;
const INLINE_OPTIONS = /\(([a-dA-D])\)\s*([^()]+?)(?=\s*\([a-dA-D]\)|$)/g;
// Lines that belong to the question above: "Explanation: …", "Trick: …".
const EXTRA = /^(explanation|expl?|note|reason|fact|trick|tip|mnemonic)\s*[:.\-–]\s*(.+)$/i;

function parseBlock(lines) {
  const options = {};
  let answer = "";
  let explain = "";
  let trick = "";
  const text = [];
  for (const raw of lines) {
    const line = raw.replace(NEW_ITEM, "").trim();
    if (!line) continue;
    const extra = text.length ? EXTRA.exec(line) : null;
    if (extra) {
      if (/trick|tip|mnemonic/i.test(extra[1])) trick = extra[2].trim();
      else explain = [explain, extra[2].trim()].filter(Boolean).join(" ");
      continue;
    }
    const ans = ANSWER.exec(line);
    const opt = OPTION.exec(line);
    if (ans && (text.length || Object.keys(options).length)) {
      answer = ans[1].trim();
      continue;
    }
    // Several options on one line: "(a) Sydney (b) Canberra (c) …" — checked before single options.
    const inline = [...line.matchAll(INLINE_OPTIONS)];
    if (inline.length >= 2) {
      const before = line.slice(0, line.search(/\([a-dA-D]\)/)).trim();
      if (before) text.push(before);
      for (const m of inline) options[m[1].toLowerCase()] = m[2].trim();
      continue;
    }
    if (opt && text.length) {
      options[opt[1].toLowerCase()] = opt[2].trim();
      continue;
    }
    text.push(line);
  }
  let q = text.join(" ").trim();
  if (!q) return null;
  const letters = Object.keys(options);
  // "Ans: (b)" / "Answer: B" / "b) Delhi" → the option text.
  const letter = /^\(?([a-dA-D])\)?(?:[.)\s]|$)/.exec(answer);
  if (letter && options[letter[1].toLowerCase()]) answer = options[letter[1].toLowerCase()];
  if (!answer && !letters.length) {
    // One line: "Question? Answer"  or  "Term – answer" / "Term: answer"
    const qm = /^(.*\?)\s*(.+)$/.exec(q);
    const dash = /^(.{3,200}?)\s+(?:[-–—=→:]|->)\s+(.{1,120})$/.exec(q);
    if (qm && qm[2].length <= 120) [q, answer] = [qm[1].trim(), qm[2].replace(/^[-–—:=]\s*/, "").trim()];
    else if (dash && !/\?$/.test(q)) [q, answer] = [dash[1].trim(), dash[2].trim()];
  }
  const wrong = letters.map((l) => options[l]).filter((o) => o && o !== answer);
  return { q, a: answer, options: wrong, ...(explain && { explain }), ...(trick && { trick }) };
}

/**
 * Split typed notes or scanned text into questions. Items start at a numbered line, a "Q:" line, or after
 * a blank line; one-line items are split per line when every line looks like a question or "term – answer".
 */
export function textToItems(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.trim());
  const blocks = [];
  let cur = [];
  const flush = () => {
    if (cur.some(Boolean)) blocks.push(cur);
    cur = [];
  };
  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    if (NEW_ITEM.test(line) && !ANSWER.test(line) && cur.length) flush();
    // After a question's answer, anything but its explanation starts the next item.
    else if (cur.some((l) => ANSWER.test(l)) && !ANSWER.test(line) && !EXTRA.test(line) && !OPTION.test(line)) flush();
    cur.push(line);
  }
  flush();
  // A block of one-liners ("Capital of Japan - Tokyo" on each line) becomes one item per line.
  const out = [];
  for (const b of blocks) {
    const oneLiners = b.length > 1 && b.every((l) => /\?\s*\S|\s[-–—=→]\s|^\S[^?]{2,80}:\s+\S/.test(l) && !OPTION.test(l) && !ANSWER.test(l));
    for (const part of oneLiners ? b.map((l) => [l]) : [b]) {
      const item = parseBlock(part);
      if (item && item.q.length >= 4) out.push(item);
    }
  }
  return out;
}

/** CSV for the Google Sheet mirror and Excel. */
export function itemsToCSV(items) {
  const cell = (v) => {
    const s = Array.isArray(v) ? v.join(" | ") : v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Subject", "Chapter / topic", "Year", "Question", "Answer", "Wrong options", "Explanation", "Memory trick", "Added"];
  return [
    head.join(","),
    ...items
      .filter((i) => !i.deleted)
      .map((i) => [i.category, i.sub, i.year || "", i.q, i.a, i.options, i.explain, i.trick, String(i.addedAt).slice(0, 10)].map(cell).join(",")),
  ].join("\n");
}

export { TAXONOMY };
