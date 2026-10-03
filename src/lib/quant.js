// Maths & Reasoning records: questions (with answer, wrong options, step-by-step solution, the formula used and a
// short trick) and formula / trick cards. Questions have a "type" (pattern) so similar questions can be practised
// together; practice questions made from a question point back to it (variantOf). Pure; unit-tested.
import { todayISO } from "./words.js";
import { answerKey, questionSimilarity } from "./gk.js";
import { plainMath } from "./mathtext.js";
import { cleanImage, sanitizeSvg } from "./svgsafe.js";
import { QSUBJECTS, QUANT, classifyQuant, matchTopic, topicsOf } from "./quant-taxonomy.js";

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
// Keep line breaks (solutions are steps), tidy everything else.
const text = (v, max = 1000) =>
  plainMath(String(v ?? ""))
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, max);
const line = (v, max = 300) => text(v, max).replace(/\n/g, " ");
const clampInt = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export const KINDS = { question: "Question", formula: "Formula / trick" };

/** A known subject and topic for the item; unknown ones are worked out from its text. */
export function placeOfQ(input) {
  const subject = QSUBJECTS.find((s) => s.toLowerCase() === String(input.subject || "").trim().toLowerCase()) || "";
  const named = input.topic ? matchTopic(subject, input.topic) : "";
  if (named) return { subject: named[0], topic: named[1] };
  const c = classifyQuant(`${input.topic || ""} ${input.pattern || ""} ${input.q || ""} ${input.formula || ""}`);
  if (subject && c.subject !== subject) return { subject, topic: topicsOf(subject)[0] };
  return { subject: c.subject, topic: c.topic };
}

/** "Two workers together", tidied; empty means "General". */
export const cleanPattern = (p) =>
  line(p, 80)
    .replace(/^(type|pattern|question type)\s*[:\-–]\s*/i, "")
    .replace(/[.:;]+$/, "");

export function makeQItem(input = {}, now = new Date()) {
  const stamp = now.toISOString();
  const kind = input.kind === "formula" ? "formula" : "question";
  const a = line(input.a ?? input.answer, 300);
  const options = [...new Set((Array.isArray(input.options) ? input.options : []).map((o) => line(o, 200)).filter((o) => o && answerKey(o) !== answerKey(a)))].slice(0, 4);
  return {
    id: input.id || uid(),
    kind,
    q: text(input.q ?? input.question ?? input.title, 1200) || "Untitled",
    a: kind === "formula" ? "" : a,
    options: kind === "formula" ? [] : options, // WRONG options only
    solution: text(input.solution ?? input.example, 1500), // steps (questions) or a worked example (formulas)
    formula: text(input.formula ?? (kind === "formula" ? input.a : ""), 800),
    trick: text(input.trick, 600),
    figure: sanitizeSvg(input.figure), // a labelled diagram (safe SVG), drawn by AI or built in
    image: cleanImage(input.image), // or a photo of the book's figure the learner attached
    ...placeOfQ(input),
    pattern: cleanPattern(input.pattern),
    variantOf: input.variantOf ? String(input.variantOf) : "",
    difficulty: clampInt(input.difficulty, 1, 5, 3),
    source: line(input.source, 160),
    aiAnswered: Boolean(input.aiAnswered),
    aiMade: Boolean(input.aiMade), // a practice question written by AI
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

export const isFormula = (it) => it.kind === "formula";

const numbersIn = (t) => (String(t || "").match(/\d+(?:\.\d+)?/g) || []).join(" ");
const differentNumbers = (a, b) => {
  const [x, y] = [numbersIn(a), numbersIn(b)];
  return Boolean(x && y && x !== y) || Boolean(a && b && !x && !y && answerKey(a) !== answerKey(b) && answerKey(a).length < 30 && answerKey(b).length < 30);
};

/** The saved item that is the same as `item`: same kind, and the same answer with similar wording (or near-identical wording). */
export function findDuplicateQ(item, list) {
  let best = null;
  for (const x of list) {
    if (x.deleted || x.id === item.id || x.kind !== item.kind) continue;
    const sim = questionSimilarity(item.q, x.q);
    let same;
    if (item.kind === "formula") same = sim >= 0.8 || (item.formula && answerKey(item.formula) === answerKey(x.formula) && sim >= 0.4);
    // Maths questions differ by their numbers, which the similarity counts, so "same answer" alone is never enough —
    // and answers with different numbers mean different questions, however alike the wording.
    else same = !differentNumbers(item.a, x.a) && (sim >= 0.92 || (answerKey(item.a) && answerKey(item.a) === answerKey(x.a) && sim >= 0.75));
    if (same && (!best || sim > best.score)) best = { item: x, score: sim };
  }
  return best?.item ?? null;
}

/**
 * The existing type in this topic that a new type name means ("A and B together" ≈ "Two workers together" is not
 * guessed, but "Two workers together." / "two workers working together" are). Returns the existing name or the new one.
 */
export function matchPattern(name, existing) {
  const p = cleanPattern(name);
  if (!p) return "";
  const n = p.toLowerCase();
  return existing.find((e) => e.toLowerCase() === n) ?? existing.find((e) => questionSimilarity(e, p) >= 0.75) ?? p;
}

export function qItemsToCSV(items) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Kind", "Subject", "Topic", "Type", "Question / Formula name", "Answer", "Wrong options", "Solution / Example", "Formula", "Trick", "Practice question of"];
  const byId = new Map(items.map((i) => [i.id, i]));
  return [
    head.join(","),
    ...items.map((i) =>
      [KINDS[i.kind], i.subject, i.topic, i.pattern, i.q, i.a, i.options.join("; "), i.solution, i.formula, i.trick, byId.get(i.variantOf)?.q || ""].map(cell).join(","),
    ),
  ].join("\n");
}

export { QUANT };
