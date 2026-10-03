import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as q from "../src/lib/quant-store.js";
import * as gk from "../src/lib/gk-store.js";
import * as grammar from "../src/lib/grammar-store.js";
import * as vocab from "../src/lib/store.js";
import { loadQBook } from "../src/lib/qbook.js";
import { buildQuantTopicPrompt, readQuant } from "../src/lib/quant-prompt.js";
import { makeQuantQuestion } from "../src/lib/quant-quiz.js";
import { qPatternKey, qTopicKey } from "../src/lib/quant-taxonomy.js";
import { coverage, pickSession, recordAnswer } from "../src/lib/practice.js";

beforeAll(() => loadQBook());
beforeEach(() => q.resetAll());

const pasted = () => {
  const p = buildQuantTopicPrompt({ topic: "Time and Work" });
  return readQuant(p.slice(p.indexOf("## Quant › Time & Work"))).items;
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
    expect(q.bookItems().length).toBeGreaterThanOrEqual(70);
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
  });

  it("keeps its backup apart from the other parts, and restoring twice adds nothing", () => {
    q.addItems(pasted());
    const data = q.exportData();
    expect(q.backupKind(data)).toBe("quant");
    expect(() => gk.importData(data)).toThrow(/Maths & Reasoning backup/);
    expect(() => grammar.importData(data)).toThrow(/Maths & Reasoning backup/);
    expect(() => vocab.importData(data)).toThrow(/Maths & Reasoning backup/);
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
