import { describe, expect, it } from "vitest";
import { bankRecord, parseBank } from "../src/lib/bank.js";
import { wordsForDay } from "../src/lib/notify.js";
import b1 from "../src/data/bank1.js";
import b2 from "../src/data/bank2.js";
import b3 from "../src/data/bank3.js";
import b4 from "../src/data/bank4.js";
import b5 from "../src/data/bank5.js";
import b6 from "../src/data/bank6.js";

const bank = parseBank(b1, b2, b3, b4, b5, b6);

describe("built-in Word Bank", () => {
  it("has 1000+ unique words, each with meaning, Hindi and an example", () => {
    expect(bank.length).toBeGreaterThanOrEqual(1000);
    expect(new Set(bank.map((w) => w.word.toLowerCase())).size).toBe(bank.length);
    for (const w of bank) {
      expect(w.meaning, w.word).toBeTruthy();
      expect(w.hindi, w.word).toMatch(/[ऀ-ॿ]/);
      expect(w.sentences.length, w.word).toBe(1);
      expect(w.synonyms.concat(w.antonyms)).not.toContain("—");
    }
  });
  it("builds stable ids and keeps saved progress", () => {
    const r = bankRecord(bank[0], { box: 3, reviews: 4, due: "2026-10-05" });
    expect(r.id).toBe(`b:${bank[0].word.toLowerCase()}`);
    expect(r).toMatchObject({ bank: true, box: 3, reviews: 4, due: "2026-10-05", source: "Word Bank" });
  });
});

describe("daily notification words", () => {
  const pool = Array.from({ length: 9 }, (_, i) => ({ id: `w${i}` }));
  it("gives 2 words a day and cycles through every word", () => {
    const seen = new Set();
    for (let d = 1; d <= 5; d++) {
      const words = wordsForDay(pool, `2026-10-0${d}`);
      expect(words).toHaveLength(2);
      words.forEach((w) => seen.add(w.id));
    }
    expect(seen.size).toBe(9);
    expect(wordsForDay(pool, "2026-10-01")).toEqual(wordsForDay(pool, "2026-10-01"));
  });
  it("copes with tiny or empty pools", () => {
    expect(wordsForDay([], "2026-10-01")).toEqual([]);
    expect(wordsForDay([{ id: "x" }], "2026-10-01")).toEqual([{ id: "x" }]);
  });
});
