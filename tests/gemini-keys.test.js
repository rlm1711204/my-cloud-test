import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiEnrich, geminiKeysOf, keyStatus, looksLikeGeminiKey, pickedGeminiKey, pickedKeyNumber, testKey } from "../src/lib/gemini.js";

const ok = (words) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ words }) }] } }] }) });
const fail = (status, message = "x") => ({ ok: false, status, json: async () => ({ error: { message } }) });
// Keys must travel in the x-goog-api-key header (AQ. keys fail as ?key=).
const keyOf = (url, opts) => {
  expect(new URL(url).searchParams.get("key")).toBeNull();
  return opts?.headers?.["x-goog-api-key"];
};

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
    vi.stubGlobal("fetch", async (url, opts) => {
      calls.push(keyOf(url, opts));
      return keyOf(url, opts) === "KEY_ONE_aaaaaaaaaaaaaaaa" ? fail(429) : ok([{ word: "abate" }]);
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
    vi.stubGlobal("fetch", async (url, opts) => (keyOf(url, opts) === "BAD_KEY_cccccccccccccccc" ? fail(400, "API key not valid") : fail(429)));
    const s = { ...S, geminiKeys: ["BAD_KEY_cccccccccccccccc", "LIMITED_dddddddddddddddd"] };
    await expect(geminiEnrich(s, ["abate"], [])).rejects.toMatchObject({ quota: true, message: /All Gemini keys/ });
    expect(keyStatus("BAD_KEY_cccccccccccccccc").state).toBe("invalid");
  });
});

describe("AQ. auth keys", () => {
  it("accepts both key formats", () => {
    expect(looksLikeGeminiKey("AQ.Ab8RN6K36hfeGrY3MGGZwhpUClvIsJpO4KDNGxd-5-1PhYq5")).toBe(true);
    expect(looksLikeGeminiKey("AIzaSyA1234567890abcdefghijklmnop")).toBe(true);
    expect(looksLikeGeminiKey("short")).toBe(false);
    expect(looksLikeGeminiKey("has space in the middle of it....")).toBe(false);
  });
  it("tests a key on add and explains Google's 401 for unsupported AQ. keys", async () => {
    vi.stubGlobal("fetch", async (url, opts) =>
      keyOf(url, opts).startsWith("AQ.good")
        ? { ok: true, status: 200, json: async () => ({ models: [] }) }
        : fail(401, "Request had invalid authentication credentials. ACCESS_TOKEN_TYPE_UNSUPPORTED"),
    );
    expect(await testKey("AQ.good-xxxxxxxxxxxxxxxxxxxx")).toMatchObject({ ok: true });
    const bad = await testKey("AQ.blocked-xxxxxxxxxxxxxxxx");
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/known Google issue/);
    expect(keyStatus("AQ.blocked-xxxxxxxxxxxxxxxx").state).toBe("invalid");
  });
});

describe("hand-picked Gemini key", () => {
  const S = { geminiModel: "gemini-2.5-flash", exam: "general" };
  const A = "PICK_ONE_eeeeeeeeeeeeeeee";
  const B = "PICK_TWO_ffffffffffffffff";

  it("uses only the chosen key, even if it was resting", async () => {
    const calls = [];
    let bLimited = true;
    vi.stubGlobal("fetch", async (url, opts) => {
      calls.push(keyOf(url, opts));
      return keyOf(url, opts) === B && bLimited ? fail(429) : ok([{ word: "abate" }]);
    });
    // Auto mode: B is first, hits its limit, A takes over.
    await geminiEnrich({ ...S, geminiKeys: [B, A] }, ["abate"], []);
    expect(keyStatus(B).state).toBe("resting");
    // Picked B by hand (its limit has reset): B is tried again, and nothing else.
    bLimited = false;
    calls.length = 0;
    const res = await geminiEnrich({ ...S, geminiKeys: [B, A], geminiKeyPick: B }, ["abate"], []);
    expect(res.words).toEqual([{ word: "abate" }]);
    expect(calls.every((k) => k === B)).toBe(true);
    expect(keyStatus(B).state).toBe("ok");
  });

  it("names the key when the chosen key fails, instead of trying others", async () => {
    const calls = [];
    vi.stubGlobal("fetch", async (url, opts) => {
      calls.push(keyOf(url, opts));
      return fail(429);
    });
    const s = { ...S, geminiKeys: [A, B], geminiKeyPick: B };
    await expect(geminiEnrich(s, ["abate"], [])).rejects.toMatchObject({ quota: true, message: /Key 2 reached its free limit/ });
    expect(calls.every((k) => k === B)).toBe(true);
  });

  it("falls back to Auto if the chosen key was removed", () => {
    expect(pickedGeminiKey({ geminiKeys: [A], geminiKeyPick: B })).toBeNull();
    expect(pickedKeyNumber({ geminiKeys: [A, B], geminiKeyPick: B })).toBe(2);
  });
});
