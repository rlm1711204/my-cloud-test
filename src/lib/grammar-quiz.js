// Grammar practice questions, built from each rule's own examples, mistakes and questions — so practice
// works offline and needs no AI. Pure functions (pass `rand` for repeatable tests); unit-tested.

/** [kind, icon, title, description] — shown as tiles on the Practice screen. */
export const GRAMMAR_KINDS = [
  ["mixed", "🔀", "Mixed", "All question types"],
  ["mcq", "✍️", "Fill the blank", "Pick the right word"],
  ["correct", "✅", "Which is correct?", "Find the correct sentence"],
  ["spot", "🔍", "Right or wrong?", "Error spotting"],
  ["rule", "📏", "Which rule?", "Name the rule a sentence breaks"],
  ["recall", "🧠", "Recall the rule", "Say it, then check"],
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

/** Shuffle options and return the new index of the right answer. */
function withOptions(right, wrongs, rand) {
  const options = shuffle([right, ...wrongs], rand);
  return { options, answer: options.indexOf(right) };
}

/** Correct full sentences of a rule (examples that are real sentences, plus the corrected mistakes). */
const correctSentences = (r) => [
  ...r.examples.filter((e) => /^[A-Z'‘"“]/.test(e) && /[.!?)'’"”]$/.test(e) && /\w\s\w/.test(e) && !/→|=>/.test(e)),
  ...r.mistakes.map((m) => m.right),
];

/** Question types a rule can support, given the pool it is practised with. */
export function availableKinds(rule, pool = []) {
  const kinds = [];
  if (rule.questions.length) kinds.push("mcq");
  if (rule.mistakes.length && correctSentences(rule).length) kinds.push("correct");
  if (rule.mistakes.length || correctSentences(rule).length) kinds.push("spot");
  if (rule.mistakes.length && pool.filter((r) => r.id !== rule.id).length >= 3) kinds.push("rule");
  kinds.push("recall");
  return kinds;
}

/**
 * One question for `rule`. kind "mixed" picks a type the rule supports (recall only as a last resort).
 * Returns {kind, label, prompt, options, answer, ruleId, right?, why?, selfGraded?}.
 */
export function makeGrammarQuestion(rule, kind, pool = [], rand = Math.random) {
  const kinds = availableKinds(rule, pool);
  let k = kind;
  if (k === "mixed" || !kinds.includes(k)) {
    const choices = kinds.filter((x) => x !== "recall");
    k = choices.length ? pick(choices, rand) : "recall";
  }
  const base = { kind: k, ruleId: rule.id, title: rule.title };

  if (k === "mcq") {
    const q = pick(rule.questions, rand);
    const { options, answer } = withOptions(q.options[q.answer], q.options.filter((_, i) => i !== q.answer), rand);
    return { ...base, label: "Fill the blank", prompt: q.q, options, answer, why: q.why };
  }

  if (k === "correct") {
    const right = pick(correctSentences(rule), rand);
    const own = rule.mistakes.map((m) => m.wrong);
    // Other wrong sentences: same topic first (harder), then any rule.
    const others = shuffle(pool.filter((r) => r.id !== rule.id), rand).sort((a, b) => Number(b.topic === rule.topic) - Number(a.topic === rule.topic));
    const wrongs = [...new Set([...shuffle(own, rand), ...others.flatMap((r) => r.mistakes.map((m) => m.wrong))])].filter((w) => w !== right).slice(0, 3);
    const { options, answer } = withOptions(right, wrongs, rand);
    const m = rule.mistakes.find((x) => x.right === right) || rule.mistakes[0];
    return { ...base, label: "Which sentence is correct?", prompt: "Choose the grammatically correct sentence.", options, answer, why: m?.why || "" };
  }

  if (k === "spot") {
    const showWrong = rule.mistakes.length && (!correctSentences(rule).length || rand() < 0.6);
    const m = showWrong ? pick(rule.mistakes, rand) : null;
    const sentence = m ? m.wrong : pick(correctSentences(rule), rand);
    return {
      ...base,
      label: "Right or wrong?",
      prompt: sentence,
      options: ["✓ Correct", "✗ Has an error"],
      answer: m ? 1 : 0,
      right: m?.right || "",
      why: m?.why || "",
    };
  }

  if (k === "rule") {
    const m = pick(rule.mistakes, rand);
    // Other rules from DIFFERENT topics, so only one answer can be right.
    const others = shuffle(pool.filter((r) => r.id !== rule.id && r.topic !== rule.topic), rand);
    const fill = others.length >= 3 ? others : shuffle(pool.filter((r) => r.id !== rule.id), rand);
    const wrongs = [...new Set(fill.map((r) => r.title))].filter((t) => t !== rule.title).slice(0, 3);
    const { options, answer } = withOptions(rule.title, wrongs, rand);
    return { ...base, label: "Which rule does this break?", prompt: m.wrong, options, answer, right: m.right, why: m.why };
  }

  // recall: the learner says the rule to themselves, reveals it, and marks honestly.
  return { ...base, kind: "recall", label: "Recall the rule", prompt: rule.title, options: ["I remembered it", "I didn't"], answer: 0, selfGraded: true };
}
