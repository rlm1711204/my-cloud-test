import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as gk from "../src/lib/gk-store.js";
import * as vocab from "../src/lib/store.js";
import * as grammar from "../src/lib/grammar-store.js";
import { loadBank } from "../src/lib/gkbank.js";
import { pickSession, recordAnswer } from "../src/lib/practice.js";
import { topicKey, CA } from "../src/lib/gk-taxonomy.js";
import { cloze } from "../src/lib/gk-quiz.js";

beforeAll(() => loadBank());
beforeEach(() => gk.resetAll());

describe("GK store", () => {
  it("adds questions, skips repeats, and files current affairs by year", () => {
    const r = gk.addItems([
      { q: "Who was appointed the new chairman of SEBI in March 2026?", a: "X", category: CA, sub: "Appointments", year: 2026 },
      { q: "Capital of Australia?", a: "Canberra" },
      { q: "What is the capital of Australia?", a: "canberra" },
    ]);
    expect(r.added).toHaveLength(2);
    expect(r.skipped).toHaveLength(1);
    expect(topicKey(gk.liveItems().find((i) => i.year === 2026))).toBe("Current Affairs › 2026 › Appointments");
    expect(gk.caYears(gk.liveItems())).toEqual([2026]);
  });

  it("leaves out unticked topics, subjects or whole Current Affairs years from practice", () => {
    gk.addItems([
      { q: "CA 2025 question about cricket world cup winner", a: "A", category: CA, sub: "Sports", year: 2025 },
      { q: "CA 2026 question about RBI rate", a: "B", category: CA, sub: "Banking & Finance", year: 2026 },
    ]);
    const all = gk.itemsFor("mixed", { forPractice: true }).length;
    gk.update((s) => (s.prefs.excluded = ["Polity", "Current Affairs › 2025"]));
    const left = gk.itemsFor("mixed", { forPractice: true });
    expect(left.some((i) => i.category === "Polity")).toBe(false);
    expect(left.some((i) => i.category === CA && i.year === 2025)).toBe(false);
    expect(left.some((i) => i.category === CA && i.year === 2026)).toBe(true);
    expect(left.length).toBeLessThan(all);
    // Today ignores the filter unless asked.
    expect(gk.itemsFor("mixed", { forToday: true }).some((i) => i.category === "Polity")).toBe(true);
  });

  it("spreads Today's questions across many topics instead of one chapter", () => {
    gk.update((s) => (s.prefs.dailyCount = 10));
    const plan = gk.todaysPlan();
    const topics = new Set(plan.ids.map((id) => topicKey(gk.byId(id))));
    expect(plan.ids).toHaveLength(10);
    expect(topics.size).toBeGreaterThanOrEqual(8);
  });

  it("practice sessions mix topics, and rounds cover EVERY question before any repeats", () => {
    const pool = gk.itemsFor("bank", { forPractice: true });
    let practice = gk.get().practice;
    const asked = new Set();
    let firstSessionTopics = null;
    let rounds = 0;
    for (let s = 0; s < 40 && asked.size < pool.length; s++) {
      const { ids, roundOf, practice: p } = pickSession(pool, practice, "bank", 20, Math.random, (id) => topicKey(pool.find((x) => x.id === id)));
      firstSessionTopics ??= new Set(ids.map((id) => topicKey(pool.find((x) => x.id === id))));
      practice = p;
      for (const id of ids) {
        if (roundOf[id] === 1) {
          expect(asked.has(id)).toBe(false); // no repeats within the first round
          asked.add(id);
        }
        practice = recordAnswer(practice, "bank", id, true, { round: roundOf[id] });
      }
      rounds = practice.rounds.bank.round;
    }
    expect(asked.size).toBe(pool.length); // every question asked once in round 1
    expect(rounds).toBeLessThanOrEqual(2); // the last session may start round 2
    expect(firstSessionTopics.size).toBeGreaterThanOrEqual(15); // 20 questions from 15+ different chapters
  });

  it("keeps GK backups apart from vocabulary and grammar backups", () => {
    gk.addItems([{ q: "Capital of Japan?", a: "Tokyo" }]);
    const backup = JSON.parse(JSON.stringify(gk.exportData()));
    expect(() => vocab.importData(backup)).toThrow(/GK backup/);
    expect(() => grammar.importData(backup)).toThrow(/GK backup/);
    expect(() => gk.importData({ app: "VocabVault", words: [] })).toThrow(/vocabulary backup/);
    expect(() => gk.importData({ app: "VocabVault-Grammar", rules: [] })).toThrow(/grammar backup/);
    gk.resetAll();
    expect(gk.importData(backup)).toMatchObject({ added: 1 });
    expect(gk.importData(backup)).toMatchObject({ added: 0, updated: 0 });
    expect(gk.liveItems()).toHaveLength(1);
  });

  it("stores only progress for Question Bank questions, and builds a topic tree with counts", () => {
    const id = gk.bankItems()[0].id;
    gk.updateItem(id, (i) => ({ ...i, box: 5, reviews: 3, q: "changed" }));
    expect(gk.byId(id)).toMatchObject({ box: 5, reviews: 3 });
    expect(gk.byId(id).q).not.toBe("changed");
    const tree = gk.topicTree(gk.bankItems());
    const polity = tree.get("Polity");
    expect(polity.total).toBeGreaterThan(20);
    expect(polity.mastered).toBe(gk.byId(id).category === "Polity" ? 1 : 0);
  });

  it("turns a fact into a fill-the-gap card", () => {
    expect(cloze("The Reserve Bank of India was established in 1935.")).toEqual({ prompt: "The Reserve Bank of India was established in _____.", answer: "1935" });
    expect(cloze("Kaziranga National Park is in Assam.").answer).toBe("Assam");
  });
});
