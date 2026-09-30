import { describe, expect, it } from "vitest";
import { addDays, buildDailyPlan, review, stage, stats, streak } from "../src/lib/srs.js";
import { makeWord } from "../src/lib/words.js";

const T = "2026-09-30";
const mk = (word, extra = {}) => makeWord({ word, addedAt: `2026-09-${String(10 + word.length).padStart(2, "0")}T00:00:00Z`, ...extra });

describe("review", () => {
  it("moves up a box and schedules by interval when known", () => {
    const w = review(mk("abate"), "good", T);
    expect(w.box).toBe(1);
    expect(w.due).toBe(addDays(T, 1));
    const w2 = review(w, "good", T);
    expect(w2.box).toBe(2);
    expect(w2.due).toBe(addDays(T, 3));
  });
  it("sends forgotten words back to box 1, due tomorrow", () => {
    const w = review(mk("abate", { box: 4, reviews: 5 }), "again", T);
    expect(w.box).toBe(1);
    expect(w.lapses).toBe(1);
    expect(w.due).toBe(addDays(T, 1));
  });
  it("tracks stage transitions", () => {
    expect(stage(mk("a"))).toBe("new");
    expect(stage(review(mk("a"), "good", T))).toBe("learning");
    expect(stage(mk("a", { box: 5, reviews: 6 }))).toBe("mastered");
  });
});

describe("buildDailyPlan", () => {
  // Letters only: real words never contain digits (wordKey strips them).
  const words = Array.from({ length: 30 }, (_, i) => mk(`word${String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26))}`));
  it("returns a word of the day plus `count` other words", () => {
    const plan = buildDailyPlan(words, { count: 10, date: T });
    expect(plan.wotd).toBeTruthy();
    expect(plan.ids).toHaveLength(10);
    expect(plan.ids).not.toContain(plan.wotd);
    expect(new Set(plan.ids).size).toBe(10);
  });
  it("is stable for the same date", () => {
    expect(buildDailyPlan(words, { date: T })).toEqual(buildDailyPlan(words, { date: T }));
  });
  it("puts due reviews first but keeps room for new words", () => {
    const due = words.slice(0, 20).map((w) => ({ ...w, box: 1, reviews: 1, due: "2026-09-29" }));
    const plan = buildDailyPlan([...due, ...words.slice(20)], { count: 10, date: T });
    const byId = new Map([...words, ...due].map((w) => [w.id, w]));
    const kinds = plan.ids.map((id) => stage(byId.get(id)));
    expect(kinds.filter((k) => k === "new").length).toBeGreaterThanOrEqual(3);
    expect(kinds[0]).toBe("learning");
  });
  it("does not repeat a featured word of the day while others remain", () => {
    const first = buildDailyPlan(words, { date: T });
    const wotdWord = words.find((w) => w.id === first.wotd).word;
    const next = buildDailyPlan(words, { date: T, featured: [wotdWord] });
    expect(next.wotd).not.toBe(first.wotd);
  });
  it("handles an empty list", () => {
    expect(buildDailyPlan([], { date: T })).toEqual({ date: T, wotd: null, ids: [] });
  });
});

describe("streak and stats", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(streak(["2026-09-28", "2026-09-29", "2026-09-30"], T)).toBe(3);
    expect(streak(["2026-09-28", "2026-09-29"], T)).toBe(2);
    expect(streak(["2026-09-27"], T)).toBe(0);
  });
  it("summarises stages", () => {
    const s = stats([mk("a"), mk("b", { box: 2, reviews: 2, due: T }), mk("c", { deleted: true })], T);
    expect(s).toMatchObject({ total: 2, new: 1, learning: 1, due: 1 });
  });
});
