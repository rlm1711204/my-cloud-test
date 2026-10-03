// Maths & Reasoning practice questions: multiple choice from a question's own wrong options (or answers of the same
// type), "solve on paper, then check the steps", and formula recall / "which formula?". Pure; unit-tested.
import { answerKey } from "./gk.js";

/** [kind, icon, title, description] — tiles on the Practice screen. */
export const QUANT_KINDS = [
  ["mixed", "🔀", "Mixed", "Questions and formulas"],
  ["mcq", "🔘", "Multiple choice", "Pick the right answer"],
  ["solve", "✍️", "Solve & check", "Solve on paper, then see the steps"],
  ["formula", "📐", "Formulas & tricks", "Recall every formula"],
];

/** Which items a practice kind uses. */
export const kindAccepts = (kind, it) => (kind === "formula" ? it.kind === "formula" : kind === "mcq" || kind === "solve" ? it.kind === "question" : true);

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wrong options: the item's own, then answers of the same type, then the same topic. Never one equal to the answer. */
export function qDistractors(item, pool, n = 3, rand = Math.random) {
  const right = answerKey(item.a);
  const seen = new Set([right]);
  const out = [];
  const add = (o) => {
    const k = answerKey(o);
    if (o && k && !seen.has(k)) seen.add(k) && out.push(o);
  };
  for (const o of shuffle(item.options || [], rand)) add(o);
  const others = pool.filter((x) => x.id !== item.id && x.kind === "question" && x.a);
  for (const o of shuffle(others.filter((x) => x.topic === item.topic && x.pattern === item.pattern), rand)) add(o.a);
  for (const o of shuffle(others.filter((x) => x.topic === item.topic), rand)) add(o.a);
  return out.slice(0, n);
}

const SHORT = 90;
/** Other formulas that could stand in as wrong choices for "which formula is this?". */
function formulaChoices(item, pool, rand) {
  if (!item.formula || item.formula.length > SHORT || item.formula.includes("\n")) return [];
  const others = pool.filter((x) => x.id !== item.id && x.kind === "formula" && x.formula && x.formula.length <= SHORT && !x.formula.includes("\n") && answerKey(x.formula) !== answerKey(item.formula));
  const near = [...shuffle(others.filter((x) => x.topic === item.topic), rand), ...shuffle(others.filter((x) => x.subject === item.subject && x.topic !== item.topic), rand)];
  return [...new Set(near.map((x) => x.formula))].slice(0, 3);
}

/**
 * One practice question for an item. Returns {kind, label, prompt, options, answer, itemId, selfGraded?, reveal?}.
 * "mixed": questions are mostly multiple choice (sometimes solve & check); formulas mostly recall.
 */
export function makeQuantQuestion(item, kind = "mixed", pool = [], rand = Math.random) {
  const base = { itemId: item.id };
  if (item.kind === "formula") {
    const wrong = formulaChoices(item, pool, rand);
    if (wrong.length >= 2 && (kind === "mixed" ? rand() < 0.4 : false)) {
      const options = shuffle([item.formula, ...wrong], rand);
      return { ...base, kind: "mcq", label: "Which formula is it?", prompt: item.q, options, answer: options.indexOf(item.formula) };
    }
    return {
      ...base,
      kind: "recall",
      label: "Recall the formula",
      prompt: item.q,
      reveal: item.formula || item.q,
      options: ["I remembered it", "I didn't"],
      answer: 0,
      selfGraded: true,
    };
  }
  const wrong = qDistractors(item, pool, 3, rand);
  const canMcq = item.a && wrong.length >= 2;
  const useMcq = kind === "mcq" ? canMcq : kind === "solve" ? false : canMcq && rand() < 0.7;
  if (useMcq) {
    const options = shuffle([item.a, ...wrong], rand);
    return { ...base, kind: "mcq", label: "Choose the right answer", prompt: item.q, options, answer: options.indexOf(item.a) };
  }
  return {
    ...base,
    kind: "solve",
    label: "Solve on paper, then check",
    prompt: item.q,
    reveal: item.a || "See the solution",
    options: ["I got it right", "I didn't"],
    answer: 0,
    selfGraded: true,
  };
}
