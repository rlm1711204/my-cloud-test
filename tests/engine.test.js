import { beforeEach, describe, expect, it, vi } from "vitest";

// Plain call log + swappable behaviour (the mock factory is hoisted, so keep it free of vi.fn state).
const calls = [];
let impl = async () => ({ words: [] });
vi.mock("../src/lib/gemini.js", () => ({
  geminiEnrich: (...a) => (calls.push(a), impl(...a)),
  geminiList: async () => ({ words: [] }),
  geminiTask: async () => ({ words: [] }),
  geminiKeysOf: (s) => (s.geminiKeys || []).filter(Boolean),
  pickedKeyNumber: () => 0,
}));

const { aiEnrichAll, BATCH } = await import("../src/lib/engine.js");
const S = { geminiKeys: ["k"], apiKey: "" };
const card = (w) => ({ word: w, meaning: `m:${w}` });

describe("aiEnrichAll", () => {
  beforeEach(() => (calls.length = 0));

  it("splits long lists into batches and keeps every word in order", async () => {
    impl = async (_s, words) => ({ words: words.map(card) });
    const items = Array.from({ length: 213 }, (_, i) => ({ word: `w${String.fromCharCode(97 + (i % 26))}${i}`, context: `line ${i}` }));
    const res = await aiEnrichAll(S, items);
    expect(calls).toHaveLength(Math.ceil(213 / BATCH));
    expect(res.words).toHaveLength(213);
    expect(res.failed).toBe(0);
    expect(res.words[200]).toMatchObject({ meaning: `m:${items[200].word}`, context: "line 200" });
    // source lines are passed to the model so cards match the list's sense
    expect(calls[0][2][0]).toBe("line 0");
  });

  it("keeps words without details when every provider fails, and pauses a provider after its limit", async () => {
    impl = async () => {
      throw Object.assign(new Error("Gemini free limit reached for now."), { quota: true });
    };
    const items = Array.from({ length: 30 }, (_, i) => ({ word: `word${String.fromCharCode(97 + i)}` }));
    const res = await aiEnrichAll(S, items);
    expect(res.words).toHaveLength(30);
    expect(res.failed).toBe(30);
    expect(res.words[0]).toEqual({ word: "worda", context: "" });
    expect(calls).toHaveLength(1); // 2nd batch skipped: Gemini is cooling down
    expect(res.notes.join(" ")).toMatch(/limit/);
  });
});

describe("a word the AI leaves out", () => {
  it("is asked for once more on its own, and the fallback is never silent", async () => {
    // An earlier test leaves Gemini in its 10-minute cooldown; step past it.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    calls.length = 0;
    let n = 0;
    impl = async (st, words) => {
      n += 1;
      // First reply drops the "easy" word; the retry returns it.
      if (n === 1) return { words: words.filter((w) => w !== "idioms").map(card) };
      return { words: words.map(card) };
    };
    const r = await aiEnrichAll(S, [{ word: "obdurate" }, { word: "idioms" }]);
    expect(r.failed).toBe(0);
    expect(r.words.map((w) => w.word).sort()).toEqual(["idioms", "obdurate"]);
    expect(calls.at(-1)[1]).toEqual(["idioms"]);

    impl = async (st, words) => ({ words: words.filter((w) => w !== "idioms").map(card) });
    const r2 = await aiEnrichAll(S, [{ word: "idioms" }]);
    expect(r2.failed).toBe(1);
    expect(r2.notes.join(" ")).toMatch(/left out “idioms” → free dictionary/);
    expect(r2.usedBy).toEqual(["Gemini"]);
    vi.useRealTimers();
  });
});
