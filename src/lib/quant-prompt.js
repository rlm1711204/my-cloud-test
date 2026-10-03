// Maths & Reasoning: the prompts a learner copies into Gemini / ChatGPT (for a photo or handwritten PDF, a topic,
// or "2 more like this one"), and a forgiving reader for the answer pasted back. Pure; unit-tested.
import { QSUBJECTS, QTAXONOMY, QUANT, REASONING, matchTopic, topicsOf } from "./quant-taxonomy.js";
import { plainMath } from "./mathtext.js";

const EXAMS_TEXT = "SSC, IBPS / SBI, RBI Grade B and other competitive exams";
const uid = (n) => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${n}`;

const topicLines = () => QSUBJECTS.map((s) => `  - ${s}: ${topicsOf(s).join("; ")}`).join("\n");

/** Existing question types, so the AI reuses their names: "Quant › Time & Work: Two workers together; …". */
const typeLines = (patterns = {}) => {
  const lines = Object.entries(patterns)
    .filter(([, list]) => list.length)
    .slice(0, 40)
    .map(([topic, list]) => `  - ${topic}: ${list.slice(0, 12).join("; ")}`);
  return lines.length ? `\n  Reuse these existing TYPE names where they fit:\n${lines.join("\n")}` : "";
};

const EXAMPLE = `## Quant › Time & Work
TYPE: Two workers together
Q: A can finish a work in 10 days and B in 15 days. In how many days will they finish it together?
A: 6 days
O: 5 days; 8 days; 12.5 days
S: A does 1/10 and B does 1/15 of the work per day.
S: Together they do 1/10 + 1/15 = 1/6 of the work per day, so they need 6 days.
F: Together time = (a × b)/(a + b)
T: Product ÷ sum: (10 × 15)/(10 + 15) = 6.
PQ: A can finish a work in 12 days and B in 24 days. In how many days will they finish it together?
A: 8 days
O: 6 days; 9 days; 18 days
S: (12 × 24)/(12 + 24) = 288/36 = 8 days.
PQ: A and B together finish a work in 6 days; A alone takes 10 days. How long does B alone take?
A: 15 days
O: 12 days; 16 days; 4 days
S: B's rate = 1/6 − 1/10 = 1/15, so 15 days.

FORMULA: Two workers together
F: Together time = (a × b)/(a + b)
T: Product ÷ sum.
E: 10 and 15 days → (10 × 15)/25 = 6 days.`;

// A geometry question with its figure, for the reply format (O = centre, T = point of contact, P = outside point).
export const FIGURE_EXAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 130"><circle cx="70" cy="70" r="40" fill="none" stroke="currentColor" stroke-width="2"/><line x1="70" y1="70" x2="82.3" y2="31.9" stroke="currentColor" stroke-width="2"/><line x1="82.3" y1="31.9" x2="200" y2="70" stroke="currentColor" stroke-width="2"/><line x1="70" y1="70" x2="200" y2="70" stroke="currentColor" stroke-dasharray="4 3"/><path d="M79.8,39.5 L87.4,42 L89.9,34.4" fill="none" stroke="currentColor"/><circle cx="70" cy="70" r="2.5" fill="currentColor"/><text x="58" y="86" font-size="13">O</text><text x="76" y="24" font-size="13">T</text><text x="205" y="75" font-size="13">P</text><text x="62" y="52" font-size="12">5</text><text x="130" y="85" font-size="12">13</text></svg>`;

const GEOMETRY_EXAMPLE = `## Quant › Geometry
TYPE: Tangent from an external point
Q: P is 13 cm from the centre O of a circle of radius 5 cm. Find the length of the tangent PT.
A: 12 cm
O: 8 cm; 18 cm; 13 cm
S: The radius OT is perpendicular to the tangent at T, so triangle OTP is right-angled at T.
S: PT = √(13² − 5²) = √144 = 12 cm.
F: Tangent length = √(d² − r²) (Tangent–radius theorem)
T: Right angle at the point of contact → Pythagoras (5, 12, 13).
FIG: ${FIGURE_EXAMPLE}`;

const FIGURE_RULES = `- For geometry, mensuration, trigonometry (heights and distances) and any question or formula where a diagram helps, add ONE line "FIG:" followed by a small SVG drawing on the same line: viewBox about 240 × 160, stroke="currentColor", fill="none", stroke-width="2", every point labelled with <text> (A, B, C, O, P, T…), given lengths and angles written on the figure, right angles marked with a small square, dashed lines for constructions. Draw it to match the question exactly. No figure when none is needed.
- Name formula cards with the standard name of the theorem or formula (e.g. "Tangent–radius theorem", "Alternate segment theorem", "Heron's formula", "Basic proportionality theorem").`;

/** Rules and the reply format shared by every copied prompt (read back by readQuant). */
function rulesAndFormat({ variants = true, patterns } = {}) {
  return `Rules:
- Solve every question yourself, step by step, and double-check the answer. If the material's answer is wrong, give the correct one.
- Write maths in plain text, never LaTeX: ×, ÷, √, ², ³, π, and fractions as a/b.
- Every question has ONE correct answer, exactly 3 believable wrong options (answers from common mistakes), a short step-by-step solution (one or more S: lines), the formula or rule used (F:) and a short trick or shortcut (T:).
- Give every question a TYPE: a short name for the kind of question (e.g. "Two workers together", "Successive discounts", "Circular seating facing centre", "Either-or conclusions"). Questions of the same kind must use exactly the same TYPE name.${typeLines(patterns)}
- Write a FORMULA card for every formula, rule, shortcut or trick (F: the formula or rule, T: how to remember or use it fast, E: one small worked example).
${FIGURE_RULES}
${variants ? "- After each question, add 2 practice questions of the same TYPE with changed numbers or a small twist (PQ:), each with its own A:, O: and S: lines.\n" : ""}- Put everything under a heading "## Subject › Topic" from this list:
${topicLines()}

Reply ONLY in this plain-text format — no tables, no bold, no LaTeX, no extra text. Leave a blank line between questions:

${variants ? EXAMPLE : EXAMPLE.replace(/\nPQ:[\s\S]*?(?=\n\nFORMULA)/, "")}

${GEOMETRY_EXAMPLE}`;
}

/** Prompt for photos / scanned or handwritten PDFs attached in the chat app. */
export function buildQuantMaterialPrompt({ files = [], variants = true, patterns } = {}) {
  const what = files.length > 1 ? `${files.length} images / PDFs` : "an image / PDF";
  return `You are an expert maths and reasoning teacher for ${EXAMS_TEXT}.

I have attached ${what} from my notes — it may be handwritten, a class slide or a book page.

1. Read ALL of it carefully, including handwriting, margins and anything circled or underlined. Ignore the teacher, pen colours and screen clutter.
2. Every solved or unsolved question in it becomes a Q (solve it yourself if no answer is given).
3. Every formula, rule, shortcut or trick in it becomes a FORMULA card — leave none out.

${rulesAndFormat({ variants, patterns })}`;
}

/** Prompt for a topic: formula cards for it, then questions covering every common question type. */
export function buildQuantTopicPrompt({ topic, count = "auto", variants = true, patterns } = {}) {
  const howMany =
    count === "auto"
      ? "Then write questions covering EVERY common question type of this topic asked in these exams — at least 2 questions per type, easy to hard."
      : `Then write ${count} questions that cover the common question types of this topic, easy to hard.`;
  return `You are an expert maths and reasoning teacher for ${EXAMS_TEXT}.

Topic: ${String(topic).trim()}

First write FORMULA cards for every important formula, rule and shortcut of this topic. ${howMany}

${rulesAndFormat({ variants, patterns })}`;
}

/** Prompt for "2 more like this one" for a saved question. Its answer repeats the question, so the new ones link to it. */
export function buildSimilarPrompt(item) {
  return `You are an expert maths and reasoning teacher for ${EXAMS_TEXT}.

Here is a question I saved. Write 2 practice questions of exactly the same TYPE with changed numbers or a small twist, each fully solved.

Reply ONLY in this plain-text format (repeat my question first, then your 2 practice questions as PQ):

## ${item.subject} › ${item.topic}
TYPE: ${item.pattern || "(name the type)"}
Q: ${item.q.replace(/\n/g, " ")}
A: ${item.a}
PQ: (your first practice question)
A: (answer)
O: (3 wrong options separated by ;)
S: (step-by-step solution, one or more S: lines)
PQ: (your second practice question)
A: …
O: …; …; …
S: …

Write maths in plain text, never LaTeX: ×, ÷, √, ², π, fractions as a/b. Double-check every answer.`;
}

/** Prompt for a figure for a saved question or formula card. The answer repeats it, so the figure joins the saved card. */
export function buildFigurePrompt(item) {
  const head = item.kind === "formula" ? `FORMULA: ${item.q}\nF: ${(item.formula || "").replace(/\n/g, " ")}` : `Q: ${item.q.replace(/\n/g, " ")}\nA: ${item.a}`;
  return `You are an expert maths teacher. Draw the figure for this ${item.kind === "formula" ? "formula" : "question"}.

Reply ONLY with these lines — first repeat mine exactly, then one FIG: line with the SVG drawing on the same line:

## ${item.subject} › ${item.topic}
${head}
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">…</svg>

Drawing rules: viewBox about 240 × 160, stroke="currentColor", fill="none", stroke-width="2", every point labelled with <text> (A, B, C, O, P, T…), given lengths and angles written on the figure, right angles marked with a small square, dashed lines for constructions. Match the ${item.kind === "formula" ? "formula" : "question"} exactly.

Example of a good figure line:
FIG: ${FIGURE_EXAMPLE}`;
}

// ---------- reading the answer back ----------
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const SUBJECT_ALIASES = [
  [QUANT, /^(quant|quantitative|aptitude|maths?|mathematics|arithmetic|advanced maths|numerical)/],
  [REASONING, /^(reasoning|logical|verbal reasoning|non verbal|mental ability|general intelligence)/],
];

/** "Quant › Time & Work", "Reasoning > Syllogism", "Time and Work" → {subject, topic} or null. */
export function readQHeading(textLine) {
  const parts = String(textLine)
    .split(/\s*(?:›|»|>|\/|\||:|\s[-–—]\s)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const subject = SUBJECT_ALIASES.find(([, re]) => re.test(norm(parts[0])))?.[0];
  if (subject) {
    const t = parts[1] ? matchTopic(subject, parts[1]) : "";
    return { subject, topic: t ? t[1] : "" };
  }
  const t = matchTopic("", parts[0]);
  return t ? { subject: t[0], topic: t[1] } : null;
}

const clean = (l) =>
  l
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*•]\s+)/, "")
    .trim();
// "Name: value" lines. Only ":" or a dash counts as the separator, so "a) 5 days" stays an option, not an answer.
const F = (names) => new RegExp(`^(?:${names})\\s*\\d{0,2}\\s*[:\\-–]\\s*(.*)$`, "i");
const Q_LINE = new RegExp(`^(?:\\d{1,3}\\s*[.)]\\s*)?(?:q(?:uestion)?)\\s*\\d{0,3}\\s*[:.)\\-–]\\s*(.+)$`, "i");
const PQ_LINE = F("pq|practice (?:question|q)|similar(?: question)?|variant|q\\+");
// A new formula card: "FORMULA: …" (capitals) or "Formula card: …"; a plain "Formula: …" only when outside an item
// (inside a question it is the formula used).
const CARD_UP = /^(?:FORMULA|RULE|SHORTCUT|CONCEPT)\s*\d{0,2}\s*[:\-–]\s*(.+)$/;
const CARD_NAMED = /^(?:formula card|formula name|formula title|trick card)\s*\d{0,2}\s*[:\-–]\s*(.+)$/i;
const CARD_LOOSE = /^(?:formula|rule|shortcut|concept)\s*\d{0,2}\s*[:\-–]\s*(.+)$/i;
const TYPE_LINE = F("type|question type|pattern");
const A_LINE = F("a|ans|answer|correct answer|right answer");
const O_LINE = F("o|opts?|options?|wrong options?|wrong answers?|distractors?");
const S_LINE = F("s|sol|solution|steps?|explanation|working|method");
const FM_LINE = F("f|formula used|formula|rule used|rule");
const T_LINE = F("t|trick|tip|shortcut|short trick|mnemonic|memory tip");
const E_LINE = F("e|eg|e\\.g|example|worked example");
const D_LINE = F("d|difficulty|level");
const LETTER_OPTION = /^\(?([a-dA-D])[).]\s+(.+)$/;
const HEADING = /^(?:#{1,4}\s*(.+)|\*\*(.+)\*\*\s*$)/;

/** True when text uses the Q:/A: or FORMULA: format. */
export function looksQuantStructured(textIn) {
  const lines = String(textIn || "").split("\n").map(clean);
  return lines.some((l) => CARD_UP.test(l) || CARD_NAMED.test(l)) || (lines.some((l) => Q_LINE.test(l)) && lines.some((l) => A_LINE.test(l)));
}

/**
 * Read questions, practice questions (linked to their question by variantOf) and formula cards.
 * Returns {items, rest}: `rest` is the text that is not part of any of them.
 */
export function readQuant(textIn) {
  const out = [];
  const rest = [];
  let place = { subject: "", topic: "" };
  let pattern = "";
  let cur = null;
  let field = null;
  let original = null; // the last Q, for the PQs after it
  let n = 0;
  let fig = null; // lines of a figure being read (until </svg>)
  let pendingFig = ""; // a figure given before its question
  const finish = () => {
    if (cur?.q) {
      const letter = /^\(?([a-dA-D])\)?(?:[.)\s]|$)/.exec(cur.a);
      if (cur.kind === "question" && letter && cur.letters[letter[1].toLowerCase()]) cur.a = cur.letters[letter[1].toLowerCase()];
      const options = [...new Set([...cur.options, ...Object.values(cur.letters)].map((o) => o.trim()).filter((o) => o && norm(o) !== norm(cur.a)))];
      const { letters, ...item } = cur;
      out.push({ ...item, options, solution: item.solution.trim(), formula: item.formula.trim(), trick: item.trick.trim() });
    }
    cur = null;
    field = null;
  };
  const start = (kind, q, extra = {}) => {
    finish();
    rest.push("");
    cur = { id: uid(n++), kind, q: q.trim(), a: "", options: [], letters: {}, solution: "", formula: "", trick: "", figure: pendingFig, difficulty: 0, pattern, ...place, ...extra };
    pendingFig = "";
    field = "q";
  };
  const add = (key, value) => {
    cur[key] = cur[key] ? `${cur[key]}\n${value.trim()}` : value.trim();
    field = key;
  };
  const endFig = () => {
    const svg = fig.join("\n");
    fig = null;
    if (cur) cur.figure = svg;
    else pendingFig = svg;
  };
  for (const raw of String(textIn || "").replace(/\r/g, "").split("\n")) {
    if (/^\s*```/.test(raw)) continue;
    // Figures: "FIG: <svg …> … </svg>" (one or more lines), or a bare <svg> block. Read raw — no maths clean-up.
    if (fig) {
      fig.push(raw);
      if (/<\/svg>/i.test(raw)) endFig();
      continue;
    }
    const figStart = /^\s*(?:[-*•]\s*)?(?:\*\*)?(?:fig(?:ure)?|diagram|svg)(?:\*\*)?\s*[:\-–]\s*(?:\*\*)?\s*(.*)$/i.exec(raw) || (/^\s*<svg[\s>]/i.test(raw) ? [raw, raw.trim()] : null);
    if (figStart) {
      if (/<svg[\s>]/i.test(figStart[1])) {
        fig = [figStart[1]];
        if (/<\/svg>/i.test(figStart[1])) endFig();
      }
      continue;
    }
    const head = HEADING.exec(raw.trim());
    if (head) {
      const h = readQHeading((head[1] || head[2]).replace(/\*\*/g, ""));
      if (h) {
        finish();
        place = h;
        pattern = "";
        continue;
      }
    }
    const l = plainMath(clean(raw));
    if (!l) {
      field = null; // a blank line ends a multi-line answer, solution or trick
      continue;
    }
    let m;
    if ((m = TYPE_LINE.exec(l)) && m[1]) {
      pattern = m[1].trim();
      if (cur && !cur.a && cur.kind === "question" && field === "q") cur.pattern = pattern;
      continue;
    }
    if ((m = PQ_LINE.exec(l)) && m[1]) {
      start("question", m[1], original ? { variantOf: original.id, pattern: original.pattern || pattern, subject: original.subject, topic: original.topic } : {});
      continue;
    }
    if ((m = Q_LINE.exec(l))) {
      start("question", m[1]);
      original = cur;
      continue;
    }
    if ((m = CARD_UP.exec(l) || CARD_NAMED.exec(l) || (!cur && CARD_LOOSE.exec(l)))) {
      start("formula", m[1]);
      continue;
    }
    if (!cur) {
      rest.push(l);
      continue;
    }
    if ((m = O_LINE.exec(l)) && cur.kind === "question") {
      const parts = m[1].split(/\s*[;|]\s*/);
      cur.options.push(...(parts.length > 1 ? parts : m[1].split(/\s*,\s+/)));
      field = null;
    } else if ((m = A_LINE.exec(l)) && cur.kind === "question") (cur.a = m[1].trim()), (field = null);
    else if ((m = S_LINE.exec(l))) add("solution", m[1]);
    else if ((m = FM_LINE.exec(l))) add("formula", m[1]);
    else if ((m = T_LINE.exec(l))) add("trick", m[1]);
    else if ((m = E_LINE.exec(l))) add("solution", m[1]);
    else if ((m = D_LINE.exec(l))) cur.difficulty = Number(m[1]) || 0;
    else if (cur.kind === "question" && !cur.a && (m = LETTER_OPTION.exec(l))) cur.letters[m[1].toLowerCase()] = m[2].trim();
    else if (field === "q" || field === "solution" || field === "formula" || field === "trick") cur[field] = `${cur[field]}\n${l}`.trim();
    else {
      finish();
      rest.push("", l);
    }
  }
  finish();
  return { items: out, rest: rest.join("\n") };
}

/** A pasted question needs nothing from AI: answer, 3 wrong options, a solution and a known topic. Formulas need F:. */
export const isQComplete = (it) =>
  it.kind === "formula" ? Boolean(it.formula && it.topic) : Boolean(it.a && it.options?.length >= 3 && it.solution && it.topic);

/** Formula-like lines in free notes: "Speed = Distance / Time", "Profit% = Profit/CP × 100". */
export function formulaLines(textIn) {
  return String(textIn || "")
    .split("\n")
    .map((l) => plainMath(clean(l)))
    .filter((l) => /=/.test(l) && !/\?/.test(l) && l.length <= 200 && /[a-z]/i.test(l))
    .map((l) => {
      const [left] = l.split("=");
      return { kind: "formula", q: left.replace(/^\d+[.)]\s*/, "").trim().slice(0, 80) || l.slice(0, 60), formula: l };
    });
}

export { QTAXONOMY };
