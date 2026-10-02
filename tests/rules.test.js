import { describe, expect, it } from "vitest";
import { SAME_RULE, borrowFromBook, cleanQuestion, findSimilarRule, makeRule, mergeRuleLists, rulesToCSV, textToRules } from "../src/lib/rules.js";
import { parseRuleBook } from "../src/lib/rulebook.js";
import r1 from "../src/data/rules1.js";
import r2 from "../src/data/rules2.js";
import r3 from "../src/data/rules3.js";

const book = parseRuleBook([r1, r2, r3].join("\n")).rules.map((r) => makeRule(r));

describe("textToRules (no AI)", () => {
  it("splits notes on blank lines and picks up headings, examples and wrong => right lines", () => {
    const text = `Since and for
Use since with a point of time and for with a period of time.
e.g. I have lived here since 2015.
I am here since two days => I have been here for two days

No sooner ... than
'No sooner' is always followed by 'than', not 'when'.`;
    const rules = textToRules(text);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({ title: "Since and for", examples: ["I have lived here since 2015."] });
    expect(rules[0].mistakes[0]).toMatchObject({ wrong: "I am here since two days", right: "I have been here for two days" });
    expect(rules[1].rule).toMatch(/followed by 'than'/);
  });

  it("splits a numbered list when there are no blank lines", () => {
    const rules = textToRules("1. Each and every take a singular verb.\n2. Use 'an' before a vowel sound.\n3. Superior takes 'to', not 'than'.");
    expect(rules.map((r) => r.title)).toEqual(["Each and every take a singular verb", "Use 'an' before a vowel sound", "Superior takes 'to', not 'than'"]);
  });

  it("ignores empty input", () => {
    expect(textToRules("   ")).toEqual([]);
  });
});

describe("matching rules", () => {
  it("finds the Rule Book rule a typed rule is about, and borrows its examples and questions", () => {
    const typed = makeRule({ title: "Since vs for", rule: "Use since with point of time and for with period of time." });
    const m = findSimilarRule(typed, book);
    expect(m.rule.title).toBe("'Since' and 'for'");
    const enriched = borrowFromBook(typed, book);
    expect(enriched.questions.length).toBeGreaterThan(0);
    expect(enriched.topic).toBe("Prepositions");
    expect(enriched.bookId).toBe(m.rule.id);
  });

  it("does not borrow from an unrelated rule", () => {
    const typed = makeRule({ title: "Capital letters for proper nouns", rule: "Names of people, cities and months start with a capital letter." });
    expect(borrowFromBook(typed, book).bookId).toBe("");
  });

  it("treats near-identical rules as the same, different ones as different", () => {
    const a = makeRule({ title: "Each takes singular verb", rule: "Each, every, either and neither take a singular verb." });
    const b = makeRule({ title: "Every/each with singular verb", rule: "Each and every, either, neither: singular verb always." });
    const c = makeRule({ title: "Articles before vowels", rule: "Use an before a vowel sound." });
    expect(findSimilarRule(a, [b]).score).toBeGreaterThanOrEqual(SAME_RULE);
    expect(findSimilarRule(a, [c])?.score ?? 0).toBeLessThan(SAME_RULE);
  });
});

describe("rule records", () => {
  it("drops broken questions and mistakes from AI output", () => {
    const r = makeRule({
      title: "x",
      questions: [
        { q: "He ___ here.", options: ["is", "are", "is"], answer: 0 },
        { q: "No options", options: [], answer: 0 },
        { q: "Bad answer", options: ["a", "b"], answer: 5 },
      ],
      mistakes: [{ wrong: "a", right: "a" }, { wrong: "He go.", right: "He goes." }],
    });
    expect(r.questions).toEqual([{ q: "He ___ here.", options: ["is", "are"], answer: 0, why: "" }]);
    expect(r.mistakes).toHaveLength(1);
    expect(cleanQuestion({ q: "x", options: ["a", "b"], answer: "1" })).toMatchObject({ answer: 1 });
  });

  it("merges by id with the newest copy winning, and exports CSV", () => {
    const a = makeRule({ id: "1", title: "Old", updatedAt: "2026-01-01" });
    const b = makeRule({ id: "1", title: "New", updatedAt: "2026-02-01" });
    expect(mergeRuleLists([a], [b])[0].title).toBe("New");
    expect(rulesToCSV([b]).split("\n")[1]).toContain("New");
  });
});
