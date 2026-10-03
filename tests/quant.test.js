import { describe, expect, it } from "vitest";
import { plainMath } from "../src/lib/mathtext.js";
import { classifyQuant, matchTopic, qPatternKey } from "../src/lib/quant-taxonomy.js";
import { findDuplicateQ, makeQItem, matchPattern, qItemsToCSV } from "../src/lib/quant.js";
import { buildQuantMaterialPrompt, buildQuantTopicPrompt, buildSimilarPrompt, formulaLines, isQComplete, looksQuantStructured, readQHeading, readQuant } from "../src/lib/quant-prompt.js";
import { parseBook } from "../src/lib/qbook.js";
import bookText from "../src/data/qformulas.js";

describe("plain maths", () => {
  it("turns LaTeX into readable text", () => {
    expect(plainMath("$\\frac{a \\times b}{a + b}$")).toBe("(a × b)/(a + b)");
    expect(plainMath("x^2 + y^{3} = \\sqrt{25}")).toBe("x² + y³ = √25");
    expect(plainMath("d_1 + d_2 - \\frac{d_1 d_2}{100}")).toBe("d₁ + d₂ - (d₁ d₂)/100");
    expect(plainMath("\\sin^2\\theta + \\cos^2\\theta = 1")).toBe("sin²θ + cos²θ = 1");
    expect(plainMath("Profit% = Profit/CP × 100")).toBe("Profit% = Profit/CP × 100");
  });
});

describe("classifying maths and reasoning", () => {
  it("files questions by keywords", () => {
    const c = (t) => {
      const r = classifyQuant(t);
      return `${r.subject} › ${r.topic}`;
    };
    expect(c("A can do a work in 10 days and B in 15 days. In how many days will they finish it together?")).toBe("Quant › Time & Work");
    expect(c("A train 150 m long crosses a pole in 10 seconds. Find its speed.")).toBe("Quant › Trains");
    expect(c("Statements: All pens are books. Some books are copies. Conclusions: I. Some pens are copies")).toBe("Reasoning › Syllogism");
    expect(c("Pointing to a man, Rita said, 'He is the son of my mother's only brother.'")).toBe("Reasoning › Blood Relations");
    expect(c("Find the angle between the hands of a clock at 3:40")).toBe("Reasoning › Clocks");
    expect(c("The cost price of 20 articles equals the selling price of 16. Find the profit percent.")).toBe("Quant › Profit & Loss");
  });
  it("matches topic names written differently", () => {
    expect(matchTopic("", "time and work")).toEqual(["Quant", "Time & Work"]);
    expect(matchTopic("Reasoning", "Circular seating arrangement")).toEqual(["Reasoning", "Seating Arrangement"]);
    expect(readQHeading("Quantitative Aptitude > Profit and Loss")).toEqual({ subject: "Quant", topic: "Profit & Loss" });
    expect(readQHeading("Logical Reasoning › Coding Decoding")).toEqual({ subject: "Reasoning", topic: "Coding-Decoding" });
  });
});

describe("items", () => {
  it("keeps solution steps, cleans maths, and files by text when no topic is given", () => {
    const it = makeQItem({ q: "A pipe fills a tank in 4 h and a leak empties it in 12 h. Time to fill?", a: "6 hours", options: ["6 hours", "8 hours", "3 hours", "5 hours"], solution: "Net = 1/4 − 1/12\n= 1/6 → 6 h", formula: "$\\frac{ab}{b-a}$" });
    expect(it).toMatchObject({ kind: "question", subject: "Quant", topic: "Pipes & Cisterns", options: ["8 hours", "3 hours", "5 hours"], formula: "ab/(b-a)" });
    expect(it.solution.split("\n")).toHaveLength(2);
    expect(qPatternKey(it)).toBe("Quant › Pipes & Cisterns › General");
  });
  it("treats questions with different numbers as different, and the same question as a duplicate", () => {
    const a = makeQItem({ q: "A can do a work in 10 days and B in 15 days. Together?", a: "6 days" });
    const b = makeQItem({ q: "A can do a work in 12 days and B in 24 days. Together?", a: "8 days" });
    const c = makeQItem({ q: "A can do a work in 10 days and B in 15 days. Working together?", a: "6 days" });
    expect(findDuplicateQ(b, [a])).toBe(null);
    expect(findDuplicateQ(c, [a])?.id).toBe(a.id);
    // Same wording, different answers → different questions.
    expect(findDuplicateQ(makeQItem({ q: "Find x if 2x + 3 = 11", a: "4" }), [makeQItem({ q: "Find x if 2x + 3 = 11", a: "5" })])).toBe(null);
    expect(findDuplicateQ(makeQItem({ q: "Which conclusion follows? (set A)", a: "Only I" }), [makeQItem({ q: "Which conclusion follows? (set A)", a: "Only II" })])).toBe(null);
    const f1 = makeQItem({ kind: "formula", q: "Two workers together", formula: "T = ab/(a + b)" });
    expect(findDuplicateQ(makeQItem({ kind: "formula", q: "Two workers working together", formula: "T = ab/(a+b)" }), [f1])?.id).toBe(f1.id);
  });
  it("reuses an existing type name when a new one means the same", () => {
    expect(matchPattern("two workers together.", ["Two workers together", "Work and wages"])).toBe("Two workers together");
    expect(matchPattern("Type: Efficiency comparison", ["Two workers together"])).toBe("Efficiency comparison");
  });
  it("exports CSV with the question each practice question belongs to", () => {
    const a = makeQItem({ q: "Q1?", a: "1" });
    const v = makeQItem({ q: "Q2?", a: "2", variantOf: a.id });
    expect(qItemsToCSV([a, v]).split("\n")[2]).toContain('"Q1?"');
  });
});

describe("reading an AI's answer", () => {
  it("reads the prompt's own example: question, 2 practice questions linked to it, and a formula card", () => {
    const p = buildQuantTopicPrompt({ topic: "Time and Work" });
    const { items } = readQuant(p.slice(p.indexOf("## Quant › Time & Work")).split("\n\n## Quant › Geometry")[0]);
    expect(items.map((i) => i.kind)).toEqual(["question", "question", "question", "formula"]);
    expect(items[1].variantOf).toBe(items[0].id);
    expect(items[2].variantOf).toBe(items[0].id);
    expect(items[0]).toMatchObject({ a: "6 days", pattern: "Two workers together", subject: "Quant", topic: "Time & Work" });
    expect(items[0].solution.split("\n")).toHaveLength(2);
    expect(items.every((i) => isQComplete(i))).toBe(true);
  });

  it("forgives bold, numbering, a) b) options, LaTeX and chat filler", () => {
    const text = `Sure! Here you go:

### **Quantitative Aptitude > Profit and Loss**
**Type:** Successive discounts
**Q1.** Successive discounts of 20% and 10% equal a single discount of?
a) 30%
b) 28%
c) 25%
d) 32%
**Answer:** b
**Solution:** Net = 20 + 10 − (20 × 10)/100
= 28%
**Trick:** Add, then subtract product/100.

**Practice Question 1:** Successive discounts of 10% and 10%?
**Answer:** 19%
**Options:** 20%; 18%; 21%
**Solution:** 10 + 10 − 1 = 19%

**FORMULA:** Successive discounts
**F:** Net = $d_1 + d_2 - \\frac{d_1 d_2}{100}$
**T:** Add, then subtract product/100.

Hope this helps!`;
    expect(looksQuantStructured(text)).toBe(true);
    const { items, rest } = readQuant(text);
    expect(items[0]).toMatchObject({ a: "28%", options: ["30%", "25%", "32%"], pattern: "Successive discounts", topic: "Profit & Loss" });
    expect(items[0].solution).toBe("Net = 20 + 10 − (20 × 10)/100\n= 28%");
    expect(items[1]).toMatchObject({ variantOf: items[0].id, pattern: "Successive discounts", a: "19%" });
    expect(items[2]).toMatchObject({ kind: "formula", formula: "Net = d₁ + d₂ - (d₁ d₂)/100", trick: "Add, then subtract product/100." });
    expect(rest).toMatch(/Hope this helps/);
  });

  it("reads formula lines from plain notes", () => {
    expect(formulaLines("Speed = Distance / Time\nWhat is 2+2?\nAverage speed = 2xy/(x + y)").map((f) => f.q)).toEqual(["Speed", "Average speed"]);
  });

  it("builds prompts for photos, topics and '2 more like this'", () => {
    const m = buildQuantMaterialPrompt({ files: [{}], variants: true, patterns: { "Quant › Time & Work": ["Two workers together"] } });
    expect(m).toMatch(/including handwriting/);
    expect(m).toMatch(/2 practice questions of the same TYPE/);
    expect(m).toMatch(/Quant › Time & Work: Two workers together/);
    expect(buildQuantMaterialPrompt({ variants: false })).not.toMatch(/\nPQ:/);
    const sim = buildSimilarPrompt(makeQItem({ q: "A can do a work in 10 days…", a: "6 days", subject: "Quant", topic: "Time & Work", pattern: "Two workers together" }));
    expect(sim).toMatch(/## Quant › Time & Work\nTYPE: Two workers together\nQ: A can do/);
  });
});

describe("Formula Book", () => {
  it("parses with no problems and covers both subjects", () => {
    const { items, problems } = parseBook(bookText);
    expect(problems).toEqual([]);
    expect(items.length).toBeGreaterThanOrEqual(70);
    expect(new Set(items.map((i) => i.subject))).toEqual(new Set(["Quant", "Reasoning"]));
    expect(items.every((i) => i.formula && i.trick && i.solution)).toBe(true);
    // Geometry, mensuration and trigonometry cards carry figures that pass the safety filter unchanged.
    const withFig = items.filter((i) => i.figure);
    expect(withFig.length).toBeGreaterThanOrEqual(25);
    expect(withFig.every((i) => makeQItem(i).figure === i.figure)).toBe(true);
    expect(withFig.map((i) => i.q)).toEqual(expect.arrayContaining(["Tangent–radius theorem", "Alternate segment theorem", "Centroid (medians meet in the ratio 2 : 1)", "Heron's formula"]));
  });
});

describe("figures", () => {
  it("reads a FIG: line (one line or a fenced block) into a safe figure", async () => {
    const { sanitizeSvg } = await import("../src/lib/svgsafe.js");
    const p = buildQuantTopicPrompt({ topic: "Circles" });
    const geo = readQuant(p.slice(p.indexOf("## Quant › Geometry"))).items[0];
    expect(makeQItem(geo)).toMatchObject({ topic: "Geometry", pattern: "Tangent from an external point" });
    expect(makeQItem(geo).figure).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 220 130">/);
    const fenced = readQuant('## Quant › Geometry\nQ: Find angle BOC.\nA: 100°\n**Figure:**\n```svg\n<svg width="200" height="160">\n<polygon points="1,1 9,9 1,9" stroke="black"/>\n</svg>\n```\nS: Double the angle.').items[0];
    expect(makeQItem(fenced).figure).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><polygon points="1,1 9,9 1,9" stroke="currentColor"/></svg>');
    expect(fenced.solution).toBe("Double the angle.");
    // Nothing unsafe survives.
    const bad = sanitizeSvg('<svg viewBox="0 0 9 9" onload="x()"><script>x()</script><a href="javascript:x()"><circle r="1"/></a><circle r="2" onclick="x()" fill="url(http://e)"/><foreignObject><b>x</b></foreignObject><text>&lt;img onerror=1&gt;</text></svg>');
    expect(bad).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9"><circle r="2"/><text>&lt;img onerror=1&gt;</text></svg>');
    expect(sanitizeSvg("<div>no</div>")).toBe("");
  });
  it("keeps attached photos only as small image data URLs", async () => {
    const { cleanImage } = await import("../src/lib/svgsafe.js");
    expect(cleanImage("data:image/jpeg;base64,AAAA")).toBe("data:image/jpeg;base64,AAAA");
    expect(cleanImage("data:text/html;base64,AAAA")).toBe("");
    expect(cleanImage("javascript:alert(1)")).toBe("");
  });
});
