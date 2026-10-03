// GK questions with AI: read questions (or facts) out of photos, PDFs or typed notes, then complete each one:
// correct subject/chapter (or Current Affairs year/topic), three believable wrong options, a short
// explanation and a memory trick. Same engine as vocabulary and grammar (Gemini → other services → Claude).
import { EXAMS } from "./ai.js";
import { AllProvidersFailed, aiTask, fallbackNote } from "./engine.js";
import { CA, CA_TOPICS, TAXONOMY } from "./gk-taxonomy.js";
import { findDuplicate, makeItem, questionSimilarity, answerKey, textToItems } from "./gk.js";
import { autoCount, isComplete, isTopicLike, looksStructured, readPasted, topicRange } from "./gk-prompt.js";

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
  "news rather than questions, turn it into exam-style questions with answers: one question for EVERY separate fact in it " +
  "(each name, date, place, number, office, scheme or first is its own question), so nothing in the notes is left out.";

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

/**
 * Questions from typed text:
 *  - the copied prompt's format (or any Q:/A: list) is read directly; only incomplete questions go to the AI;
 *  - a topic or one short fact ("Articles 124 to 147", "Harappan civilisation") gets a full set of questions;
 *  - questions in other formats are read locally, notes are turned into questions by the AI.
 */
export async function gkFromText(s, text, onProgress) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  if (looksStructured(text)) {
    const read = readPasted(text).map((x) => ({ ...x, source: "Pasted" }));
    const ready = read.filter(isComplete);
    const todo = read.filter((x) => !isComplete(x));
    const done = todo.length ? await completeCards(s, todo, onProgress, info) : [];
    if (!todo.length) info.notes.add(`${read.length} question(s) read from the pasted answer — no AI needed.`);
    return result([...ready.map((x) => makeItem(x)), ...done], info);
  }
  let items = textToItems(text).map((x) => ({ ...x, source: "Typed" }));
  if (isTopicLike(text, items)) return gkFromTopic(s, text.trim(), "auto", onProgress);
  // Notes or facts without answers: let the AI turn every fact into a question first.
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

// ---------- a full set of questions on a topic ----------
export const TOPIC_BATCH = 12;

/** Step 1 of a topic: the points to cover, with how many questions each deserves. */
export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["point", "questions"],
        properties: {
          point: str("One thing to cover, e.g. 'Article 124 — establishment and constitution of the Supreme Court'."),
          questions: { type: "integer", description: "How many questions this point deserves (1–3)." },
        },
      },
    },
  },
};

export function planInstruction(topic, target, exact = false) {
  const r = topicRange(topic);
  if (r && exact && r.size > target) {
    return (
      `Topic: "${topic}". Plan exactly ${target} exam questions that together cover the WHOLE range ${r.from}–${r.to}: ` +
      `group neighbouring items into ${target} points (e.g. "Articles 124–126") so that no item is left out, 1 question each.`
    );
  }
  return (
    `Topic: "${topic}". Plan a set of about ${target} exam questions that covers this topic COMPLETELY. List the points to ` +
    "cover, in order, and how many questions each deserves (1–3; more for the most important). " +
    (r
      ? `The topic is a range: list EVERY item from ${r.from} to ${r.to} as its own point (${r.size} points) — leave none out — ` +
        "then add 2–5 overview points (where it sits, key bodies, landmark cases or events)."
      : "Cover all of it: background, key facts, dates, persons, places, numbers, firsts, related bodies and recent developments.")
  );
}

export const topicInstruction = (topic, points, already) =>
  `Topic: "${topic}". Write exactly ${points.reduce((n, p) => n + p.questions, 0)} exam questions covering these points ` +
  "(number of questions in brackets). Each question must test a different fact. Facts only — skip anything you are not sure of; " +
  "set aiAnswered = false.\n" +
  points.map((p) => `- ${p.point} (${p.questions})`).join("\n") +
  (already.length ? `\n\nAlready written (do not repeat):\n${already.slice(-40).map((q) => `- ${q.slice(0, 120)}`).join("\n")}` : "");

/**
 * A full set of questions on a topic: plan the points (every item of a range like "Articles 124 to 147"), then write
 * the questions TOPIC_BATCH at a time. `count` is a number or "auto". Throws AllProvidersFailed if no AI answered.
 */
export async function gkFromTopic(s, topic, count, onProgress) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  const system = gkSystem(s);
  let target = count === "auto" ? autoCount(topic) : Math.max(1, Number(count) || 15);
  onProgress?.(`Planning questions on “${topic.slice(0, 60)}”…`);
  let points = [];
  try {
    const plan = await aiTask(s, { system, schema: PLAN_SCHEMA, text: planInstruction(topic, target, count !== "auto") }, null);
    info.usedBy.add(plan.provider);
    points = plan.words
      .filter((p) => p && p.point)
      .map((p) => ({ point: String(p.point).slice(0, 200), questions: Math.min(3, Math.max(1, Math.round(Number(p.questions)) || 1)) }));
  } catch (e) {
    if (!(e instanceof AllProvidersFailed)) throw e;
    if (!info.usedBy.size) throw e;
  }
  if (points.length) {
    if (count === "auto") target = Math.max(target, points.length);
    else if (points.length > target) {
      // A set number of questions: neighbouring points share a question, so none is dropped.
      const per = Math.ceil(points.length / target);
      const merged = [];
      for (let i = 0; i < points.length; i += per) merged.push({ point: points.slice(i, i + per).map((p) => p.point).join(" / ").slice(0, 300), questions: 1 });
      points = merged;
    }
    // Every point keeps at least one question; extra questions are trimmed to fit the target.
    let total = points.reduce((n, p) => n + p.questions, 0);
    const cap = Math.max(target, points.length);
    for (let i = points.length - 1; total > cap && i >= 0; i--) {
      while (points[i].questions > 1 && total > cap) (points[i].questions -= 1), (total -= 1);
    }
  } else {
    // No plan: ask for the questions in plain batches.
    for (let n = 0; n < target; n += TOPIC_BATCH) points.push({ point: `${topic} — questions ${n + 1}–${Math.min(target, n + TOPIC_BATCH)}`, questions: Math.min(TOPIC_BATCH, target - n) });
  }
  const batches = [];
  for (const p of points) {
    const last = batches.at(-1);
    if (last && last.reduce((n, x) => n + x.questions, 0) + p.questions <= TOPIC_BATCH) last.push(p);
    else batches.push([p]);
  }
  const out = [];
  const wanted = points.reduce((n, p) => n + p.questions, 0);
  let missedPoints = 0;
  for (const batch of batches) {
    onProgress?.(`Writing questions ${Math.min(out.length + 1, wanted)}–${Math.min(wanted, out.length + batch.reduce((n, p) => n + p.questions, 0))} of about ${wanted}…`);
    try {
      const res = await aiTask(s, { system, schema: GK_CARD_SCHEMA, text: topicInstruction(topic, batch, out.map((x) => x.q)) }, null);
      info.usedBy.add(res.provider);
      const note = fallbackNote(res.skipped, res.provider);
      if (note) info.notes.add(note);
      for (const c of res.words.filter((c) => c && typeof c === "object" && c.q && c.a)) {
        const it = makeItem({ ...c, aiAnswered: false, source: `AI · ${topic.slice(0, 80)}` });
        if (!findDuplicate(it, out)) out.push(it);
      }
    } catch (e) {
      if (!(e instanceof AllProvidersFailed)) throw e;
      missedPoints += batch.length;
      info.notes.add(`${e.message}`);
    }
  }
  if (!out.length) throw new AllProvidersFailed([{ name: [...info.usedBy][0] || "AI", reason: "wrote no questions on this topic" }]);
  info.notes.add(`${out.length} questions on “${topic.slice(0, 60)}”${points.length > 1 ? ` covering ${points.length - missedPoints} of ${points.length} points` : ""}. Written by AI — check anything that looks off.`);
  if (missedPoints) info.notes.add(`${missedPoints} point(s) were not covered (AI limit) — try the same topic again later; questions you already have are skipped.`);
  return result(out, info);
}

/** Complete (or refresh) one saved question with AI. Resolves {card, provider} or null. */
export async function completeItem(s, item) {
  const info = { usedBy: new Set(), notes: new Set(), failed: 0 };
  const [card] = await completeCards(s, [{ q: item.q, a: item.a, options: item.options }], null, info);
  return info.failed ? null : { card, provider: [...info.usedBy][0] };
}
