import { describe, expect, it } from "vitest";
import { coverage, emptyPractice, mergePractice, pickSession, recordAnswer, requeue, weakWords } from "../src/lib/practice.js";

const pool = Array.from({ length: 25 }, (_, i) => ({ id: `w${i}` }));
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe("practice scheduler", () => {
  it("covers every word once before any word repeats", () => {
    let p = emptyPractice();
    const asked = [];
    for (let s = 0; s < 3; s++) {
      const { ids, practice, roundOf } = pickSession(pool, p, "bank", 10, rand);
      p = practice;
      for (const id of ids) (asked.push(id), (p = recordAnswer(p, "bank", id, true, { round: roundOf[id] })));
    }
    // 30 questions over 25 words: the first 25 are all distinct.
    expect(new Set(asked.slice(0, 25)).size).toBe(25);
    expect(coverage(pool, p, "bank").round).toBe(2);
    // Round 2 then covers all 25 again (the 5 already asked in round 2 + the remaining 20).
    const later = [];
    for (let s = 0; s < 2; s++) {
      const { ids, practice, roundOf } = pickSession(pool, p, "bank", 10, rand);
      p = practice;
      for (const id of ids) (later.push(id), (p = recordAnswer(p, "bank", id, true, { round: roundOf[id] })));
    }
    expect(new Set([...asked.slice(25), ...later]).size).toBe(25);
  });

  it("brings wrong words back in the next session until answered right twice", () => {
    let p = emptyPractice();
    p = recordAnswer(p, "bank", "w3", false);
    expect(weakWords(pool, p).map((w) => w.id)).toEqual(["w3"]);
    let { ids } = pickSession(pool, p, "bank", 10, rand);
    expect(ids).toContain("w3");
    p = recordAnswer(p, "bank", "w3", true);
    ({ ids } = pickSession(pool, p, "bank", 10, rand));
    expect(ids).toContain("w3"); // still needs one more right answer
    p = recordAnswer(p, "bank", "w3", true);
    expect(weakWords(pool, p)).toEqual([]);
  });

  it("re-asks a wrong word a few questions later, once per session", () => {
    const done = new Set();
    const q = requeue(["a", "b", "c", "d", "e", "f"], 0, "a", done);
    expect(q).toEqual(["a", "b", "c", "d", "a", "e", "f"]);
    expect(requeue(q, 4, "a", done)).toBe(q);
  });

  it("keeps separate rounds per source and merges devices", () => {
    let a = recordAnswer(emptyPractice(), "mine", "w1", true);
    let b = recordAnswer(emptyPractice(), "bank", "w2", false);
    const m = mergePractice(a, b);
    expect(Object.keys(m.rounds).sort()).toEqual(["bank", "mine"]);
    expect(m.weak.w2.need).toBe(2);
  });

  it("handles tiny pools without looping forever", () => {
    const { ids } = pickSession([{ id: "x" }], emptyPractice(), "mine", 10, rand);
    expect(ids).toEqual(["x"]);
  });
});
