import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PACIFIC, countChars, countRequest, dayIn, fingerprint, nextMidnight, noteHeaders, noteLimitHit, parseGeminiQuota,
  parseRateHeaders, resetIn, resetUsage, serviceId, usageOf,
} from "../src/lib/usage.js";

const H = (obj) => {
  const m = new Map(Object.entries(obj));
  return { forEach: (fn) => m.forEach((v, k) => fn(v, k)), get: (k) => m.get(k) ?? null };
};

beforeEach(() => {
  resetUsage();
  vi.useRealTimers();
});

describe("rate limits from reply headers", () => {
  it("reads Groq, Cerebras, OpenRouter and Claude headers", () => {
    const now = 1_700_000_000_000;
    const groq = parseRateHeaders(
      ["x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-reset-requests", "x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens", "content-type"],
      (k) => ({ "x-ratelimit-limit-requests": "14400", "x-ratelimit-remaining-requests": "14370", "x-ratelimit-reset-requests": "2m59.56s", "x-ratelimit-limit-tokens": "6000", "x-ratelimit-remaining-tokens": "5100" })[k],
      now,
    );
    expect(groq).toEqual([
      { label: "requests", limit: 14400, remaining: 14370, resetMs: 179560 },
      { label: "tokens", limit: 6000, remaining: 5100, resetMs: null },
    ]);
    const cerebras = parseRateHeaders(["x-ratelimit-limit-requests-day", "x-ratelimit-remaining-requests-day", "x-ratelimit-remaining-tokens-minute"], (k) => ({ "x-ratelimit-limit-requests-day": "14400", "x-ratelimit-remaining-requests-day": "14399", "x-ratelimit-remaining-tokens-minute": "59000" })[k]);
    expect(cerebras.map((l) => [l.label, l.remaining, l.limit])).toEqual([["requests today", 14399, 14400], ["tokens this minute", 59000, null]]);
    const openrouter = parseRateHeaders(["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"], (k) => ({ "X-RateLimit-Limit": "20", "X-RateLimit-Remaining": "19", "X-RateLimit-Reset": String(now + 30000) })[k], now);
    expect(openrouter).toEqual([{ label: "requests", limit: 20, remaining: 19, resetMs: 30000 }]);
    const claude = parseRateHeaders(["anthropic-ratelimit-requests-limit", "anthropic-ratelimit-requests-remaining", "anthropic-ratelimit-requests-reset", "anthropic-ratelimit-output-tokens-remaining"], (k) => ({ "anthropic-ratelimit-requests-limit": "50", "anthropic-ratelimit-requests-remaining": "49", "anthropic-ratelimit-requests-reset": new Date(now + 60000).toISOString(), "anthropic-ratelimit-output-tokens-remaining": "8000" })[k], now);
    expect(claude).toEqual([
      { label: "requests", limit: 50, remaining: 49, resetMs: 60000 },
      { label: "output tokens", limit: null, remaining: 8000, resetMs: null },
    ]);
    expect(resetIn("1h2m3s")).toBe(3723000);
    expect(resetIn("35s")).toBe(35000);
    expect(resetIn("17")).toBe(17000);
    expect(resetIn("")).toBeNull();
  });

  it("reads what Gemini says when a limit is reached", () => {
    const q = parseGeminiQuota({
      code: 429,
      details: [
        { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests", quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaDimensions: { model: "gemini-flash-latest", location: "global" }, quotaValue: "250" }] },
        { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "35s" },
      ],
    });
    expect(q).toEqual({ limits: [{ model: "gemini-flash-latest", per: "day", what: "requests", value: 250 }], retryMs: 35000 });
    expect(parseGeminiQuota({})).toEqual({ limits: [], retryMs: null });
  });
});

describe("usage kept per key", () => {
  it("counts today's requests per model, keeps the limit Google named, and never stores the key", () => {
    const key = "AQ.SecretKeyValue1234567890";
    const id = serviceId("gemini", key);
    expect(id).not.toContain("Secret");
    expect(fingerprint(key)).toBe(fingerprint(key));
    expect(fingerprint(key)).not.toBe(fingerprint(`${key}x`));
    countRequest(id, { model: "gemini-flash-latest", tz: PACIFIC });
    countRequest(id, { model: "gemini-flash-latest", tz: PACIFIC });
    countRequest(id, { model: "gemini-flash-lite-latest", tz: PACIFIC });
    noteLimitHit(id, { model: "gemini-flash-latest", limits: [{ model: "gemini-flash-latest", per: "day", what: "requests", value: 250 }], retryMs: 35000, tz: PACIFIC });
    const u = usageOf(id, PACIFIC);
    expect(u.today).toMatchObject({ requests: 3, models: { "gemini-flash-latest": 2, "gemini-flash-lite-latest": 1 } });
    expect(u.limits).toEqual([expect.objectContaining({ model: "gemini-flash-latest", per: "day", value: 250 })]);
    expect(u.hit.until).toBeGreaterThan(Date.now());
    expect(String(globalThis.localStorage?.getItem("vv.usage.v1") ?? "")).not.toContain("Secret");
    noteHeaders(id, H({ "x-ratelimit-remaining-requests": "9", "x-ratelimit-limit-requests": "10" }));
    expect(usageOf(id, PACIFIC).live.limits[0]).toMatchObject({ remaining: 9, limit: 10 });
    countChars("mymemory", 120);
    expect(usageOf("mymemory").today.chars).toBe(120);
  });

  it("starts a new day at midnight in the service's time zone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T06:00:00Z")); // 23:00 on 2 Oct in California
    const id = serviceId("gemini", "k");
    countRequest(id, { tz: PACIFIC });
    expect(dayIn(PACIFIC)).toBe("2026-10-02");
    expect(usageOf(id, PACIFIC).today.requests).toBe(1);
    const mid = nextMidnight(PACIFIC);
    expect(mid.toISOString()).toBe("2026-10-03T07:00:00.000Z"); // midnight PDT = 12:30 pm IST
    vi.setSystemTime(new Date("2026-10-03T07:30:00Z"));
    expect(usageOf(id, PACIFIC).today.requests).toBe(0);
  });
});
