import { describe, expect, it } from "vitest";
import { autoCount, buildGkPrompt, isComplete, isTopicLike, looksStructured, parseStructured, readHeading, readPasted, topicRange } from "../src/lib/gk-prompt.js";
import { makeItem, textToItems } from "../src/lib/gk.js";

describe("topics", () => {
  it("finds a numbered range and sizes Auto from it", () => {
    expect(topicRange("Articles 124 to 147 of the Constitution")).toEqual({ from: 124, to: 147, size: 24 });
    expect(topicRange("Schedules 1-12")).toEqual({ from: 1, to: 12, size: 12 });
    expect(topicRange("Amendments 42–44")).toMatchObject({ size: 3 });
    expect(topicRange("Harappan civilisation")).toBe(null);
    expect(autoCount("Articles 124 to 147")).toBe(30);
    expect(autoCount("Harappan civilisation")).toBe(15);
  });
  it("tells a topic or one sentence from questions and notes", () => {
    const t = (x) => isTopicLike(x, textToItems(x));
    expect(t("Articles 124 to 147 of Chapter IV of Part V")).toBe(true);
    expect(t("In 2026, India won the T20 World Cup.")).toBe(true);
    expect(t("Capital of Japan - Tokyo")).toBe(false);
    expect(t("a\nb\nc\nd")).toBe(false);
    expect(t("Y became RBI Governor in 2024.\nLadli Behna is an MP scheme.")).toBe(false); // two facts are notes
  });
  it("builds a prompt that asks for every item and the readable format", () => {
    const p = buildGkPrompt({ topic: "Articles 124 to 147", count: "auto", now: new Date("2026-10-03") });
    expect(p).toMatch(/EVERY item from 124 to 147 \(24 items/);
    expect(p).toMatch(/## Polity › Judiciary\nQ: .+\nA: .+\nO: .+; .+; .+\nE: .+\nT: /);
    expect(p).toMatch(/Static GK: Books & Authors/);
    expect(buildGkPrompt({ topic: "Nobel Prizes 2025", count: "20" })).toMatch(/Write 20 questions/);
  });
});

describe("reading an AI's answer", () => {
  it("reads the prompt's own format, with headings, options, explanation and trick", () => {
    const items = parseStructured(`## Polity › Judiciary
Q: Which Article establishes the Supreme Court?
A: Article 124
O: Article 32; Article 141; Article 226
E: There shall be a Supreme Court of India.
T: 1-2-4 = SC at the door.

## Current Affairs › 2025 › Awards & Honours
Q: Who won the Nobel Peace Prize 2025?
A: María Corina Machado
O: Narges Mohammadi; Ales Bialiatski; Maria Ressa
E: For her work for democratic rights in Venezuela.
T: Machado — "Much-ado" for democracy.`);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ a: "Article 124", options: ["Article 32", "Article 141", "Article 226"], category: "Polity", sub: "Judiciary", trick: "1-2-4 = SC at the door." });
    expect(items[1]).toMatchObject({ category: "Current Affairs", year: 2025, sub: "Awards & Honours" });
    expect(isComplete(items[0])).toBe(true);
    expect(makeItem(items[1])).toMatchObject({ category: "Current Affairs", year: 2025, sub: "Awards & Honours" });
  });

  it("forgives bold, numbering, other spellings, a) b) options and code fences", () => {
    const text = "```\n### **Indian Polity > Supreme Court**\n**1. Question:** Under which Article can the SC issue writs?\na) Article 32\nb) Article 226\nc) Article 21\nd) Article 19\n**Answer:** a\n**Explanation:** Right to constitutional remedies,\nthe heart and soul of the Constitution.\n**Mnemonic:** 32 teeth guard your rights.\n```";
    expect(looksStructured(text)).toBe(true);
    const [it] = parseStructured(text);
    expect(it).toMatchObject({ q: "Under which Article can the SC issue writs?", a: "Article 32", category: "Polity", sub: "", trick: "32 teeth guard your rights." });
    expect(makeItem(it).category).toBe("Polity"); // an unknown chapter name: the best chapter of the subject is chosen
    expect(it.options).toEqual(["Article 226", "Article 21", "Article 19"]);
    expect(it.explain).toBe("Right to constitutional remedies, the heart and soul of the Constitution.");
  });

  it("reads headings loosely", () => {
    expect(readHeading("Static GK › Books & Authors")).toEqual({ category: "Static GK", sub: "Books & Authors", year: 0 });
    expect(readHeading("Banking and Finance / RBI & Monetary Policy")).toMatchObject({ category: "Banking & Finance", sub: "RBI & Monetary Policy" });
    expect(readHeading("CA › 2026 › Sports")).toEqual({ category: "Current Affairs", sub: "Sports", year: 2026 });
    expect(readHeading("Questions on the Supreme Court")).toBe(null);
  });
});

describe("duplicates in a range", () => {
  it("keeps questions that differ only by a single digit", async () => {
    const { findDuplicate } = await import("../src/lib/gk.js");
    expect(findDuplicate(makeItem({ q: "What does Schedule 1 contain?", a: "States and UTs" }), [makeItem({ q: "What does Schedule 2 contain?", a: "Salaries" })])).toBe(null);
  });
});

describe("mixed pastes", () => {
  it("reads Q:/A: questions and every other format around them, and drops chat filler", () => {
    const items = readPasted(
      "Sure! Here are your questions:\n\n1. Who founded the INC?\n(a) Naoroji (b) A. O. Hume\nAns: (b)\n\nCapital of Australia - Canberra\n" +
        "Q: Which vitamin is made in skin by sunlight?\nA: Vitamin D\nIn 2026, India won the T20 World Cup.\n\nLet me know if you want more!",
    );
    expect(items.map((i) => [i.q, i.a])).toEqual([
      ["Which vitamin is made in skin by sunlight?", "Vitamin D"],
      ["Who founded the INC?", "A. O. Hume"],
      ["Capital of Australia", "Canberra"],
      ["In 2026, India won the T20 World Cup.", ""],
    ]);
  });
});
