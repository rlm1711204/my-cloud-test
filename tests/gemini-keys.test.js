import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiEnrich, geminiKeysOf, keyStatus } from "../src/lib/gemini.js";

const ok = (words) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ words }) }] } }] }) });
const fail = (status, message = "x") => ({ ok: false, status, json: async () => ({ error: { message } }) });
const keyOf = (url) => new URL(url).searchParams.get("key");

afterEach(() => vi.unstubAllGlobals());

describe("geminiKeysOf", () => {
  it("merges the old single key with the list and removes blanks/duplicates", () => {
    expect(geminiKeysOf({ geminiKeys: ["a", " b ", "", "a"], geminiKey: "c" })).toEqual(["a", "b", "c"]);
    expect(geminiKeysOf({})).toEqual([]);
  });
});

describe("multiple Gemini keys", () => {
  const S = { geminiModel: "gemini-2.5-flash", exam: "general" };

  it("moves to the next key when one hits its free limit, and rests the exhausted key", async () => {
    const calls = [];
    vi.stubGlobal("fetch", async (url) => {
      calls.push(keyOf(url));
      return keyOf(url) === "KEY_ONE_aaaaaaaaaaaaaaaa" ? fail(429) : ok([{ word: "abate" }]);
    });
    const s = { ...S, geminiKeys: ["KEY_ONE_aaaaaaaaaaaaaaaa", "KEY_TWO_bbbbbbbbbbbbbbbb"] };
    const res = await geminiEnrich(s, ["abate"], []);
    expect(res.words).toEqual([{ word: "abate" }]);
    expect(calls.filter((k) => k === "KEY_ONE_aaaaaaaaaaaaaaaa").length).toBeGreaterThan(0);
    expect(calls.at(-1)).toBe("KEY_TWO_bbbbbbbbbbbbbbbb");
    expect(keyStatus("KEY_ONE_aaaaaaaaaaaaaaaa").state).toBe("resting");
    // Next request skips the resting key entirely.
    calls.length = 0;
    await geminiEnrich(s, ["abate"], []);
    expect(calls.every((k) => k === "KEY_TWO_bbbbbbbbbbbbbbbb")).toBe(true);
  });

  it("skips an invalid key and reports a limit only when every key is exhausted", async () => {
    vi.stubGlobal("fetch", async (url) => (keyOf(url) === "BAD_KEY_cccccccccccccccc" ? fail(400, "API key not valid") : fail(429)));
    const s = { ...S, geminiKeys: ["BAD_KEY_cccccccccccccccc", "LIMITED_dddddddddddddddd"] };
    await expect(geminiEnrich(s, ["abate"], [])).rejects.toMatchObject({ quota: true, message: /All Gemini keys/ });
    expect(keyStatus("BAD_KEY_cccccccccccccccc").state).toBe("invalid");
  });
});
