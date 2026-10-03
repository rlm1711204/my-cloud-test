import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let reply = async () => ({ words: [], provider: "Gemini", skipped: [] });
vi.mock("../src/lib/engine.js", async (orig) => ({ ...(await orig()), aiTask: (s, task) => (calls.push(task), reply(task)) }));

const { quantFromFiles, quantFromText, quantFromTopic, practiceFor, readPastedQ, figureFor } = await import("../src/lib/quant-ai.js");
const { buildQuantTopicPrompt } = await import("../src/lib/quant-prompt.js");
const { makeQItem } = await import("../src/lib/quant.js");
const S = { exam: "ssc" };
const OPTS = { variants: true, patterns: {} };
const schemaOf = (task) => Object.keys(task.schema.properties.items.items.properties);
const isList = (t) => schemaOf(t).length === 4 && schemaOf(t).includes("options");
const isPlan = (t) => schemaOf(t).includes("name");
const card = (q, a, extra = {}) => ({
  kind: "question", q, a, options: ["W1", "W2", "W3"], solution: "Step 1\nStep 2", formula: "F", trick: "T", subject: "Quant", topic: "Time & Work",
  pattern: "Two workers together", difficulty: 2, aiAnswered: false,
  similar: [{ q: `${q} (practice 1)`, a: "P1", options: ["x", "y", "z"], solution: "s1" }, { q: `${q} (practice 2)`, a: "P2", options: ["x", "y", "z"], solution: "s2" }],
  ...extra,
});

beforeEach(() => (calls.length = 0));

describe("Maths & Reasoning AI", () => {
  it("reads a handwritten PDF: lists questions and formulas, then solves each with 2 practice questions", async () => {
    reply = async (task) =>
      isList(task)
        ? { words: [{ kind: "question", q: "A does a work in 10 days, B in 15. Together?", a: "", options: [] }, { kind: "formula", q: "Two workers", a: "ab/(a+b)", options: [] }], provider: "Gemini", skipped: [] }
        : { words: [card("A does a work in 10 days, B in 15. Together?", "6 days", { aiAnswered: true }), { ...card("Two workers", ""), kind: "formula", formula: "ab/(a+b)", similar: [] }], provider: "Gemini", skipped: [] };
    const r = await quantFromFiles(S, [{ kind: "pdf", name: "notes.pdf", mediaType: "application/pdf", data: "x" }], "notes.pdf", OPTS);
    expect(calls.map(isList)).toEqual([true, false]);
    expect(calls[0].text).toMatch(/handwritten/);
    const [qn, p1, p2, f] = r.items;
    expect(qn).toMatchObject({ kind: "question", a: "6 days", aiAnswered: true, pattern: "Two workers together" });
    expect([p1.variantOf, p2.variantOf]).toEqual([qn.id, qn.id]);
    expect(p1).toMatchObject({ aiMade: true, pattern: "Two workers together", topic: "Time & Work" });
    expect(f).toMatchObject({ kind: "formula", formula: "ab/(a+b)" });
  });

  it("reads a pasted answer with no AI call, and only completes what is missing", async () => {
    const p = buildQuantTopicPrompt({ topic: "Time and Work" });
    const r = await quantFromText(S, p.slice(p.indexOf("## Quant")).split("\n\n## Quant › Geometry")[0], OPTS);
    expect(calls).toHaveLength(0);
    expect(r.items).toHaveLength(4);
    expect(r.items[1].variantOf).toBe(r.items[0].id);

    reply = async () => ({ words: [card("Q: 20% of 50?", "10", { topic: "Percentage", pattern: "Percentage of a number" })], provider: "Gemini", skipped: [] });
    const r2 = await quantFromText(S, "Q: 20% of 50?\nA: 10", OPTS);
    expect(calls).toHaveLength(1);
    expect(r2.items).toHaveLength(3); // the question + 2 practice questions
  });

  it("a topic gets formula cards and questions for every common type", async () => {
    reply = async (task) => {
      if (isPlan(task))
        return { words: [{ kind: "formula", name: "Together time", formula: "ab/(a+b)", questions: 0 }, { kind: "type", name: "Two workers together", formula: "", questions: 2 }, { kind: "type", name: "Work and wages", formula: "", questions: 2 }, { kind: "type", name: "Efficiency", formula: "", questions: 1 }], provider: "Gemini", skipped: [] };
      if (/Complete a card/.test(task.text)) return { words: [{ ...card("Together time", ""), kind: "formula", formula: "ab/(a+b)", similar: [] }], provider: "Gemini", skipped: [] };
      const types = [...task.text.matchAll(/([A-Z][\w ]+) \((\d)\)/g)];
      return { words: types.flatMap(([, name, n]) => Array.from({ length: Number(n) }, (_, k) => card(`${name} question ${k + 1} about rates ${name.length}${k}`, `${k + 1} days`, { pattern: name }))), provider: "Gemini", skipped: [] };
    };
    const r = await quantFromTopic(S, "Time and Work", "auto", OPTS);
    const qs = r.items.filter((i) => i.kind === "question" && !i.variantOf);
    expect(r.items.filter((i) => i.kind === "formula")).toHaveLength(1);
    expect(new Set(qs.map((i) => i.pattern))).toEqual(new Set(["Two workers together", "Work and wages", "Efficiency"]));
    expect(r.items.filter((i) => i.variantOf)).toHaveLength(qs.length * 2);
    expect(r.notes.join(" ")).toMatch(/covering 3 of 3 question types/);
  });

  it("a typed topic line goes to the topic route", async () => {
    reply = async (task) => (isPlan(task) ? { words: [{ kind: "type", name: "Mixed", formula: "", questions: 1 }], provider: "Gemini", skipped: [] } : { words: [card("Mixed question one?", "1")], provider: "Gemini", skipped: [] });
    await quantFromText(S, "Syllogism", OPTS);
    expect(isPlan(calls[0])).toBe(true);
  });

  it("makes 2 practice questions for a saved question", async () => {
    const it = makeQItem({ q: "A does a work in 10 days, B in 15. Together?", a: "6 days", subject: "Quant", topic: "Time & Work", pattern: "Two workers together" });
    reply = async () => ({ words: [card(it.q, it.a)], provider: "Gemini", skipped: [] });
    const r = await practiceFor(S, it, {});
    expect(r.items).toHaveLength(2);
    expect(r.items.every((p) => p.variantOf === it.id && p.pattern === "Two workers together")).toBe(true);
  });
});

describe("mixed pastes", () => {
  it("keeps formula lines and other questions next to Q:/A: items", () => {
    const r = readPastedQ("Speed = Distance / Time\nAverage speed = 2xy/(x + y)\nQ: 20% of 250?\nA: 50\n\nHope this helps!");
    expect(r.map((i) => [i.kind, i.q])).toEqual([["question", "20% of 250?"], ["formula", "Speed"], ["formula", "Average speed"]]);
  });
});

describe("figures by AI", () => {
  it("draws a figure for a saved question, cleaned before use", async () => {
    const it = makeQItem({ q: "Tangent PT from P, 13 cm from centre O, radius 5 cm. PT?", a: "12 cm", subject: "Quant", topic: "Geometry" });
    reply = async (task) => {
      expect(task.system).toMatch(/SVG/);
      return { words: [{ figure: '<svg width="240" height="160" onload="x()"><circle cx="70" cy="70" r="40" stroke="black" fill="white"/><text x="60" y="80">O</text></svg>' }], provider: "Gemini", skipped: [] };
    };
    const r = await figureFor(S, it);
    expect(r.figure).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="70" cy="70" r="40" stroke="currentColor" fill="none"/><text x="60" y="80">O</text></svg>');
    expect(calls[0].text).toMatch(/Tangent PT/);
  });
  it("cards and practice questions from AI keep their figures", async () => {
    const fig = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" stroke="currentColor" fill="none"/><text x="4" y="6">O</text></svg>';
    reply = async () => ({ words: [{ ...card("Q: radius 5, distance 13, tangent?", "12", { topic: "Geometry", figure: fig }), similar: [{ q: "radius 6 distance 10 tangent?", a: "8", options: ["6", "10", "4"], solution: "s", figure: fig }] }], provider: "Gemini", skipped: [] });
    const r = await quantFromText(S, "Q: radius 5, distance 13, tangent?\nA: 12", OPTS);
    expect(r.items[0].figure).toContain("<circle");
    expect(r.items[1].figure).toContain("<circle");
  });
});
