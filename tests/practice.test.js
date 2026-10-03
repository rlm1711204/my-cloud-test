import { describe, expect, it } from "vitest";
import { coverage, emptyPractice, markAsked, mergePractice, normalize, pickSession, recordAnswer, requeue, weakWords } from "../src/lib/practice.js";

const pool = Array.from({ length: 25 }, (_, i) => ({ id: `w${i}` }));
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe("practice scheduler", () => {
  it("covers every word once before any word repeats", () => {
    let p = emptyPractice();
    const asked = [];
    for (let s = 0; s < 3; s++) {
      const { ids } = pickSession(pool, p, "bank", 10, rand);
      for (const id of ids) (asked.push(id), (p = recordAnswer(p, "bank", id, true)));
    }
    // 30 questions over 25 words: the first 25 are all distinct.
    expect(new Set(asked.slice(0, 25)).size).toBe(25);
    expect(coverage(pool, p, "bank").round).toBe(2);
    // Round 2 then covers all 25 again (the 5 already asked in round 2 + the remaining 20).
    const later = [];
    for (let s = 0; s < 2; s++) {
      const { ids } = pickSession(pool, p, "bank", 10, rand);
      for (const id of ids) (later.push(id), (p = recordAnswer(p, "bank", id, true)));
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

  it("merges devices: the higher count per item, the newest weak info", () => {
    const a = recordAnswer(recordAnswer(emptyPractice(), "mine", "w1", true), "mine", "w1", true);
    const b = recordAnswer(emptyPractice(), "bank", "w2", false);
    const m = mergePractice(a, b);
    expect(m.asked).toEqual({ w1: 2, w2: 1 });
    expect(m.weak.w2.need).toBe(2);
  });

  it("counts practice of a filtered list (one topic, a level) towards the full list", () => {
    let p = emptyPractice();
    const subset = pool.slice(0, 8);
    for (let s = 0; s < 3; s++) for (const id of pickSession(subset, p, "mine", 5, rand).ids) p = recordAnswer(p, "mine", id, true);
    // The full list then asks the 17 never-practised words before repeating any of the 8.
    const asked = [];
    for (let s = 0; s < 2; s++) for (const id of pickSession(pool, p, "mine", 10, rand).ids) (asked.push(id), (p = recordAnswer(p, "mine", id, true)));
    expect(new Set(asked.slice(0, 17))).toEqual(new Set(pool.slice(8).map((w) => w.id)));
    expect(coverage(pool, p, "mine").round).toBe(2);
  });

  it("counts practice under one source (Mixed) when practising another (My words)", () => {
    let p = emptyPractice();
    for (const id of pickSession(pool, p, "mixed", 15, rand).ids) p = recordAnswer(p, "mixed", id, true);
    const next = pickSession(pool, p, "mine", 10, rand).ids;
    expect(next.every((id) => !p.asked[id])).toBe(true);
  });

  it("puts items picked but not reached (session finished early) first next time", () => {
    let p = emptyPractice();
    const first = pickSession(pool, p, "mine", 10, rand).ids;
    for (const id of first.slice(0, 3)) p = recordAnswer(p, "mine", id, true);
    const next = pickSession(pool, p, "mine", 22, rand).ids;
    expect(next.filter((id) => first.slice(0, 3).includes(id))).toEqual([]);
  });

  it("can mark an item as asked without an answer, and reads the old per-source format", () => {
    expect(markAsked(emptyPractice(), "w4").asked.w4).toBe(1);
    const old = { rounds: { mine: { round: 2, seen: { w1: 2, w2: 1 } }, bank: { round: 1, seen: { w2: 1, w3: 1 } } }, weak: {} };
    expect(normalize(old).asked).toEqual({ w1: 2, w2: 1, w3: 1 });
    expect(coverage(pool.slice(1, 4), old, "mine")).toEqual({ round: 2, covered: 1, total: 3 });
  });

  it("handles tiny pools without looping forever", () => {
    const { ids } = pickSession([{ id: "x" }], emptyPractice(), "mine", 10, rand);
    expect(ids).toEqual(["x"]);
  });
});
