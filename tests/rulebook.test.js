import { describe, expect, it } from "vitest";
import { loadRuleBook, parseRuleBook } from "../src/lib/rulebook.js";
import r1 from "../src/data/rules1.js";
import r2 from "../src/data/rules2.js";
import r3 from "../src/data/rules3.js";
import { availableKinds, makeGrammarQuestion } from "../src/lib/grammar-quiz.js";
import { TOPICS } from "../src/lib/rules.js";

const { rules, problems } = parseRuleBook([r1, r2, r3].join("\n"));

describe("built-in Rule Book", () => {
  it("parses with no problems", () => {
    expect(problems).toEqual([]);
    expect(rules.length).toBeGreaterThanOrEqual(100);
  });

  // Rules added later by hand only need an R: line; the built-in ones are held to a higher bar overall.
  it("every rule has rule text, and every mistake has a real correction", () => {
    for (const r of rules) {
      expect(r.rule.length, r.title).toBeGreaterThan(10);
      for (const m of r.mistakes) expect(m.wrong, r.title).not.toBe(m.right);
    }
  });

  it("the built-in rules are complete: a mistake with why and 2+ questions, in a known topic", () => {
    const complete = rules.filter(
      (r) => r.mistakes.length && r.mistakes.every((m) => m.why) && r.questions.length >= 2 && TOPICS.includes(r.topic),
    );
    expect(complete.length).toBeGreaterThanOrEqual(105);
  });

  it("every question has one right answer among unique options", () => {
    for (const r of rules)
      for (const q of r.questions) {
        expect(q.answer, q.q).toBeGreaterThanOrEqual(0);
        expect(new Set(q.options).size, q.q).toBe(q.options.length);
        expect(q.options.length, q.q).toBeGreaterThanOrEqual(2);
      }
  });

  it("has unique ids", () => {
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });

  it("loads lazily and gives the same rules", async () => {
    const loaded = await loadRuleBook();
    expect(loaded.map((r) => r.id)).toEqual(rules.map((r) => r.id));
  });

  it("can make every kind of question it supports for every rule", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pool = rules.map((r) => ({ ...r, examples: r.examples }));
    for (const r of pool) {
      for (const kind of availableKinds(r, pool)) {
        const q = makeGrammarQuestion(r, kind, pool, rand);
        expect(q.kind, `${r.title} ${kind}`).toBe(kind);
        expect(q.options.length, `${r.title} ${kind}`).toBeGreaterThanOrEqual(2);
        expect(new Set(q.options).size, `${r.title} ${kind}`).toBe(q.options.length);
        expect(q.answer, `${r.title} ${kind}`).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(q.prompt, `${r.title} ${kind}`).toBeTruthy();
      }
    }
  });

  it("reports malformed text clearly", () => {
    const bad = parseRuleBook("## T\n# One\nR: x is y.\nQ: a ___ | b; c\nX: no arrow here\n# One\nR: again");
    expect(bad.problems.join("\n")).toMatch(/exactly one \*answer/);
    expect(bad.problems.join("\n")).toMatch(/wrong => right/);
    expect(bad.problems.join("\n")).toMatch(/duplicate rule/);
  });
});
