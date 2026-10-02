import { describe, expect, it } from "vitest";
import { classify, topicKey, CA } from "../src/lib/gk-taxonomy.js";
import { findDuplicate, itemsToCSV, makeItem, textToItems } from "../src/lib/gk.js";

const NOW = new Date("2026-10-02T10:00:00Z");

describe("offline classifier", () => {
  const cases = [
    ["Which Article of the Constitution abolishes untouchability?", "Polity"],
    ["Who founded the Indian National Congress in 1885?", "History"],
    ["What is the current repo rate set by the RBI monetary policy committee?", "Banking & Finance"],
    ["Deficiency of Vitamin C causes which disease?", "Biology"],
    ["What is the SI unit of electric current?", "Physics"],
    ["What is the chemical name of baking soda?", "Chemistry"],
    ["Which river is known as the Dakshin Ganga?", "Geography"],
    ["Who wrote the book 'Discovery of India'?", "Static GK"],
    ["Where is the headquarters of UNESCO?", "Static GK"],
  ];
  for (const [q, cat] of cases) it(`puts "${q.slice(0, 40)}…" under ${cat}`, () => expect(classify(q, { now: NOW }).category).toBe(cat));

  it("recognises current affairs and files them under the year", () => {
    const c = classify("Who was appointed as the new chairman of SEBI in March 2026?", { now: NOW });
    expect(c).toMatchObject({ category: CA, year: 2026, sub: "Appointments" });
    expect(classify("Which country recently hosted the G20 summit?", { now: NOW })).toMatchObject({ category: CA, year: 2026, sub: "International" });
    // Old years are history, not current affairs.
    expect(classify("In which year did the Battle of Plassey take place? 1757", { now: NOW }).category).toBe("History");
  });

  it("builds topic keys", () => {
    expect(topicKey({ category: CA, year: 2025, sub: "Sports" })).toBe("Current Affairs › 2025 › Sports");
    expect(topicKey({ category: "Polity", sub: "Parliament" })).toBe("Polity › Parliament");
  });
});

describe("reading questions from text (no AI)", () => {
  it("reads numbered MCQs with options and 'Ans: (b)'", () => {
    const items = textToItems(`1. What is the capital of Australia?
(a) Sydney (b) Canberra (c) Melbourne (d) Perth
Ans: (b)

2. Who is known as the Missile Man of India?
a) C. V. Raman
b) A. P. J. Abdul Kalam
c) Homi Bhabha
d) Vikram Sarabhai
Answer: b`);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ q: "What is the capital of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Perth"] });
    expect(items[1].a).toBe("A. P. J. Abdul Kalam");
    expect(items[1].options).toHaveLength(3);
  });

  it("reads Q:/A: pairs, one-line 'question? answer' and 'term – answer' lists", () => {
    expect(textToItems("Q: Largest planet in the solar system?\nA: Jupiter")).toEqual([{ q: "Largest planet in the solar system?", a: "Jupiter", options: [] }]);
    const list = textToItems("Capital of Japan - Tokyo\nCurrency of Bangladesh - Taka\nWho wrote Godan? Premchand");
    expect(list.map((i) => [i.q, i.a])).toEqual([
      ["Capital of Japan", "Tokyo"],
      ["Currency of Bangladesh", "Taka"],
      ["Who wrote Godan?", "Premchand"],
    ]);
  });

  it("keeps a plain fact as a fact (no answer)", () => {
    expect(textToItems("The Reserve Bank of India was established in 1935.")).toEqual([{ q: "The Reserve Bank of India was established in 1935.", a: "", options: [] }]);
  });
});

describe("question records", () => {
  it("files AI or typed items in a valid place, fixing unknown subjects and chapters", () => {
    expect(makeItem({ q: "Which vitamin is called the sunshine vitamin?", a: "Vitamin D", category: "Science" }, NOW)).toMatchObject({ category: "Biology", sub: "Nutrition & Vitamins" });
    expect(makeItem({ q: "x", a: "y", category: "Polity", sub: "Nonsense" }, NOW).sub).not.toBe("Nonsense");
    expect(makeItem({ q: "Who won the 2026 T20 World Cup?", a: "India", category: CA, sub: "Sports" }, NOW)).toMatchObject({ category: CA, sub: "Sports", year: 2026 });
    expect(makeItem({ q: "q", a: "Delhi", options: ["Delhi", "Mumbai", "Mumbai"] }).options).toEqual(["Mumbai"]);
  });

  it("spots the same question asked a little differently", () => {
    const saved = [makeItem({ q: "What is the capital of Australia?", a: "Canberra" })];
    expect(findDuplicate(makeItem({ q: "Capital of Australia is?", a: "canberra" }), saved)).toBeTruthy();
    expect(findDuplicate(makeItem({ q: "What is the capital of Austria?", a: "Vienna" }), saved)).toBeNull();
  });

  it("exports CSV", () => {
    expect(itemsToCSV([makeItem({ q: "Q, with comma", a: "A" })]).split("\n")[1]).toContain('"Q, with comma"');
  });
});

describe("textToItems: answers end a question", () => {
  it("starts a new item after an answer, and keeps explanation and trick lines", () => {
    const items = textToItems(
      "Q: Which vitamin is made in skin by sunlight?\nA: Vitamin D\nIn 2026, India hosted a summit.\n" +
        "1. Who founded the INC?\n(a) Naoroji (b) A. O. Hume\nAns: (b)\nExplanation: Founded in 1885.\nTrick: Hume = Home",
    );
    expect(items.map((i) => [i.q, i.a])).toEqual([
      ["Which vitamin is made in skin by sunlight?", "Vitamin D"],
      ["In 2026, India hosted a summit.", ""],
      ["Who founded the INC?", "A. O. Hume"],
    ]);
    expect(items[2]).toMatchObject({ explain: "Founded in 1885.", trick: "Hume = Home", options: ["Naoroji"] });
  });
});
