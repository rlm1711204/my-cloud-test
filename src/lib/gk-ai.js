// GK questions with AI: read questions (or facts) out of photos, PDFs or typed notes, then complete each one:
// correct subject/chapter (or Current Affairs year/topic), three believable wrong options, a short
// explanation and a memory trick. Same engine as vocabulary and grammar (Gemini → other services → Claude).
import { EXAMS } from "./ai.js";
import { AllProvidersFailed, aiTask, fallbackNote } from "./engine.js";
import { CA, CA_TOPICS, TAXONOMY } from "./gk-taxonomy.js";
import { makeItem, questionSimilarity, answerKey, textToItems } from "./gk.js";

export const GK_BATCH = 10;

const tree = () =>
  [
    ...Object.entries(TAXONOMY).map(([c, { subs }]) => `${c}: ${Object.keys(subs).join("; ")}`),
    `${CA} (with the event's year): ${Object.keys(CA_TOPICS).join("; ")}`,
  ].join("\n");

export function gkSystem({ exam }, now = new Date()) {
  return [
    `You are a general-knowledge coach for an Indian aspirant preparing for ${EXAMS[exam] ?? EXAMS.general}.`,
    `Today's date is ${now.toISOString().slice(0, 10)}.`,
    "Be strictly factual. Never invent facts, dates or names. If you are not sure of an answer, say so in `explain`.",
    "File every question under exactly one subject and chapter from this list (category = subject, sub = chapter):",
    tree(),
    `Anything about recent events (roughly the last few years: appointments, schemes, summits, awards, sports results,`,
    `reports, launches) goes under "${CA}" with \`year\` = the year of the event; otherwise \`year\` = 0.`,
    "Wrong options must be believable and of the same type as the answer (a year for a year, a city for a city), and",
    "clearly wrong. `trick` is a short memory aid: a mnemonic, acronym, rhyme, story or link to something familiar.",
  ].join("\n");
}

const str = (description) => ({ type: "string", description });

/** Step 1: questions as they appear in the material (facts are turned into questions). */
export const GK_LIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["q", "a", "options"],
        properties: {
          q: str("The question, written correctly."),
          a: str("The answer given in the material, or empty string if none is given."),
          options: { type: "array", items: { type: "string" }, description: "Other options given in the material, if any." },
        },
      },
    },
  },
};

/** Step 2: complete cards. */
export const GK_CARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["q", "a", "options", "explain", "trick", "category", "sub", "year", "month", "difficulty", "aiAnswered"],
        properties: {
          q: str("The question, clear and exam-style."),
          a: str("The correct answer, short."),
          options: { type: "array", items: { type: "string" }, description: "Exactly 3 believable WRONG options." },
          explain: str("1–2 lines of key facts around the answer."),
          trick: str("A memory trick for the answer."),
          category: str("Subject from the list, or Current Affairs."),
          sub: str("Chapter from the list (for Current Affairs: the topic)."),
          year: { type: "integer", description: "For Current Affairs: year of the event. Otherwise 0." },
          month: { type: "integer", description: "For Current Affairs: month 1–12 if known, else 0." },
          difficulty: { type: "integer", description: "1 (easy) to 5 (hard)." },
          aiAnswered: { type: "boolean", description: "true if the material gave no answer (or a wrong one) and you supplied it." },
        },
      },
    },
  },
};

export const listGkInstruction = () =>
  "Read all the material above (a book page, a question paper, a screenshot, current-affairs notes or a PDF). List EVERY " +
  "question in it, in order, with its answer and options if given — do not skip or merge any. If the material is notes or " +
  "news rather than questions, turn each important fact into one clear exam-style question with its answer.";

export const cardInstruction = (items) =>
  `Complete a card for EACH of these ${items.length} questions, in the same order — exactly ${items.length} card(s). Keep the ` +
  "question's meaning. If an answer is given, keep it unless it is wrong (then correct it and set aiAnswered = true). If no " +
  "answer is given, supply the correct one and set aiAnswered = true.\n\n" +
  items
    .map(
      (it, i) =>
        `${i + 1}. Q: ${String(it.q).slice(0, 500)}${it.a ? ` | Given answer: ${it.a}` : " | No answer given"}${
          it.options?.length ? ` | Given options: ${it.options.slice(0, 5).join(" / ")}` : ""
        }`,
    )
    .join("\n");

const related = (item, card) =>
  questionSimilarity(item.q, card.q) >= 0.25 || (item.a && answerKey(item.a) === answerKey(card.a));

/** Cards for `items`, GK_BATCH at a time; one retry for any the AI leaves out; the rest kept as typed. */
async function completeCards(s, items, onProgress, info) {
  const system = gkSystem(s);
  const out = [];
  const ask = async (batch) => {
    const res = await aiTask(s, { system, schema: GK_CARD_SCHEMA, text: cardInstruction(batch) }, null);
    info.usedBy.add(res.provider);
    const note = fallbackNote(res.skipped, res.provider);
    if (note) info.notes.add(note);
    const cards = res.words.filter((c) => c && typeof c === "object" && c.q);
    const pairs = [];
    const missing = [];
    if (cards.length === batch.length) {
      batch.forEach((it, i) => (related(it, cards[i]) ? pairs.push([it, cards[i]]) : missing.push(it)));
    } else {
      const left = [...cards];
      for (const it of batch) {
        const j = left.findIndex((c) => related(it, c));
        if (j >= 0) pairs.push([it, left.splice(j, 1)[0]]);
        else missing.push(it);
      }
    }
    return { pairs, missing };
  };
  for (let i = 0; i < items.length; i += GK_BATCH) {
    const batch = items.slice(i, i + GK_BATCH);
    onProgress?.(`Writing question cards ${i + 1}–${i + batch.length} of ${items.length}…`);
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
      for (const [it, card] of pairs) out.push({ ...card, aiAnswered: Boolean(card.aiAnswered || (!it.a && card.a)), source: it.source || "" });
      for (const it of missing) {
        info.failed += 1;
        out.push({ q: it.q, a: it.a, options: it.options, source: it.source || "" });
      }
      if (missing.length) info.notes.add(`The AI left out ${missing.length} question(s); they were saved as written.`);
    } catch (e) {
      if (!(e instanceof AllProvidersFailed)) throw e;
      info.notes.add(`${e.message} → saved as written`);
      for (const it of batch) {
        info.failed += 1;
        out.push({ q: it.q, a: it.a, options: it.options, source: it.source || "" });
      }
    }
  }
  return out.map((x) => makeItem(x));
}

const result = (items, info) => ({ items, notes: [...info.notes], usedBy: [...info.usedBy], failed: info.failed });

/** Questions from photos/PDFs. Throws AllProvidersFailed if no AI could read them (caller falls back to OCR). */
export async function gkFromFiles(s, sources, source, onProgress) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  onProgress?.("Reading the questions…");
  const listed = await aiTask(s, { system: gkSystem(s), schema: GK_LIST_SCHEMA, sources, text: listGkInstruction() }, onProgress);
  info.usedBy.add(listed.provider);
  const note = fallbackNote(listed.skipped, listed.provider);
  if (note) info.notes.add(note);
  const items = listed.words.filter((x) => x && x.q).map((x) => ({ q: String(x.q), a: String(x.a || ""), options: x.options || [], source }));
  if (!items.length) throw new AllProvidersFailed([{ name: listed.provider, reason: "found no questions" }]);
  return result(await completeCards(s, items, onProgress, info), info);
}

/** Questions from typed notes: read locally when the format is clear, otherwise let the AI find them. */
export async function gkFromText(s, text, onProgress) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  let items = textToItems(text).map((x) => ({ ...x, source: "Typed" }));
  // Notes or facts without answers: let the AI turn each fact into a question first.
  const onlyFacts = items.every((i) => !i.a);
  if (!items.length || onlyFacts) {
    onProgress?.("Finding the questions in your notes…");
    const listed = await aiTask(
      s,
      { system: gkSystem(s), schema: GK_LIST_SCHEMA, sources: [{ kind: "text", name: "notes", text }], text: listGkInstruction() },
      onProgress,
    );
    info.usedBy.add(listed.provider);
    items = listed.words.filter((x) => x && x.q).map((x) => ({ q: String(x.q), a: String(x.a || ""), options: x.options || [], source: "Typed" }));
    if (!items.length) throw new AllProvidersFailed([{ name: listed.provider, reason: "found no questions" }]);
  }
  return result(await completeCards(s, items, onProgress, info), info);
}

/** Complete (or refresh) one saved question with AI. Resolves {card, provider} or null. */
export async function completeItem(s, item) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  const [card] = await completeCards(s, [{ q: item.q, a: item.a, options: item.options }], null, info);
  return info.failed ? null : { card, provider: [...info.usedBy][0] };
}
