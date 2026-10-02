import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as g from "../src/lib/grammar-store.js";
import * as vocab from "../src/lib/store.js";
import { loadRuleBook } from "../src/lib/rulebook.js";

beforeAll(() => loadRuleBook());
beforeEach(() => g.resetAll());

const sample = [
  { title: "Since and for", topic: "Prepositions", rule: "Since with a point of time; for with a period of time.", examples: ["I have lived here since 2015."] },
  { title: "Lest takes should", topic: "Conjunctions", rule: "'Lest' is followed by 'should', never by 'not'." },
];

describe("grammar store", () => {
  it("adds rules and skips ones already saved, even when worded a little differently", () => {
    expect(g.addRules(sample).added).toHaveLength(2);
    const again = g.addRules([{ title: "since AND for!", rule: "x" }, { title: "Lest + should", rule: "'Lest' is followed by 'should', not by 'not'." }]);
    expect(again.added).toHaveLength(0);
    expect(again.skipped).toHaveLength(2);
    expect(g.liveRules()).toHaveLength(2);
  });

  it("restoring the same backup twice never duplicates, and counts what changed", () => {
    g.addRules(sample);
    const backup = JSON.parse(JSON.stringify(g.exportData()));
    g.resetAll();
    const first = g.importData(backup);
    expect(first).toMatchObject({ inBackup: 2, added: 2, updated: 0 });
    const second = g.importData(backup);
    expect(second).toMatchObject({ inBackup: 2, added: 0, updated: 0 });
    expect(g.liveRules()).toHaveLength(2);
  });

  it("refuses a vocabulary backup, and the vocabulary side refuses a grammar backup", () => {
    expect(() => g.importData({ app: "VocabVault", words: [] })).toThrow(/vocabulary backup/);
    expect(() => vocab.importData(g.exportData())).toThrow(/grammar backup/);
    expect(() => g.importData({ hello: 1 })).toThrow(/doesn't look like/);
  });

  it("keeps grammar data apart from vocabulary data", () => {
    vocab.resetAll();
    g.addRules(sample);
    expect(vocab.liveWords()).toHaveLength(0);
    expect(JSON.stringify(vocab.exportData())).not.toContain("Since and for");
    expect(g.exportData()).toMatchObject({ app: "VocabVault-Grammar" });
    expect(g.exportData()).not.toHaveProperty("words");
  });

  it("offers the Rule Book from day one, and a learner's version replaces the book's in Mixed", () => {
    expect(g.rulesFor("book").length).toBeGreaterThanOrEqual(100);
    const mixedBefore = g.rulesFor("mixed").length;
    const book = g.rulesFor("book").find((r) => r.title === "'Since' and 'for'");
    g.addBookRuleToMine(book.id);
    expect(g.rulesFor("mixed").length).toBe(mixedBefore); // replaced, not added twice
    expect(g.rulesFor("mine")[0]).toMatchObject({ bookId: book.id, title: "'Since' and 'for'" });
    expect(g.addBookRuleToMine(book.id)).toBeNull(); // already copied
  });

  it("stores only progress for Rule Book rules", () => {
    const id = g.rulesFor("book")[0].id;
    g.updateRule(id, (r) => ({ ...r, box: 3, reviews: 2, starred: true, title: "changed" }));
    expect(g.byId(id)).toMatchObject({ box: 3, reviews: 2, starred: true });
    expect(g.byId(id).title).not.toBe("changed");
  });

  it("builds a daily plan with a Rule of the Day and N rules to revise", () => {
    g.update((s) => (s.prefs.dailyCount = 5));
    const plan = g.todaysPlan();
    expect(plan.wotd).toBeTruthy();
    expect(plan.ids).toHaveLength(5);
    expect(plan.ids).not.toContain(plan.wotd);
    expect(g.todaysPlan().wotd).toBe(plan.wotd); // stable through the day
  });

  it("filters the Rule Book by level for Today and Practice, but keeps own rules and the whole book browsable", () => {
    g.addRules([{ title: "My own basic rule", rule: "Something simple to remember here." }]);
    const all = g.rulesFor("book").length;
    g.update((s) => (s.prefs.bookLevel = "advanced"));
    const adv = g.rulesFor("book");
    expect(adv.length).toBeGreaterThanOrEqual(55);
    expect(adv.length).toBeLessThan(all);
    expect(adv.every((r) => r.difficulty >= 4)).toBe(true);
    expect(g.rulesFor("mixed").some((r) => r.title === "My own basic rule")).toBe(true);
    expect(g.bookRules().length).toBe(all);
    const plan = g.todaysPlan();
    expect([plan.wotd, ...plan.ids].map(g.byId).filter((r) => r.book).every((r) => r.difficulty >= 4)).toBe(true);
    g.update((s) => (s.prefs.bookLevel = "basic"));
    expect(g.rulesFor("book").every((r) => r.difficulty < 4)).toBe(true);
    expect(g.todaysPlan().level).toBe("basic"); // the plan rebuilds when the level changes
  });

  it("restores preferences from a backup file only when asked", () => {
    g.update((s) => (s.prefs.dailyCount = 9));
    const backup = JSON.parse(JSON.stringify(g.exportData()));
    g.resetAll();
    g.importData(backup);
    expect(g.get().prefs.dailyCount).toBe(5);
    g.importData(backup, { applyPrefs: true });
    expect(g.get().prefs.dailyCount).toBe(9);
  });
});
