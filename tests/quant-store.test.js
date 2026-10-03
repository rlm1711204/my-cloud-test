import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { maths as q, reasoning } from "../src/lib/quant-stores.js";
import { backupKind } from "../src/lib/quant-store.js";
import * as gk from "../src/lib/gk-store.js";
import * as grammar from "../src/lib/grammar-store.js";
import * as vocab from "../src/lib/store.js";
import { loadQBook } from "../src/lib/qbook.js";
import { buildFigurePrompt, buildQuantTopicPrompt, readQuant } from "../src/lib/quant-prompt.js";
import { makeQuantQuestion } from "../src/lib/quant-quiz.js";
import { qPatternKey, qTopicKey } from "../src/lib/quant-taxonomy.js";
import { coverage, pickSession, recordAnswer } from "../src/lib/practice.js";

beforeAll(() => loadQBook());
beforeEach(() => (q.resetAll(), reasoning.resetAll()));

const pasted = () => {
  const p = buildQuantTopicPrompt({ topic: "Time and Work" });
  return readQuant(p.slice(p.indexOf("## Quant › Time & Work")).split("\n\n## Quant › Geometry")[0]).items;
};

describe("Maths & Reasoning store", () => {
  it("saves a question with its 2 practice questions and a formula, and never twice", () => {
    const first = q.addItems(pasted());
    expect(first.added).toHaveLength(4);
    const [orig] = first.added;
    expect(q.variantsOf(orig.id)).toHaveLength(2);
    const again = q.addItems(pasted());
    expect(again.added).toHaveLength(0);
    expect(again.skipped).toHaveLength(4);
  });

  it("links new practice questions to a question already saved, and reuses the type name", () => {
    const [orig] = q.addItems(pasted()).added;
    const more = readQuant(`## Quant › Time & Work
TYPE: two workers together.
Q: A can finish a work in 10 days and B in 15 days. In how many days will they finish it together?
A: 6 days
PQ: A can finish a job in 20 days and B in 30 days. Together?
A: 12 days
O: 10 days; 15 days; 25 days
S: (20 × 30)/50 = 12 days.`).items;
    const r = q.addItems(more);
    expect(r.added).toHaveLength(1);
    expect(r.added[0]).toMatchObject({ variantOf: orig.id, pattern: "Two workers together" });
    expect(q.variantsOf(orig.id)).toHaveLength(3);
  });

  it("shows all questions of one type together, each followed by its practice questions; deleting a question deletes its practice questions", () => {
    const [orig, v1, v2] = q.addItems(pasted()).added;
    const list = q.itemsOfPattern(qPatternKey(orig), "mine");
    expect(list.map((i) => i.id).slice(0, 3)).toEqual([orig.id, v1.id, v2.id]);
    expect(q.deleteItem(orig.id)).toBe(3);
    expect(q.liveItems().filter((i) => i.kind === "question")).toHaveLength(0);
  });

  it("has the Formula Book, and Today's plan spreads over topics", () => {
    expect(q.bookItems().length).toBeGreaterThanOrEqual(45);
    expect(q.bookItems().every((b) => b.subject === "Quant")).toBe(true);
    expect(reasoning.bookItems().length).toBeGreaterThanOrEqual(15);
    expect(reasoning.bookItems().every((b) => b.subject === "Reasoning")).toBe(true);
    q.update((s) => (s.prefs.dailySource = "book"), { touchesData: false });
    const plan = q.todaysPlan();
    expect(plan.ids).toHaveLength(10);
    expect(new Set(plan.ids.map((id) => qTopicKey(q.byId(id)))).size).toBeGreaterThanOrEqual(8);
  });

  it("practice covers every item before repeating and counts types in the tree", () => {
    q.addItems(pasted());
    const pool = q.itemsFor("mixed");
    let p = q.get().practice;
    const seq = [];
    for (let s = 0; s < 10; s++) for (const id of pickSession(pool, p, "mixed", 15, Math.random, (id) => qTopicKey(pool.find((x) => x.id === id))).ids) (seq.push(id), (p = recordAnswer(p, "mixed", id, true)));
    expect(new Set(seq.slice(0, pool.length)).size).toBe(pool.length);
    expect(coverage(pool, p, "mixed").round).toBeGreaterThanOrEqual(2);
    const tree = q.qTopicTree(q.itemsFor("mine"));
    expect(tree.get("Quant › Time & Work › Two workers together")).toMatchObject({ questions: 3, formulas: 1 });
    expect(q.qBuildTree(q.itemsFor("mine")).get("Quant › Time & Work")).toEqual(["Quant › Time & Work › Two workers together"]);
    expect(q.qBuildTree(q.itemsFor("mine"), { withTypes: false }).get("Quant")).toEqual(["Quant › Time & Work"]);
  });

  it("keeps its backup apart from the other parts, and restoring twice adds nothing", () => {
    q.addItems(pasted());
    const data = q.exportData();
    expect(backupKind(data)).toBe("quant");
    expect(() => gk.importData(data)).toThrow(/Maths or Reasoning backup/);
    expect(() => grammar.importData(data)).toThrow(/Maths or Reasoning backup/);
    expect(() => vocab.importData(data)).toThrow(/Maths or Reasoning backup/);
    expect(() => reasoning.importData(data)).toThrow(/This is a Maths backup/);
    expect(() => q.importData(gk.exportData())).toThrow(/GK backup/);
    q.resetAll();
    expect(q.importData(data).added).toBe(4);
    expect(q.importData(data).added).toBe(0);
    expect(q.variantsOf(q.liveItems().find((i) => !i.variantOf && i.kind === "question").id)).toHaveLength(2);
  });
});

describe("Maths & Reasoning practice questions", () => {
  it("multiple choice, solve & check, and formula recall", () => {
    const [orig, , , formula] = q.addItems(pasted()).added;
    const pool = q.itemsFor("mixed");
    const mcq = makeQuantQuestion(orig, "mcq", pool);
    expect(mcq.kind).toBe("mcq");
    expect(mcq.options[mcq.answer]).toBe("6 days");
    expect(makeQuantQuestion(orig, "solve", pool)).toMatchObject({ kind: "solve", reveal: "6 days", selfGraded: true });
    expect(makeQuantQuestion(formula, "formula", pool)).toMatchObject({ kind: "recall", reveal: "Together time = (a × b)/(a + b)" });
    const book = q.bookItems();
    const short = book.find((b) => b.q === "HCF × LCM");
    const fm = makeQuantQuestion(short, "mixed", book, () => 0.1);
    expect(fm.kind).toBe("mcq");
    expect(fm.options[fm.answer]).toBe(short.formula);
  });
});

describe("Maths and Reasoning are separate parts", () => {
  const syllogism = () =>
    readQuant(`## Reasoning › Syllogism
TYPE: Either-or conclusions
Q: Some pens are books. No book is a copy. I. Some pens are copies. II. No pen is a copy.
A: Either I or II follows
O: Only I; Only II; Neither
S: Complementary pair.
PQ: Some cars are buses. No bus is a train. I. Some cars are trains. II. No car is a train.
A: Either I or II follows
O: Only I; Only II; Both
S: Same pattern.`).items;

  it("a reasoning question added in Maths goes to Reasoning, with its practice question still linked", () => {
    const r = q.addItems([...pasted(), ...syllogism()]);
    expect(r.added).toHaveLength(4);
    expect(r.moved).toHaveLength(2);
    expect(q.liveItems().every((i) => i.subject === "Quant")).toBe(true);
    const [orig, practice] = reasoning.liveItems().sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
    expect(practice.variantOf).toBe(orig.id);
  });

  it("cards saved when the two were one part move to Reasoning, with their progress", () => {
    // Old combined data: a reasoning card and Formula Book progress for a reasoning card, all kept by Maths.
    const reasonCard = reasoning.bookItems()[0];
    q.update((s) => {
      s.items.push(...syllogism().map((x) => ({ ...x, subject: "Reasoning", topic: "Syllogism", addedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", box: 0, reviews: 0, lapses: 0, due: "2026-10-01", options: x.options, deleted: false })));
      s.bank[reasonCard.id] = { box: 3, due: "2026-10-09", reviews: 4, lapses: 0, updatedAt: "2026-10-02T00:00:00Z" };
      s.practice.asked[s.items[0].id] = 2;
    });
    const firstId = q.get().items[0].id;
    expect(q.handOver()).toBe(2);
    expect(q.get().items).toHaveLength(0);
    expect(reasoning.liveItems()).toHaveLength(2);
    expect(reasoning.byId(reasonCard.id).box).toBe(3);
    expect(q.get().bank[reasonCard.id]).toBeUndefined();
    expect(reasoning.get().practice.asked[firstId]).toBe(2);
    expect(q.handOver()).toBe(0); // only once
  });

  it("each part has its own backup; an old combined backup restored in Maths sends reasoning cards to Reasoning", () => {
    q.addItems(pasted());
    reasoning.addItems(syllogism());
    const rData = reasoning.exportData();
    expect(backupKind(rData)).toBe("reasoning");
    expect(() => q.importData(rData)).toThrow(/This is a Reasoning backup/);
    const combined = { app: "VocabVault-Quant", items: [...q.exportData().items, ...rData.items] };
    q.resetAll();
    reasoning.resetAll();
    const r = q.importData(combined);
    expect(r).toMatchObject({ added: 4, movedToOther: 2 });
    expect(reasoning.liveItems()).toHaveLength(2);
  });
});

describe("figures on saved questions", () => {
  it("a pasted figure for a saved question is added to it (via the figure prompt)", () => {
    const [orig] = q.addItems(pasted()).added;
    expect(orig.figure).toBe("");
    const prompt = buildFigurePrompt(orig);
    const answer = prompt.slice(prompt.indexOf("## Quant")).split("\n\nDrawing rules")[0].replace(/FIG: <svg[^\n]*/, 'FIG: <svg viewBox="0 0 100 60"><line x1="0" y1="0" x2="100" y2="60" stroke="black"/><text x="5" y="10">A</text></svg>');
    const r = q.addItems(readQuant(answer).items);
    expect(r.added).toHaveLength(0);
    expect(r.filled).toHaveLength(1);
    expect(q.byId(orig.id).figure).toMatch(/<line x1="0" y1="0" x2="100" y2="60" stroke="currentColor"\/>/);
  });
});
