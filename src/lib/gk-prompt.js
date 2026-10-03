// Questions on a topic: how big a topic is ("Articles 124 to 147" = 24 items to cover), the prompt a learner can
// copy into Gemini / ChatGPT, and a forgiving reader for the answer they paste back. Pure; unit-tested.
import { ALL_CATEGORIES, CA, CA_TOPICS, OTHER, SEP, TAXONOMY, subsOf } from "./gk-taxonomy.js";
import { textToItems } from "./gk.js";

const EXAMS_TEXT = "UPSC, RBI Grade B and SSC";

/**
 * A numbered range in the topic — "Articles 124 to 147", "Schedules 1-12", "Amendments 42–44", "2020 to 2025" —
 * as {from, to, size}, or null. Sizes over 150 are ignored (too big to cover in one go).
 */
export function topicRange(topic) {
  const t = String(topic || "");
  const m = /\b(\d{1,4})\s*(?:to|till|until|through|[-–—])\s*(\d{1,4})\b/i.exec(t);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  const size = to - from + 1;
  return size >= 2 && size <= 150 ? { from, to, size } : null;
}

/** How many questions "Auto" means for a topic: every item of a range plus a few overview questions, else 15. */
export function autoCount(topic) {
  const r = topicRange(topic);
  if (!r) return 15;
  return Math.min(120, Math.max(10, r.size + Math.ceil(r.size / 4)));
}

/**
 * True when typed text is a topic or one sentence to make questions about, rather than questions or notes:
 * a single short line with no answer in it. (Several facts are notes: each becomes its own question.)
 */
export function isTopicLike(text, parsedItems) {
  const t = String(text || "").trim();
  if (!t || t.length > 220 || t.includes("\n")) return false;
  return parsedItems.every((i) => !i.a);
}

const taxonomyLines = () =>
  [
    ...Object.entries(TAXONOMY).map(([c, { subs }]) => `- ${c}: ${Object.keys(subs).join("; ")}`),
    `- ${CA} (headed with the event's year): ${Object.keys(CA_TOPICS).join("; ")}`,
  ].join("\n");

/** Rules and the reply format shared by every copied prompt (read back by parseStructured). */
const rulesAndFormat = (now) => `Rules:
- Be strictly factual and correct as of ${now.toISOString().slice(0, 10)}. Never invent facts; skip anything you are not sure of.
- Exam-style questions, each testing a different fact. Mix styles (direct, "which of the following", "consider the statements").
- Every question has ONE short correct answer and exactly 3 believable WRONG options of the same type (a year for a year, an Article for an Article).
- Add a 1–2 line explanation and a short memory trick (mnemonic, acronym, rhyme or story) for every question.
- Put each question under a heading "## Subject › Chapter" chosen from this list:
${taxonomyLines()}
  Events of the last few years go under "## ${CA} › YEAR › Topic", e.g. "## ${CA} › ${now.getFullYear()} › Appointments".

Reply ONLY in this exact plain-text format — no tables, no bold, no numbering, no extra text. Leave a blank line between questions:

## Polity › Judiciary
Q: Which Article of the Constitution establishes the Supreme Court of India?
A: Article 124
O: Article 32; Article 141; Article 226
E: Article 124 says there shall be a Supreme Court consisting of the Chief Justice of India and other judges.
T: 1-2-4: "One nation, Two-tier courts, For all" — the Supreme Court is born in Article 124.

Q: (next question)
A: …
O: …; …; …
E: …
T: …`;

/** The prompt to copy into Gemini, ChatGPT or any chat AI for a topic. Its answer is read back by parseStructured. */
export function buildGkPrompt({ topic, count = "auto", now = new Date() }) {
  const r = topicRange(topic);
  const howMany =
    count === "auto"
      ? r
        ? `Write as many questions as it takes to cover the WHOLE topic: at least one question for EVERY item from ${r.from} to ${r.to} (${r.size} items — leave none out), plus a few overview questions.`
        : "Write as many questions as it takes to cover EVERY part of this topic (at least 15): all key facts, dates, persons, places, numbers, firsts and related bodies."
      : `Write ${count} questions that together cover the whole topic${r ? ` — every item from ${r.from} to ${r.to}; group neighbouring items if needed` : ""}.`;
  return `You are an expert question-setter for Indian competitive exams (${EXAMS_TEXT}).

Topic: ${String(topic).trim()}

${howMany}

${rulesAndFormat(now)}`;
}

/**
 * The prompt for a photo, screenshot or PDF the learner attaches in the chat app themselves: every fact on it
 * becomes a question (each table row, each circled or underlined item), optionally plus related questions.
 */
export function buildMaterialPrompt({ files = [], related = true, now = new Date() }) {
  const what = files.length > 1 ? `${files.length} images / PDFs` : "an image / PDF";
  return `You are an expert question-setter for Indian competitive exams (${EXAMS_TEXT}).

I have attached ${what} from my study material (a class slide, book page, notes or current-affairs PDF).

1. Read ALL of it carefully and turn EVERY fact in it into exam questions — leave nothing out. Each date, name, number, place, record, first, instrument, abbreviation and definition is its own question. In a table, every row gives at least one question. Anything circled, underlined or highlighted is important: make sure it is covered.
2. Ignore the teacher, pen marks, buttons and screen clutter — use only the study content. If something on it is wrong or out of date, give the correct fact and say so in E:.
${related ? "3. Then add 5–10 closely related questions that the material does not show but an examiner would ask on the same topic (e.g. earlier and later missions, related bodies, records).\n" : ""}
${rulesAndFormat(now)}`;
}

// ---------- reading the answer back ----------
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const CATEGORY_ALIASES = [
  [CA, /^(current affairs?|ca|news|current events)\b/],
  ["Polity", /\b(polity|politics|constitution|governance)\b/],
  ["Banking & Finance", /\b(banking|finance|financial)\b/],
  ["Economy", /\b(economy|economics|economic)\b/],
  ["Science & Tech", /\b(science and tech|sci tech|science technology|technology|space|defence)\b/],
  ["Static GK", /\bstatic\b/],
  ["Geography", /\bgeograph/],
  ["History", /\bhistory|culture\b/],
  ["Biology", /\bbiology|zoology|botany\b/],
  ["Physics", /\bphysics\b/],
  ["Chemistry", /\bchemistry\b/],
];

/** "Polity › Judiciary", "Current Affairs > 2025 > Sports", "Indian Polity / Supreme Court" → {category, sub, year}. */
export function readHeading(text) {
  const parts = String(text)
    .split(/\s*(?:›|»|>|\/|\||:|\s[-–—]\s)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const head = norm(parts[0]);
  let category = ALL_CATEGORIES.find((c) => norm(c) === head) ?? CATEGORY_ALIASES.find(([, re]) => re.test(head))?.[0];
  if (!category) return null;
  if (category === CA) {
    const year = Number(parts.find((p) => /^(19|20)\d\d$/.test(p))) || 0;
    const rest = parts.slice(1).filter((p) => !/^(19|20)\d\d$/.test(p));
    return { category, year, sub: matchSub(CA, rest[0]) };
  }
  return { category, year: 0, sub: matchSub(category, parts[1]) };
}

function matchSub(category, text) {
  if (!text) return "";
  const n = norm(text);
  const subs = subsOf(category);
  return subs.find((s) => norm(s) === n) ?? subs.find((s) => norm(s).includes(n) || n.includes(norm(s))) ?? "";
}

const clean = (line) =>
  line
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*•]\s+)/, "")
    .trim();
const Q_LINE = /^(?:\d{1,3}\s*[.)]\s*)?(?:q(?:uestion)?\s*\d{0,3}\s*[:.)\-–])\s*(.+)$/i;
const A_LINE = /^(?:a|ans|answer|correct answer|right answer)\s*[:\-–]\s*(.+)$/i;
const O_LINE = /^(?:o|opts?|options?|wrong options?|wrong answers?|incorrect options?|distractors?)\s*[:\-–]\s*(.+)$/i;
const E_LINE = /^(?:e|exp|expl|explanation|explain|note|fact)\s*[:\-–]\s*(.+)$/i;
const T_LINE = /^(?:t|trick|tip|mnemonic|memory trick|memory tip|memory aid)\s*[:\-–]\s*(.+)$/i;
const LETTER_OPTION = /^\(?([a-dA-D])[).]\s+(.+)$/;
const HEADING = /^(?:#{1,4}\s*(.+)|\*\*(.+)\*\*\s*$)/;

/** True when the text uses the Q:/A: format (with or without O:/E:/T: lines and headings). */
export function looksStructured(text) {
  const lines = String(text || "").split("\n").map(clean);
  return lines.some((l) => Q_LINE.test(l)) && lines.some((l) => A_LINE.test(l));
}

/**
 * Read questions in the copied prompt's format — forgiving about bold, bullets, numbering, "Question:" /
 * "Answer:" / "Options:" spellings, options on their own "a) …" lines and code fences.
 * Returns [{q, a, options, explain, trick, category, sub, year}] (category "" when no heading was given).
 */
export function parseStructured(text) {
  return readStructured(text).items;
}

/** parseStructured, plus the lines that are not part of any Q:/A: question (`rest`). */
export function readStructured(text) {
  const out = [];
  const rest = [];
  let place = { category: "", sub: "", year: 0 };
  let cur = null;
  let field = null; // the field a continuation line belongs to
  const finish = () => {
    if (cur?.q) {
      const letter = /^\(?([a-dA-D])\)?(?:[.)\s]|$)/.exec(cur.a);
      if (letter && cur.letters[letter[1].toLowerCase()]) cur.a = cur.letters[letter[1].toLowerCase()];
      const all = [...cur.options, ...Object.values(cur.letters)];
      const options = [...new Set(all.map((o) => o.trim()).filter((o) => o && norm(o) !== norm(cur.a)))];
      out.push({ q: cur.q, a: cur.a, options, explain: cur.explain, trick: cur.trick, ...place });
    }
    cur = null;
    field = null;
  };
  for (const raw of String(text || "").replace(/\r/g, "").split("\n")) {
    if (/^\s*```/.test(raw)) continue;
    const head = HEADING.exec(raw.trim());
    if (head) {
      const h = readHeading((head[1] || head[2]).replace(/\*\*/g, ""));
      if (h) {
        finish();
        place = h;
        continue;
      }
    }
    const line = clean(raw);
    if (!line) {
      field = null;
      rest.push("");
      continue;
    }
    let m;
    if ((m = Q_LINE.exec(line))) {
      finish();
      rest.push(""); // keep text before and after this question apart
      cur = { q: m[1].trim(), a: "", options: [], letters: {}, explain: "", trick: "" };
      field = "q";
    } else if (!cur) {
      rest.push(line);
      continue;
    }
    else if ((m = O_LINE.exec(line))) {
      const parts = m[1].split(/\s*[;|]\s*/);
      cur.options.push(...(parts.length > 1 ? parts : m[1].split(/\s*,\s+/)));
      field = null;
    } else if ((m = A_LINE.exec(line))) (cur.a = m[1].trim()), (field = null);
    else if ((m = E_LINE.exec(line))) (cur.explain = m[1].trim()), (field = "explain");
    else if ((m = T_LINE.exec(line))) (cur.trick = m[1].trim()), (field = "trick");
    else if (!cur.a && (m = LETTER_OPTION.exec(line))) cur.letters[m[1].toLowerCase()] = m[2].trim();
    else if (field) cur[field] = `${cur[field]} ${line}`.trim();
    else {
      // Not part of this question (e.g. a fact after its answer): the question ends here.
      finish();
      rest.push("", line);
    }
  }
  finish();
  return { items: out, rest: rest.join("\n") };
}

// Chat AIs wrap their answer in friendly lines; those are not facts to learn.
const CHATTER = /^(sure|here|okay|ok|certainly|great|of course|absolutely|hope|let me know|feel free|below|i've|i have|i hope|happy to|good luck|note that|these questions)\b|:\s*$/i;

/**
 * Everything in pasted or typed text: Q:/A: questions (the copied prompt's format) and, around them, questions
 * and facts in the other formats (numbered MCQs, "Capital of Japan - Tokyo"…). Chat-AI chatter is dropped.
 */
export function readPasted(text) {
  const { items, rest } = readStructured(text);
  const others = textToItems(rest).filter((x) => x.a || !CHATTER.test(x.q));
  return [...items, ...others];
}

/** A pasted item is complete when it needs nothing from AI: an answer, 3 wrong options, a trick and a known place. */
export const isComplete = (it) => Boolean(it.a && it.options?.length >= 3 && it.trick && it.category && it.category !== OTHER);

export { SEP };
