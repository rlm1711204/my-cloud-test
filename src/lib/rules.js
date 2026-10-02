// Grammar rule records: shape, duplicate detection, matching against the Rule Book, and turning typed or
// scanned text into rules when no AI is available. Pure functions; unit-tested.
import { todayISO } from "./words.js";

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const str = (v, max = 2000) => String(v ?? "").trim().slice(0, max);
const strList = (v, max = 6) =>
  (Array.isArray(v) ? v : String(v ?? "").split("\n"))
    .map((x) => str(x, 400))
    .filter(Boolean)
    .slice(0, max);
const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Topics used by the Rule Book; AI is asked to pick one of these so lists stay tidy. */
export const TOPICS = [
  "Subject–Verb Agreement",
  "Nouns",
  "Pronouns",
  "Articles",
  "Adjectives & Comparison",
  "Adverbs",
  "Prepositions",
  "Conjunctions",
  "Tenses",
  "Gerunds, Infinitives & Participles",
  "Modals",
  "Conditionals & Subjunctive",
  "Active & Passive Voice",
  "Direct & Indirect Speech",
  "Question Tags",
  "Parallelism, Redundancy & Word Order",
  "Common Confusions & Usage",
  "Punctuation",
  "Other",
];

/** Stable key for a rule title: lower case, no quotes or punctuation, single spaces. */
export const ruleKey = (title) =>
  String(title || "")
    .toLowerCase()
    .replace(/[‘’'"“”`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** A practice question: {q, options, answer, why}. Returns null if it isn't usable. */
export function cleanQuestion(q) {
  if (!q || typeof q !== "object") return null;
  const options = [...new Set((Array.isArray(q.options) ? q.options : []).map((o) => str(o, 300)).filter(Boolean))];
  const answer = Number(q.answer);
  const text = str(q.q ?? q.question, 400);
  if (!text || options.length < 2 || options.length > 6 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
  // Options were de-duplicated; make sure the answer still points at the same text.
  const original = Array.isArray(q.options) ? str(q.options[answer], 300) : "";
  const idx = original ? options.indexOf(original) : answer;
  if (idx < 0) return null;
  return { q: text, options, answer: idx, why: str(q.why, 400) };
}

const cleanMistake = (m) => {
  if (!m || typeof m !== "object") return null;
  const wrong = str(m.wrong, 400);
  const right = str(m.right, 400);
  return wrong && right && wrong !== right ? { wrong, right, why: str(m.why, 400) } : null;
};

/** A complete rule record with spaced-repetition fields (same scheme as vocabulary words). */
export function makeRule(input = {}, now = new Date()) {
  const stamp = now.toISOString();
  const title = str(input.title, 160) || str(input.rule, 80) || "Untitled rule";
  return {
    id: input.id || uid(),
    title,
    topic: str(input.topic, 80) || "Other",
    rule: str(input.rule, 2000),
    hindi: str(input.hindi, 600),
    examples: strList(input.examples, 4),
    mistakes: (Array.isArray(input.mistakes) ? input.mistakes : []).map(cleanMistake).filter(Boolean).slice(0, 4),
    note: str(input.note, 800),
    tip: str(input.tip, 600),
    questions: (Array.isArray(input.questions) ? input.questions : []).map(cleanQuestion).filter(Boolean).slice(0, 6),
    difficulty: clampInt(input.difficulty, 1, 5, 3),
    source: str(input.source, 160),
    context: str(input.context, 600),
    bookId: str(input.bookId, 120), // the Rule Book rule this one was matched with, if any
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

/** True when a rule has nothing to practise with except recalling it. */
export const needsDetails = (r) => !r.examples.length && !r.mistakes.length && !r.questions.length;

const STOP = new Set(
  "a an the and or but of to in on at for with by is are was were be been being it its this that these those as from not no use used when if then than which who whom whose what can may must should will would shall rule rules always never only also into after before".split(
    " ",
  ),
);
/** Meaningful words of a rule, for similarity checks. Quoted words ('since', 'for') are kept even if short. */
export function ruleTokens(r) {
  const text = `${r.title || ""} ${r.rule || ""}`.toLowerCase();
  const quoted = [...text.matchAll(/['‘“"]([a-z ]{2,20})['’”"]/g)].map((m) => m[1].trim());
  const words = text.replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  return new Set([...words, ...quoted.map((q) => `"${q}"`)]);
}

export function similarity(a, b) {
  const x = ruleTokens(a);
  const y = ruleTokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared += t.startsWith('"') ? 2 : 1; // shared quoted words count double
  return Math.min(1, shared / Math.min(x.size, y.size + 0.0001) / 1.2);
}

/**
 * The closest rule in `list` to `rule`: {rule, score, exact}. exact = same title.
 * A score of 0.6 or more is treated as "probably the same rule".
 */
export function findSimilarRule(rule, list) {
  const key = ruleKey(rule.title);
  let best = null;
  for (const r of list) {
    if (r.deleted || r.id === rule.id) continue;
    if (key && ruleKey(r.title) === key) return { rule: r, score: 1, exact: true };
    const score = similarity(rule, r);
    if (!best || score > best.score) best = { rule: r, score, exact: false };
  }
  return best && best.score > 0 ? best : null;
}

export const SAME_RULE = 0.6; // similarity at which two rules are treated as duplicates
export const BOOK_MATCH = 0.34; // similarity at which a typed rule borrows the Rule Book's examples

/**
 * Free mode: fill a rule's missing examples, mistakes, questions and topic from the closest Rule Book rule.
 * Returns the (possibly) enriched rule.
 */
export function borrowFromBook(rule, bookRules) {
  const match = findSimilarRule(rule, bookRules);
  if (!match || match.score < BOOK_MATCH) return rule;
  const b = match.rule;
  return {
    ...rule,
    topic: rule.topic && rule.topic !== "Other" ? rule.topic : b.topic,
    examples: rule.examples.length ? rule.examples : b.examples,
    mistakes: rule.mistakes.length ? rule.mistakes : b.mistakes,
    questions: rule.questions.length ? rule.questions : b.questions,
    tip: rule.tip || b.tip,
    bookId: b.id,
  };
}

/** Newer `updatedAt` wins per rule id; deletions are kept so they sync. */
export function mergeRuleLists(a = [], b = []) {
  const byId = new Map();
  for (const r of [...a, ...b]) {
    const cur = byId.get(r.id);
    if (!cur || String(r.updatedAt) > String(cur.updatedAt)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((x, y) => String(y.addedAt).localeCompare(String(x.addedAt)));
}

const WRONG_RIGHT = /^(?:[✗x×]\s*|wrong\s*:?\s*|incorrect\s*:?\s*)?(.+?)\s*(?:=>|→|->)\s*(?:[✓]\s*|right\s*:?\s*|correct\s*:?\s*)?(.+)$/i;
const EXAMPLE = /^(?:e\.?g\.?|example|ex\.?|eg)\s*[:.-]?\s*(.+)$/i;

/** One block of typed/scanned text → a rule (title, rule text, examples, wrong → right lines). */
function blockToRule(block) {
  const lines = block
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•▪●]|\(?[a-z]\))\s+/i, "").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const examples = [];
  const mistakes = [];
  const text = [];
  for (const l of lines) {
    const wr = WRONG_RIGHT.exec(l);
    const ex = EXAMPLE.exec(l);
    if (wr && wr[1].length > 3 && wr[2].length > 3) mistakes.push({ wrong: wr[1].trim(), right: wr[2].trim(), why: "" });
    else if (ex) examples.push(ex[1].trim());
    else text.push(l);
  }
  const first = text[0] || lines[0];
  // A short first line followed by more text is a heading; otherwise the first sentence names the rule.
  const heading = text.length > 1 && first.length <= 90 && !/[.!?]$/.test(first);
  const title = heading ? first : first.split(/(?<=[.!?])\s/)[0].slice(0, 90);
  const rule = (heading ? text.slice(1) : text).join(" ").trim() || first;
  return { title: title.replace(/[:.]+$/, ""), rule, examples, mistakes };
}

/**
 * Split typed notes or scanned text into rules (free mode, no AI): blank lines separate rules; failing that,
 * numbered or bulleted items do. Lines like "wrong => right" become mistakes and "e.g. …" lines examples.
 */
export function textToRules(text) {
  const clean = String(text || "").replace(/\r/g, "").trim();
  if (!clean) return [];
  let blocks = clean.split(/\n\s*\n+/);
  if (blocks.length === 1) {
    const numbered = clean.split(/\n(?=\s*(?:\d+[.)]|[-*•▪●])\s+)/);
    if (numbered.length > 1) blocks = numbered;
  }
  return blocks.map(blockToRule).filter((r) => r && r.rule.length >= 8);
}

/** Rule list as CSV for the Google Sheet mirror and Excel. */
export function rulesToCSV(rules) {
  const cell = (v) => {
    const s = Array.isArray(v) ? v.join(" | ") : v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Topic", "Rule", "Explanation", "Hindi", "Correct examples", "Common mistakes", "Exception / note", "Exam tip", "Added"];
  const rows = rules
    .filter((r) => !r.deleted)
    .map((r) =>
      [r.topic, r.title, r.rule, r.hindi, r.examples, r.mistakes.map((m) => `${m.wrong} → ${m.right}`), r.note, r.tip, String(r.addedAt).slice(0, 10)]
        .map(cell)
        .join(","),
    );
  return [head.join(","), ...rows].join("\n");
}
