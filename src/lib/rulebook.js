// The built-in Grammar Rule Book: parser for the plain-text format in src/data/rules*.js, a checker that
// finds mistakes in that text (run by the tests on every build), and a lazy loader.
import { makeRule, ruleKey } from "./rules.js";

export const BOOK_PREFIX = "rb:";
const BASIC = 2; // rules without a D: line
/** Level 4–5 rules are the advanced, RBI Grade B–style ones. */
export const ADVANCED = 4;
export const isAdvanced = (r) => (r.difficulty ?? BASIC) >= ADVANCED;
export const isBookId = (id) => String(id).startsWith(BOOK_PREFIX);

/** "Q: text | a; *b; c" → {q, options, answer}. The option starting with * is the right one. */
function parseQuestion(line) {
  const [q, opts = ""] = line.split(/\s*\|\s*/);
  const raw = opts.split(/\s*;\s*/).filter(Boolean);
  const answer = raw.findIndex((o) => o.startsWith("*"));
  return { q: q.trim(), options: raw.map((o) => o.replace(/^\*/, "").trim()), answer, stars: raw.filter((o) => o.startsWith("*")).length };
}

/**
 * Parse Rule Book text. Returns {rules, problems}: problems list anything malformed (missing rule text,
 * a question without exactly one starred answer, a "X:" line without "=>", duplicate titles…).
 */
export function parseRuleBook(text) {
  const rules = [];
  const problems = [];
  let topic = "Other";
  let cur = null;
  const seen = new Set();
  const finish = () => {
    if (!cur) return;
    if (!cur.rule) problems.push(`"${cur.title}": no R: line`);
    rules.push(cur);
    cur = null;
  };
  String(text)
    .split("\n")
    .forEach((raw, n) => {
      const line = raw.trim();
      if (!line || line.startsWith("//")) return;
      const at = `line ${n + 1}`;
      if (line.startsWith("## ")) {
        finish();
        topic = line.slice(3).trim();
        return;
      }
      if (line.startsWith("# ")) {
        finish();
        const title = line.slice(2).trim();
        const key = ruleKey(title);
        if (seen.has(key)) problems.push(`${at}: duplicate rule "${title}"`);
        seen.add(key);
        cur = { id: BOOK_PREFIX + key.replace(/ /g, "-"), title, topic, rule: "", note: "", tip: "", examples: [], mistakes: [], questions: [], difficulty: BASIC };
        return;
      }
      const m = /^([A-Z]):\s*(.*)$/.exec(line);
      if (!m || !cur) {
        problems.push(`${at}: not understood: ${line.slice(0, 60)}`);
        return;
      }
      const [, tag, body] = m;
      if (tag === "R") cur.rule = cur.rule ? `${cur.rule} ${body}` : body;
      else if (tag === "N") cur.note = cur.note ? `${cur.note} ${body}` : body;
      else if (tag === "T") cur.tip = cur.tip ? `${cur.tip} ${body}` : body;
      else if (tag === "D") {
        const d = Number(body);
        if (!Number.isInteger(d) || d < 1 || d > 5) problems.push(`${at}: D: must be a level from 1 to 5`);
        else cur.difficulty = d;
      }
      else if (tag === "E") cur.examples.push(body);
      else if (tag === "X") {
        const [wrong, right] = body.split(/\s*=>\s*/);
        if (!wrong || !right) problems.push(`${at}: X: line needs "wrong => right"`);
        else cur.mistakes.push({ wrong, right, why: "" });
      } else if (tag === "W") {
        const last = cur.mistakes.at(-1);
        if (!last) problems.push(`${at}: W: line must follow an X: line`);
        else last.why = body;
      } else if (tag === "Q") {
        const q = parseQuestion(body);
        if (q.stars !== 1) problems.push(`${at}: question needs exactly one *answer (has ${q.stars})`);
        else if (q.options.length < 2) problems.push(`${at}: question needs at least 2 options`);
        else if (new Set(q.options).size !== q.options.length) problems.push(`${at}: question has repeated options`);
        else cur.questions.push({ q: q.q, options: q.options, answer: q.answer, why: "" });
      } else problems.push(`${at}: unknown letter "${tag}:"`);
    });
  finish();
  // A question's explanation defaults to the rule's first mistake explanation.
  for (const r of rules) for (const q of r.questions) q.why ||= r.mistakes[0]?.why || "";
  return { rules, problems };
}

let book = null;
let loading = null;

/** Load the Rule Book (lazily loaded parts; 4 and 5 are the advanced RBI Grade B rules). Resolves the parsed rules. */
export function loadRuleBook() {
  if (book) return Promise.resolve(book);
  loading ??= Promise.all([
    import("../data/rules1.js"),
    import("../data/rules2.js"),
    import("../data/rules3.js"),
    import("../data/rules4.js"),
    import("../data/rules5.js"),
  ]).then((parts) => {
    book = parseRuleBook(parts.map((p) => p.default).join("\n")).rules;
    return book;
  });
  return loading;
}

export const ruleBookLoaded = () => book;

/** A Rule Book entry shaped like the learner's own rules, with their progress on it. */
export function bookRecord(entry, progress = {}, rank = 0) {
  return {
    ...makeRule({
      ...entry,
      ...progress,
      id: entry.id,
      difficulty: entry.difficulty ?? BASIC,
      source: "Rule Book",
      addedAt: `9${String(rank).padStart(4, "0")}`, // sorts after the learner's own rules, in book order
      updatedAt: progress.updatedAt || "0",
    }),
    book: true,
  };
}
