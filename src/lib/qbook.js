// The built-in Formula Book for Maths & Reasoning: parser + checker for src/data/qformulas.js (run by the tests on every
// build) and a lazy loader. Only progress is stored for its cards (ids "qf:…"), like the GK Question Bank.
import { readQuant } from "./quant-prompt.js";
import { makeQItem } from "./quant.js";

export const BOOK_PREFIX = "qf:";
export const isBookId = (id) => String(id).startsWith(BOOK_PREFIX);

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

/** Parse Formula Book text. Returns {items, problems}. */
export function parseBook(text) {
  const { items, rest } = readQuant(text);
  const problems = [];
  if (rest.trim()) problems.push(`lines outside any card: ${rest.trim().slice(0, 120)}`);
  const seen = new Set();
  const out = items.map((x, i) => {
    if (x.kind !== "formula") problems.push(`"${x.q}": not a FORMULA card`);
    if (!x.formula) problems.push(`"${x.q}": no F: line`);
    if (!x.trick) problems.push(`"${x.q}": no T: line`);
    if (!x.subject || !x.topic) problems.push(`"${x.q}": heading is not a known Subject › Topic`);
    const id = BOOK_PREFIX + slug(`${x.topic}-${x.q}`);
    if (seen.has(id)) problems.push(`"${x.q}": duplicate card`);
    seen.add(id);
    return { ...x, id, rank: i };
  });
  return { items: out, problems };
}

let book = null;
/** Load the Formula Book (a separate chunk). Resolves the parsed entries. */
export async function loadQBook() {
  if (book) return book;
  const { default: text } = await import("../data/qformulas.js");
  book = parseBook(text).items;
  return book;
}
export const qbookLoaded = () => book;

/** A Formula Book card with the learner's progress applied. */
export function bookRecord(entry, progress = {}) {
  const it = makeQItem({ ...entry, source: "Formula Book", addedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", pattern: "" });
  return { ...it, ...pick(progress), id: entry.id, book: true };
}
const pick = (p = {}) => Object.fromEntries(["box", "due", "reviews", "lapses", "lastReviewed", "starred"].filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
