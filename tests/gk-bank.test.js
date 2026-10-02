import { describe, expect, it } from "vitest";
import { loadBank, parseBank } from "../src/lib/gkbank.js";
import { classify, TAXONOMY } from "../src/lib/gk-taxonomy.js";
import { availableKinds, makeGkQuestion } from "../src/lib/gk-quiz.js";
import { makeItem } from "../src/lib/gk.js";
import g1 from "../src/data/gk1.js";
import g2 from "../src/data/gk2.js";
import g3 from "../src/data/gk3.js";
import g4 from "../src/data/gk4.js";

const { items, problems } = parseBank([g1, g2, g3, g4].join("\n"));

describe("built-in Question Bank", () => {
  it("parses with no problems and is substantial", () => {
    expect(problems).toEqual([]);
    expect(items.length).toBeGreaterThanOrEqual(300);
  });

  it("covers every subject, with a trick and 3 distinct wrong options for every question", () => {
    expect(new Set(items.map((i) => i.category))).toEqual(new Set(Object.keys(TAXONOMY)));
    for (const i of items) {
      expect(i.trick, i.q).not.toBe("");
      expect(new Set(i.options).size, i.q).toBe(3);
      expect(i.options, i.q).not.toContain(i.a);
    }
  });

  it("has unique ids, and loads lazily to the same list", async () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect((await loadBank()).length).toBe(items.length);
  });

  it("the offline classifier agrees with the bank's subject for at least 90% of questions", () => {
    const agree = items.filter((i) => classify(`${i.q} ${i.a}`).category === i.category).length;
    expect(agree / items.length).toBeGreaterThanOrEqual(0.9);
  });

  it("every question can be practised in every type it supports", () => {
    let seed = 3;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pool = items.map((i) => makeItem(i));
    for (const it of pool) {
      for (const kind of availableKinds(it, pool)) {
        const q = makeGkQuestion(it, kind, pool, rand);
        expect(q.kind, `${it.q} ${kind}`).toBe(kind);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        if (kind === "mcq") expect(q.options[q.answer]).toBe(it.a);
      }
    }
  });
});
