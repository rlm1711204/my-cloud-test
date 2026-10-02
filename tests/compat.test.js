import { afterEach, describe, expect, it, vi } from "vitest";
import { compatEnrich, compatList, parseWords, rankCompatModels, sizeOf, testService } from "../src/lib/compat.js";

afterEach(() => vi.unstubAllGlobals());

describe("rankCompatModels", () => {
  const openrouter = [
    { id: "openai/gpt-5", pricing: { prompt: "0.000005", completion: "0.00002" } },
    { id: "meta-llama/llama-3.3-70b-instruct:free", context_length: 131072, architecture: { input_modalities: ["text"] } },
    { id: "deepseek/deepseek-chat-v3:free", context_length: 163840, architecture: { input_modalities: ["text"] } },
    { id: "qwen/qwen2.5-vl-7b-instruct:free", architecture: { input_modalities: ["text", "image"] } },
    { id: "mistralai/mistral-7b-instruct:free", architecture: { input_modalities: ["text"] } },
  ];

  it("keeps only free models on OpenRouter and puts strong, large ones first", () => {
    const r = rankCompatModels(openrouter, { provider: "openrouter" });
    expect(r).not.toContain("openai/gpt-5");
    expect(r.slice(0, 2)).toEqual(["meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-chat-v3:free"]);
    expect(r).toHaveLength(4); // the two small 7B models follow, in either order
  });

  it("offers only picture-reading models when a photo is involved", () => {
    expect(rankCompatModels(openrouter, { provider: "openrouter", needVision: true })).toEqual(["qwen/qwen2.5-vl-7b-instruct:free"]);
    const groq = ["whisper-large-v3", "llama-3.1-8b-instant", "meta-llama/llama-4-scout-17b-16e-instruct", "llama-guard-4-12b"].map((id) => ({ id }));
    expect(rankCompatModels(groq, { provider: "groq", needVision: true })).toEqual(["meta-llama/llama-4-scout-17b-16e-instruct"]);
    expect(rankCompatModels(groq, { provider: "groq" })).not.toContain("whisper-large-v3");
    expect(rankCompatModels(groq, { provider: "groq" })).not.toContain("llama-guard-4-12b");
  });

  it("reads model sizes from names", () => {
    expect(sizeOf("llama-3.3-70b-versatile")).toBe(70);
    expect(sizeOf("mixtral-8x22b")).toBe(176);
    expect(sizeOf("deepseek-chat")).toBe(0);
  });
});

describe("parseWords", () => {
  it("accepts plain JSON, fenced JSON, text around JSON, and a bare array", () => {
    expect(parseWords('{"words":[{"word":"abate"}]}')).toEqual([{ word: "abate" }]);
    expect(parseWords('```json\n{"words":[{"word":"abate"}]}\n```')).toEqual([{ word: "abate" }]);
    expect(parseWords('Here you go: {"words":[{"word":"abate"}]} Hope it helps')).toEqual([{ word: "abate" }]);
    expect(parseWords('[{"word":"abate"}]')).toEqual([{ word: "abate" }]);
    expect(() => parseWords("sorry, I can't")).toThrow();
  });
});

describe("calling a service", () => {
  const S = { exam: "general" };
  const reply = (content, finish = "stop") => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: finish, message: { content } }] }) });
  const fail = (status, message = "x") => ({ ok: false, status, json: async () => ({ error: { message } }), clone() { return fail(status, message); } });
  const models = (ids) => ({ ok: true, status: 200, json: async () => ({ data: ids.map((id) => ({ id })) }) });

  it("skips a retired model, retries without the JSON switch when it's refused, and sends the key", async () => {
    const posts = [];
    vi.stubGlobal("fetch", async (url, opts) => {
      expect(opts.headers.Authorization).toBe("Bearer gsk_test_key_123456");
      if (url.endsWith("/models")) return models(["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]);
      const body = JSON.parse(opts.body);
      posts.push(`${body.model}${body.response_format ? "+json" : ""}`);
      if (body.model === "llama-3.3-70b-versatile") return fail(404, "The model has been decommissioned");
      if (body.response_format) return fail(400, "response_format json_object is not supported");
      return reply('{"words":[{"word":"abate","meaning":"lessen"}]}');
    });
    const entry = { id: "a", provider: "groq", key: "gsk_test_key_123456", model: "auto" };
    const res = await compatEnrich(S, entry, ["abate"], [], () => {});
    expect(res.words).toEqual([{ word: "abate", meaning: "lessen" }]);
    expect(posts).toEqual(["llama-3.3-70b-versatile+json", "llama-3.1-8b-instant+json", "llama-3.1-8b-instant"]);
  });

  it("reports a rejected key clearly", async () => {
    vi.stubGlobal("fetch", async () => fail(401, "Invalid API Key"));
    const r = await testService({ id: "b", provider: "groq", key: "gsk_bad_key_000000000" });
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/didn't accept the key/) });
  });

  it("explains when the service can't be reached from a browser", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const r = await testService({ id: "c", provider: "cerebras", key: "csk_blocked_00000000" });
    expect(r.message).toMatch(/may not allow apps that run in a browser/);
  });

  it("sends photos only to a model that can read them", async () => {
    const used = [];
    vi.stubGlobal("fetch", async (url, opts) => {
      if (url.endsWith("/models")) return models(["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct"]);
      const body = JSON.parse(opts.body);
      used.push(body.model);
      expect(body.messages[1].content.some((c) => c.type === "image_url")).toBe(true);
      return reply('{"words":[{"word":"abate","context":""}]}');
    });
    const entry = { id: "d", provider: "groq", key: "gsk_vision_key_1234567", model: "auto" };
    const res = await compatList(S, entry, [{ kind: "image", name: "p.jpg", mediaType: "image/jpeg", data: "AAAA" }], () => {});
    expect(res.words[0].word).toBe("abate");
    expect(used).toEqual(["meta-llama/llama-4-scout-17b-16e-instruct"]);
  });

  it("says so when a service has no free model that can read photos", async () => {
    vi.stubGlobal("fetch", async (url) => (url.endsWith("/models") ? models(["llama3.1-8b", "qwen-3-32b"]) : reply("{}")));
    const entry = { id: "e", provider: "cerebras", key: "csk_text_only_key_123", model: "auto" };
    await expect(compatList(S, entry, [{ kind: "image", name: "p.jpg", mediaType: "image/jpeg", data: "AAAA" }])).rejects.toMatchObject({
      cantRead: true,
    });
  });
});
