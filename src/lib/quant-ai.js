// Maths & Reasoning with AI: read questions and formulas out of photos, handwritten PDFs or typed notes, then
// complete each: correct subject → topic → question type, step-by-step solution, 3 wrong options, the formula used,
// a short trick — and 2 practice questions of the same type. Same engine as the other parts (Gemini → others → Claude).
import { EXAMS } from "./ai.js";
import { AllProvidersFailed, aiTask, fallbackNote } from "./engine.js";
import { answerKey, questionSimilarity, textToItems } from "./gk.js";
import { QSUBJECTS, topicsOf } from "./quant-taxonomy.js";
import { makeQItem } from "./quant.js";
import { formulaLines, isQComplete, looksQuantStructured, readQuant } from "./quant-prompt.js";

export const QBATCH = 5;
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export function quantSystem({ exam }, patterns = {}) {
  const types = Object.entries(patterns)
    .filter(([, l]) => l.length)
    .slice(0, 40)
    .map(([t, l]) => `${t}: ${l.slice(0, 12).join("; ")}`);
  return [
    `You are an expert maths and reasoning teacher for an Indian aspirant preparing for ${EXAMS[exam] ?? EXAMS.general}.`,
    "Solve every question yourself step by step and double-check the answer before writing it.",
    "Write maths in plain text, never LaTeX: ×, ÷, √, ², ³, π, fractions as a/b.",
    "File every item under exactly one subject and topic from this list (subject = the part before the colon):",
    ...QSUBJECTS.map((s) => `${s}: ${topicsOf(s).join("; ")}`),
    "Give every question a `pattern`: a short name for its question type (e.g. 'Two workers together', 'Successive discounts',",
    "'Circular seating facing centre'). Questions of the same kind must get exactly the same pattern name.",
    ...(types.length ? ["Existing pattern names to reuse where they fit:", ...types] : []),
    "`trick` is a short shortcut or memory aid; `formula` is the formula or rule used.",
  ].join("\n");
}

const str = (description) => ({ type: "string", description });
const PRACTICE = {
  type: "object",
  additionalProperties: false,
  required: ["q", "a", "options", "solution"],
  properties: {
    q: str("A practice question of the same type with changed numbers or a small twist."),
    a: str("Its correct answer."),
    options: { type: "array", items: { type: "string" }, description: "Exactly 3 believable WRONG options." },
    solution: str("Step-by-step solution, one step per line."),
  },
};

/** Step 1: what is in the material. */
export const Q_LIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "q", "a", "options"],
        properties: {
          kind: str('"question" or "formula" (a formula, rule, shortcut or trick).'),
          q: str("The question as written, or the formula's name."),
          a: str("The answer given in the material (empty if none), or the formula itself."),
          options: { type: "array", items: { type: "string" }, description: "Options given in the material, if any." },
        },
      },
    },
  },
};

/** Step 2: complete cards, with 2 practice questions per question. */
export const Q_CARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "q", "a", "options", "solution", "formula", "trick", "subject", "topic", "pattern", "difficulty", "aiAnswered", "similar"],
        properties: {
          kind: str('"question" or "formula".'),
          q: str("The question (clear, exam-style) or the formula's name."),
          a: str("The correct answer (questions); empty for formulas."),
          options: { type: "array", items: { type: "string" }, description: "Questions: exactly 3 believable WRONG options. Formulas: empty." },
          solution: str("Questions: step-by-step solution, one step per line. Formulas: one small worked example."),
          formula: str("The formula or rule used (or the formula itself for a formula card)."),
          trick: str("A short shortcut or memory trick."),
          subject: str("Subject from the list."),
          topic: str("Topic from the list."),
          pattern: str("Short name of the question type (also for formulas: the type they solve)."),
          difficulty: { type: "integer", description: "1 (easy) to 5 (hard)." },
          aiAnswered: { type: "boolean", description: "true if the material gave no answer (or a wrong one) and you supplied it." },
          similar: { type: "array", items: PRACTICE, description: "Questions: practice questions of the same type as asked. Formulas: empty." },
        },
      },
    },
  },
};

export const qListInstruction = () =>
  "Read ALL the material above (it may be handwritten notes, a scanned PDF, a class slide or a book page), including margins " +
  "and anything circled or underlined. List EVERY question in it (with its answer and options if given) and EVERY formula, " +
  "rule, shortcut or trick (kind = formula, q = its name, a = the formula itself), in order. Do not skip or merge any.";

export const qCardInstruction = (items, variants) =>
  `Complete a card for EACH of these ${items.length} items, in the same order — exactly ${items.length} card(s). For a question: ` +
  "solve it; keep the given answer unless it is wrong (then correct it and set aiAnswered = true); if no answer is given, supply " +
  `it and set aiAnswered = true. ${variants ? "In `similar`, write exactly 2 practice questions of the same type with changed numbers or a small twist, each fully solved." : "Leave `similar` empty."} ` +
  "For a formula: q = its name, formula = the formula or rule, trick = how to remember or use it fast, solution = one small worked example, similar = [].\n\n" +
  items
    .map(
      (it, i) =>
        `${i + 1}. [${it.kind === "formula" ? "formula" : "question"}] ${String(it.q).slice(0, 600)}${
          it.kind === "formula" ? (it.formula ? ` | Formula: ${it.formula}` : "") : it.a ? ` | Given answer: ${it.a}` : " | No answer given"
        }${it.options?.length ? ` | Given options: ${it.options.slice(0, 5).join(" / ")}` : ""}`,
    )
    .join("\n");

const related = (item, card) => questionSimilarity(item.q, card.q) >= 0.25 || (item.a && answerKey(item.a) === answerKey(card.a));

/** Turn a card (and its practice questions) into items; practice questions point at the card's question. */
function cardToItems(card, { source, keepAnswer = "", id = uid() }) {
  const kind = card.kind === "formula" ? "formula" : "question";
  const main = { ...card, id, kind, source, aiAnswered: Boolean(card.aiAnswered || (kind === "question" && !keepAnswer && card.a)) };
  const practice =
    kind === "question"
      ? (card.similar || [])
          .filter((p) => p && p.q && p.a)
          .slice(0, 2)
          .map((p) => ({ ...p, kind: "question", variantOf: id, pattern: card.pattern, subject: card.subject, topic: card.topic, formula: card.formula, trick: card.trick, aiMade: true, source }))
      : [];
  return [main, ...practice];
}

/** Cards for `items`, QBATCH at a time; one retry for any the AI leaves out; the rest kept as written. */
async function completeCards(s, items, { variants, patterns }, onProgress, info) {
  const system = quantSystem(s, patterns);
  const out = [];
  const ask = async (batch) => {
    const res = await aiTask(s, { system, schema: Q_CARD_SCHEMA, text: qCardInstruction(batch, variants) }, null);
    info.usedBy.add(res.provider);
    const note = fallbackNote(res.skipped, res.provider);
    if (note) info.notes.add(note);
    const cards = res.words.filter((c) => c && typeof c === "object" && c.q);
    const pairs = [];
    const missing = [];
    if (cards.length === batch.length) batch.forEach((it, i) => (related(it, cards[i]) ? pairs.push([it, cards[i]]) : missing.push(it)));
    else {
      const left = [...cards];
      for (const it of batch) {
        const j = left.findIndex((c) => related(it, c));
        if (j >= 0) pairs.push([it, left.splice(j, 1)[0]]);
        else missing.push(it);
      }
    }
    return { pairs, missing };
  };
  for (let i = 0; i < items.length; i += QBATCH) {
    const batch = items.slice(i, i + QBATCH);
    onProgress?.(`Solving and writing cards ${i + 1}–${i + batch.length} of ${items.length}…`);
    try {
      let { pairs, missing } = await ask(batch);
      if (missing.length) {
        try {
          const again = await ask(missing);
          pairs = [...pairs, ...again.pairs];
          missing = again.missing;
        } catch (e) {
          if (!(e instanceof AllProvidersFailed)) throw e;
        }
      }
      // The item keeps its id, so practice questions pasted with it stay linked.
      for (const [it, card] of pairs) out.push(...cardToItems({ ...card, kind: it.kind === "formula" ? "formula" : card.kind }, { source: it.source || "", keepAnswer: it.a, id: it.id || uid() }));
      for (const it of missing) (info.failed += 1), out.push(it);
      if (missing.length) info.notes.add(`The AI left out ${missing.length} item(s); they were saved as written.`);
    } catch (e) {
      if (!(e instanceof AllProvidersFailed)) throw e;
      info.notes.add(`${e.message} → saved as written`);
      for (const it of batch) (info.failed += 1), out.push(it);
    }
  }
  return out.map((x) => makeQItem(x));
}

const result = (items, info) => ({ items, notes: [...info.notes], usedBy: [...info.usedBy], failed: info.failed });
const newInfo = () => ({ usedBy: new Set(), notes: new Set(), failed: 0 });

/** From photos / PDFs (handwritten too). Throws AllProvidersFailed if no AI could read them. */
export async function quantFromFiles(s, sources, source, opts, onProgress) {
  const info = newInfo();
  onProgress?.("Reading your notes…");
  const listed = await aiTask(s, { system: quantSystem(s, opts.patterns), schema: Q_LIST_SCHEMA, sources, text: qListInstruction() }, onProgress);
  info.usedBy.add(listed.provider);
  const items = listed.words
    .filter((x) => x && x.q)
    .map((x) => (x.kind === "formula" ? { kind: "formula", q: String(x.q), formula: String(x.a || ""), source } : { kind: "question", q: String(x.q), a: String(x.a || ""), options: x.options || [], source }));
  if (!items.length) throw new AllProvidersFailed([{ name: listed.provider, reason: "found nothing to save" }]);
  return result(await completeCards(s, items, opts, onProgress, info), info);
}

/** Questions ("Q: … A: …", "question? answer", MCQs) and formula lines ("Speed = Distance / Time") from free notes. */
export function readNotes(text, source) {
  const formulas = formulaLines(text);
  const isFormula = new Set(formulas.map((f) => f.q));
  return [
    ...textToItems(text)
      .filter((x) => x.a && !isFormula.has(x.q))
      .map((x) => ({ kind: "question", q: x.q, a: x.a, options: x.options, solution: x.explain || "", trick: x.trick || "", source })),
    ...formulas.map((f) => ({ ...f, source })),
  ];
}

/** Everything in a paste: Q:/A:/FORMULA: items, plus questions and formula lines in other formats around them. */
export function readPastedQ(text, source = "Pasted") {
  const { items, rest } = readQuant(text);
  return [...items.map((x) => ({ ...x, source })), ...readNotes(rest, source)];
}

/** True when typed text is just a topic ("Time and work", "Syllogism"): one short line, no answer, no formula. */
export const isQTopicLike = (text) => {
  const t = String(text || "").trim();
  return Boolean(t) && t.length <= 120 && !t.includes("\n") && !/[=?]/.test(t);
};

/**
 * From typed or pasted text: the copied prompt's format is read directly (only incomplete items go to the AI); a topic
 * gets a full set; questions and formulas in other formats are read locally, plain notes go through the AI listing step.
 */
export async function quantFromText(s, text, opts, onProgress) {
  const info = newInfo();
  if (looksQuantStructured(text)) {
    const read = readPastedQ(text);
    const hasPractice = new Set(read.filter((x) => x.variantOf).map((x) => x.variantOf));
    const ready = read.filter((x) => isQComplete(x) && (x.kind === "formula" || x.variantOf || hasPractice.has(x.id) || !opts.variants));
    const todo = read.filter((x) => !ready.includes(x));
    // Only questions that came without practice questions get new ones.
    const wantPractice = todo.filter((x) => opts.variants && x.kind === "question" && !x.variantOf && !hasPractice.has(x.id));
    const rest = todo.filter((x) => !wantPractice.includes(x));
    const done = [
      ...(wantPractice.length ? await completeCards(s, wantPractice, { ...opts, variants: true }, onProgress, info) : []),
      ...(rest.length ? await completeCards(s, rest, { ...opts, variants: false }, onProgress, info) : []),
    ];
    if (!todo.length) info.notes.add(`${read.length} item(s) read from the pasted answer — no AI needed.`);
    return result([...ready.map((x) => makeQItem(x)), ...done], info);
  }
  if (isQTopicLike(text)) return quantFromTopic(s, text.trim(), "auto", opts, onProgress);
  let items = readNotes(text, "Typed");
  if (!items.length) {
    onProgress?.("Finding the questions and formulas in your notes…");
    const listed = await aiTask(s, { system: quantSystem(s, opts.patterns), schema: Q_LIST_SCHEMA, sources: [{ kind: "text", name: "notes", text }], text: qListInstruction() }, onProgress);
    info.usedBy.add(listed.provider);
    items = listed.words
      .filter((x) => x && x.q)
      .map((x) => (x.kind === "formula" ? { kind: "formula", q: String(x.q), formula: String(x.a || ""), source: "Typed" } : { kind: "question", q: String(x.q), a: String(x.a || ""), options: x.options || [], source: "Typed" }));
    if (!items.length) throw new AllProvidersFailed([{ name: listed.provider, reason: "found nothing to save" }]);
  }
  return result(await completeCards(s, items, opts, onProgress, info), info);
}

/** Step 1 of a topic: its formulas and its common question types. */
export const Q_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "name", "formula", "questions"],
        properties: {
          kind: str('"formula" (a formula, rule or shortcut) or "type" (a common question type).'),
          name: str("The formula's name, or the question type's short name."),
          formula: str("For a formula: the formula itself. For a type: empty."),
          questions: { type: "integer", description: "For a type: how many questions it deserves (1–3). For a formula: 0." },
        },
      },
    },
  },
};

/** A full set on a topic: formula cards for it, then questions for every common question type. */
export async function quantFromTopic(s, topic, count, opts, onProgress) {
  const info = newInfo();
  const system = quantSystem(s, opts.patterns);
  onProgress?.(`Planning “${topic.slice(0, 60)}”: formulas and question types…`);
  const plan = await aiTask(
    s,
    {
      system,
      schema: Q_PLAN_SCHEMA,
      text:
        `Topic: "${topic}". List (1) every important formula, rule and shortcut of this topic, and (2) EVERY common question type ` +
        `asked on it in these exams, with how many questions each type deserves${count === "auto" ? " (2 each)" : ` (about ${count} questions in total)`}.`,
    },
    null,
  );
  info.usedBy.add(plan.provider);
  const formulas = plan.words.filter((p) => p && p.kind === "formula" && p.name).map((p) => ({ kind: "formula", q: String(p.name), formula: String(p.formula || ""), source: `AI · ${topic.slice(0, 60)}` }));
  const types = plan.words.filter((p) => p && p.kind !== "formula" && p.name).map((p) => ({ name: String(p.name).slice(0, 80), n: Math.min(3, Math.max(1, Math.round(Number(p.questions)) || 2)) }));
  const out = formulas.length ? await completeCards(s, formulas, { ...opts, variants: false }, onProgress, info) : [];
  const per = opts.variants ? 2 : 4; // cards per call (each card with practice questions is three questions)
  let missed = 0;
  for (let i = 0; i < types.length; i += per) {
    const batch = types.slice(i, i + per);
    const n = batch.reduce((k, t) => k + t.n, 0);
    onProgress?.(`Writing questions for types ${i + 1}–${i + batch.length} of ${types.length}…`);
    try {
      const res = await aiTask(
        s,
        {
          system,
          schema: Q_CARD_SCHEMA,
          text:
            `Topic: "${topic}". Write exactly ${n} exam-style questions (kind = question), fully solved, of these types — pattern = the type name ` +
            `(number of questions in brackets): ${batch.map((t) => `${t.name} (${t.n})`).join("; ")}. aiAnswered = false. ` +
            (opts.variants ? "In `similar`, write exactly 2 practice questions of the same type for each, fully solved." : "Leave `similar` empty."),
        },
        null,
      );
      info.usedBy.add(res.provider);
      for (const c of res.words.filter((c) => c && c.q && c.a)) out.push(...cardToItems({ ...c, kind: "question", aiMade: true }, { source: `AI · ${topic.slice(0, 60)}`, keepAnswer: c.a }).map((x) => makeQItem({ ...x, aiMade: true })));
    } catch (e) {
      if (!(e instanceof AllProvidersFailed)) throw e;
      missed += batch.length;
      info.notes.add(e.message);
    }
  }
  if (!out.length) throw new AllProvidersFailed([{ name: [...info.usedBy][0] || "AI", reason: "wrote nothing on this topic" }]);
  const qs = out.filter((x) => x.kind === "question").length;
  info.notes.add(`${out.length - qs} formula card(s) and ${qs} question(s) on “${topic.slice(0, 60)}”, covering ${types.length - missed} of ${types.length} question types. Written by AI — check anything that looks off.`);
  return result(out, info);
}

/** 2 practice questions for a saved question. Resolves {items, provider} or null. */
export async function practiceFor(s, item, patterns) {
  const info = newInfo();
  const res = await aiTask(
    s,
    {
      system: quantSystem(s, patterns),
      schema: Q_CARD_SCHEMA,
      text: qCardInstruction([item], true),
    },
    null,
  );
  const card = res.words.find((c) => c && c.q);
  if (!card) return null;
  const practice = (card.similar || [])
    .filter((p) => p && p.q && p.a)
    .slice(0, 2)
    .map((p) => makeQItem({ ...p, kind: "question", variantOf: item.id, pattern: item.pattern || card.pattern, subject: item.subject, topic: item.topic, formula: item.formula || card.formula, trick: item.trick || card.trick, aiMade: true, source: `AI · practice` }));
  info.usedBy.add(res.provider);
  return practice.length ? { items: practice, provider: res.provider, card } : null;
}
