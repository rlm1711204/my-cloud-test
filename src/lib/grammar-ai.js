// Grammar rules with AI: read rules out of photos, PDFs or typed notes, then write a full rule card for each
// (simple explanation, Hindi summary, examples, common mistakes, practice questions). Uses the same AI
// engine as vocabulary — Gemini → other free services → Claude — so model changes are handled there.
import { EXAMS } from "./ai.js";
import { AllProvidersFailed, aiTask, fallbackNote } from "./engine.js";
import { TOPICS, findSimilarRule, makeRule, ruleKey, similarity } from "./rules.js";

/** Rule cards per request: they're long, so small batches keep replies complete. */
export const RULE_BATCH = 6;

export function grammarSystem({ exam }) {
  return [
    `You are an English grammar coach for an Indian aspirant preparing for ${EXAMS[exam] ?? EXAMS.general}.`,
    "The learner wants exam-ready grammar rules for error spotting, sentence improvement and fill-in-the-blank questions.",
    "Follow standard exam grammar (Wren & Martin style). Never invent a rule; if the material states something wrong, give the",
    "correct rule and say so in `note`.",
    "Write each rule in plain, simple English, as a good teacher would. `hindi`: a one-line summary of the rule in simple Hindi (Devanagari).",
    "Examples must be natural, exam-style sentences and must be correct. Mistakes are typical exam errors: `wrong` is the faulty",
    "sentence, `right` the corrected one, `why` one line on the fix.",
    "Questions are multiple choice with exactly 4 options and exactly ONE correct option; `answer` is its 0-based index. Never",
    "write a question where two options could be right.",
  ].join("\n");
}

const str = (description) => ({ type: "string", description });

/** Step 1 reply: the rules found, each with the material's own wording (short, so long PDFs fit). */
export const RULE_LIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rules"],
  properties: {
    rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text"],
        properties: {
          title: str("Short name of the rule, at most 10 words."),
          text: str("The rule as the material states it, with any example given there (fixed if garbled)."),
        },
      },
    },
  },
};

/** Step 2 reply: complete rule cards. */
export const RULE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rules"],
  properties: {
    rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "topic", "rule", "hindi", "examples", "mistakes", "note", "tip", "questions", "difficulty"],
        properties: {
          title: str("Short name of the rule, at most 10 words."),
          // A plain list in the description (not an enum): every AI service accepts it.
          topic: str(`The grammar topic, exactly one of: ${TOPICS.join("; ")}.`),
          rule: str("The rule in 1–3 plain sentences."),
          hindi: str("One-line summary in simple Hindi (Devanagari)."),
          examples: { type: "array", items: { type: "string" }, description: "2 correct example sentences." },
          mistakes: {
            type: "array",
            description: "1–2 typical mistakes.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["wrong", "right", "why"],
              properties: { wrong: str("Sentence with the error."), right: str("Corrected sentence."), why: str("One line on the fix.") },
            },
          },
          note: str("Exceptions or a correction of the material, or empty string."),
          tip: str("How exams test this rule, or empty string."),
          questions: {
            type: "array",
            description: "2 multiple-choice questions.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["q", "options", "answer", "why"],
              properties: {
                q: str("Question; use ___ for the blank, or ask which sentence is correct."),
                options: { type: "array", items: { type: "string" }, description: "Exactly 4 options." },
                answer: { type: "integer", description: "0-based index of the one correct option." },
                why: str("One line explaining the answer."),
              },
            },
          },
          difficulty: { type: "integer", description: "1 (basic) to 5 (advanced)." },
        },
      },
    },
  },
};

export const listRulesInstruction = () =>
  "Read all the material above (a book page, screenshot, handwritten or typed notes, or a PDF). List EVERY distinct grammar " +
  "rule it states or illustrates, in order, each once — do not merge different rules and do not skip any. If the material is a " +
  "set of practice or error-spotting sentences, list the rule each one tests (once per rule). `text` is the rule as the material " +
  "states it, with any example from the material.";

export const writeRulesInstruction = (items) =>
  `Write a complete rule card for EACH of these ${items.length} grammar rules, in the same order — exactly ${items.length} card(s). ` +
  "Keep the learner's meaning (improve the wording if needed). Give 2 correct examples, 1–2 common mistakes, and 2 questions.\n\n" +
  items.map((it, i) => `${i + 1}. ${it.title}${it.text && it.text !== it.title ? ` — ${String(it.text).slice(0, 700)}` : ""}`).join("\n");

/** Typed text that is plainly one rule (no blank lines or list items, not long) skips the listing step. */
export function looksLikeOneRule(text) {
  const t = String(text || "").trim();
  return t.length > 0 && t.length < 500 && !/\n\s*\n/.test(t) && (t.match(/^\s*(?:\d+[.)]|[-*•])\s+/gm) || []).length <= 1;
}

/** True when an AI card is plausibly about the requested rule (shares a title or some key words). */
function related(item, card) {
  const a = makeRule({ title: item.title, rule: item.text });
  const b = makeRule(card);
  return ruleKey(a.title) === ruleKey(b.title) || similarity(a, b) >= 0.1;
}

/** Cards for `items` ({title, text}), RULE_BATCH at a time; a rule the AI leaves out is asked for once more. */
async function writeCards(s, items, onProgress, info) {
  const system = grammarSystem(s);
  const out = [];
  const ask = async (batch) => {
    const res = await aiTask(s, { system, schema: RULE_SCHEMA, text: writeRulesInstruction(batch) }, null);
    info.usedBy.add(res.provider);
    const note = fallbackNote(res.skipped, res.provider);
    if (note) info.notes.add(note);
    const cards = res.words.filter((r) => r && typeof r === "object");
    if (cards.length === batch.length) {
      // Same count: cards come back in order. Still check each one is about the rule asked for.
      const pairs = [];
      const missing = [];
      batch.forEach((it, i) => (related(it, cards[i]) ? pairs.push([it, cards[i]]) : missing.push(it)));
      return { pairs, missing };
    }
    // Fewer or more cards than asked: pair each item with the closest card.
    const pairs = [];
    const missing = [];
    const pool = cards.map((c) => makeRule(c));
    for (const it of batch) {
      const m = findSimilarRule(makeRule({ title: it.title, rule: it.text }), pool);
      if (m && m.score >= 0.3) {
        pairs.push([it, cards[pool.indexOf(m.rule)]]);
        pool.splice(pool.indexOf(m.rule), 1, makeRule({ title: "\u0000" }));
      } else missing.push(it);
    }
    return { pairs, missing };
  };
  for (let i = 0; i < items.length; i += RULE_BATCH) {
    const batch = items.slice(i, i + RULE_BATCH);
    onProgress?.(`Writing rule cards ${i + 1}–${i + batch.length} of ${items.length}…`);
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
      for (const [it, card] of pairs) out.push({ ...card, context: it.text || "", source: it.source || "" });
      for (const it of missing) {
        info.failed += 1;
        out.push({ title: it.title, rule: it.text || it.title, context: it.text || "", source: it.source || "" });
      }
      if (missing.length) info.notes.add(`The AI left out ${missing.length} rule(s); they were saved as written.`);
    } catch (e) {
      if (!(e instanceof AllProvidersFailed)) throw e;
      info.notes.add(`${e.message} → saved as written`);
      for (const it of batch) {
        info.failed += 1;
        out.push({ title: it.title, rule: it.text || it.title, context: it.text || "", source: it.source || "" });
      }
    }
  }
  return out;
}

const result = (rules, info) => ({ rules, notes: [...info.notes], usedBy: [...info.usedBy], failed: info.failed });

/**
 * Rules from photos/PDFs: list them, then write cards. Throws AllProvidersFailed if no AI could even read
 * the material (the caller then falls back to on-device text reading).
 */
export async function rulesFromFiles(s, sources, source, onProgress) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  onProgress?.("Reading the grammar rules…");
  const listed = await aiTask(s, { system: grammarSystem(s), schema: RULE_LIST_SCHEMA, sources, text: listRulesInstruction() }, onProgress);
  info.usedBy.add(listed.provider);
  const note = fallbackNote(listed.skipped, listed.provider);
  if (note) info.notes.add(note);
  const items = listed.words
    .filter((r) => r && (r.title || r.text))
    .map((r) => ({ title: String(r.title || r.text).slice(0, 160), text: String(r.text || ""), source }));
  if (!items.length) throw new AllProvidersFailed([{ name: listed.provider, reason: "found no grammar rules" }]);
  return result(await writeCards(s, items, onProgress, info), info);
}

/** Rules from typed notes (one rule, or many). */
export async function rulesFromText(s, text, onProgress) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  let items;
  if (looksLikeOneRule(text)) {
    const t = text.trim();
    items = [{ title: t.split(/(?<=[.!?:])\s|\n/)[0].slice(0, 90), text: t, source: "Typed" }];
  } else {
    onProgress?.("Finding the rules in your notes…");
    const listed = await aiTask(s, { system: grammarSystem(s), schema: RULE_LIST_SCHEMA, sources: [{ kind: "text", name: "notes", text }], text: listRulesInstruction() }, onProgress);
    info.usedBy.add(listed.provider);
    items = listed.words.filter((r) => r && (r.title || r.text)).map((r) => ({ title: String(r.title || r.text).slice(0, 160), text: String(r.text || ""), source: "Typed" }));
    if (!items.length) throw new AllProvidersFailed([{ name: listed.provider, reason: "found no grammar rules" }]);
  }
  return result(await writeCards(s, items, onProgress, info), info);
}

/** Fill in (or refresh) one saved rule with AI. Resolves the card fields, or null. */
export async function completeRule(s, rule, onProgress) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  const [card] = await writeCards(s, [{ title: rule.title, text: rule.rule }], onProgress, info);
  return info.failed ? null : { card, provider: [...info.usedBy][0] };
}
