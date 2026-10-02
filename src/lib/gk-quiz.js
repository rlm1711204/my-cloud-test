// GK practice questions, built from each question's own answer and wrong options (or answers of other
// questions in the same chapter) — so practice works offline. Pure functions; unit-tested.
import { answerKey, isFact } from "./gk.js";

/** [kind, icon, title, description] — tiles on the Practice screen. */
export const GK_KINDS = [
  ["mixed", "🔀", "Mixed", "All question types"],
  ["mcq", "🔘", "Multiple choice", "Pick the right answer"],
  ["tf", "⚖️", "True or false?", "Is this answer right?"],
  ["recall", "🧠", "Recall", "Answer in your head, then check"],
];

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Wrong options for `item`: its own first, then answers from the same chapter, then the same subject.
 * Answers that look like the right one are never used.
 */
export function distractors(item, pool, n = 3, rand = Math.random) {
  const right = answerKey(item.a);
  const seen = new Set([right]);
  const out = [];
  const add = (o) => {
    const k = answerKey(o);
    if (o && k && !seen.has(k)) {
      seen.add(k);
      out.push(o);
    }
  };
  for (const o of shuffle(item.options || [], rand)) add(o);
  const others = pool.filter((x) => x.id !== item.id && x.a);
  for (const o of shuffle(others.filter((x) => x.category === item.category && x.sub === item.sub), rand)) add(o.a);
  for (const o of shuffle(others.filter((x) => x.category === item.category), rand)) add(o.a);
  return out.slice(0, n);
}

/** A fact as a fill-the-gap card: hides a year, a number, or the last name in it. */
export function cloze(fact) {
  const t = String(fact);
  const m =
    /\b(1\d{3}|20\d{2})\b/.exec(t) || // a year
    /\b\d[\d,.]*\s*(?:%|per cent|km|crore|lakh|million|billion)?/.exec(t) || // a number
    /\b([A-Z][\w.-]*(?:\s+(?:of\s+)?[A-Z][\w.-]*)*)(?=[^A-Z]*$)/.exec(t); // the last capitalised name
  if (!m) return null;
  // Hide just the words: no surrounding spaces or a trailing full stop.
  const lead = m[0].length - m[0].trimStart().length;
  const answer = m[0].trim().replace(/[.,;:]+$/, "");
  const start = m.index + lead;
  if (!answer || answer.length === t.trim().length) return null;
  return { prompt: t.slice(0, start) + "_____" + t.slice(start + answer.length), answer };
}

/** Question types an item supports. */
export function availableKinds(item, pool = []) {
  if (isFact(item)) return ["recall"];
  const kinds = ["recall"];
  const wrong = distractors(item, pool, 3, () => 0.5);
  if (wrong.length >= 1) kinds.unshift("tf");
  if (wrong.length >= 2) kinds.unshift("mcq");
  return kinds;
}

/**
 * One question for `item`. "mixed" prefers multiple choice, then true/false (recall only as a fallback,
 * or 1 in 5 times so answers are also recalled without hints).
 * Returns {kind, label, prompt, options, answer, itemId, right, selfGraded?, reveal?}.
 */
export function makeGkQuestion(item, kind, pool = [], rand = Math.random) {
  const kinds = availableKinds(item, pool);
  let k = kind;
  if (k === "mixed" || !kinds.includes(k)) {
    // Mixed: about 1 in 5 recall (no hints), then mostly multiple choice, sometimes true/false.
    const r = rand();
    if (r < 0.2 || kinds.length === 1) k = "recall";
    else if (kinds.includes("mcq") && r < 0.75) k = "mcq";
    else k = kinds.includes("tf") ? "tf" : kinds[0];
  }
  const base = { kind: k, itemId: item.id, right: item.a };

  if (k === "mcq") {
    const wrong = distractors(item, pool, 3, rand);
    const options = shuffle([item.a, ...wrong], rand);
    return { ...base, label: "Choose the right answer", prompt: item.q, options, answer: options.indexOf(item.a) };
  }

  if (k === "tf") {
    const showRight = rand() < 0.5;
    const shown = showRight ? item.a : pick(distractors(item, pool, 3, rand), rand);
    return {
      ...base,
      label: "True or false?",
      prompt: item.q,
      claim: shown,
      options: ["✓ True", "✗ False"],
      answer: showRight ? 0 : 1,
    };
  }

  // recall: answer in your head, reveal, mark honestly. Facts become fill-the-gap cards.
  if (isFact(item)) {
    const c = cloze(item.q);
    return {
      ...base,
      kind: "recall",
      label: c ? "Fill the gap" : "Remember this fact",
      prompt: c ? c.prompt : item.q,
      reveal: c ? c.answer : item.q,
      right: c ? c.answer : "",
      options: ["I remembered it", "I didn't"],
      answer: 0,
      selfGraded: true,
    };
  }
  return { ...base, kind: "recall", label: "Recall the answer", prompt: item.q, reveal: item.a, options: ["I remembered it", "I didn't"], answer: 0, selfGraded: true };
}
