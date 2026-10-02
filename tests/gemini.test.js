import { describe, expect, it } from "vitest";
import { RESULT_SCHEMA } from "../src/lib/ai.js";
import { rankModels, readResponse, suggestedModels, toGeminiSchema } from "../src/lib/gemini.js";

describe("toGeminiSchema", () => {
  it("upper-cases types, drops additionalProperties, keeps required + ordering", () => {
    const g = toGeminiSchema(RESULT_SCHEMA);
    expect(g.type).toBe("OBJECT");
    expect(g.additionalProperties).toBeUndefined();
    const item = g.properties.words.items;
    expect(item.type).toBe("OBJECT");
    expect(item.additionalProperties).toBeUndefined();
    expect(item.properties.sentences).toMatchObject({ type: "ARRAY", items: { type: "STRING" } });
    expect(item.properties.difficulty.type).toBe("INTEGER");
    expect(item.required).toContain("hindi");
    expect(item.propertyOrdering).toEqual(item.required);
    expect(JSON.stringify(g)).not.toContain("additionalProperties");
  });
});

describe("rankModels", () => {
  it("prefers the newest Flash (stable before preview of the same version), then Lite; skips special variants", () => {
    const models = [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-3-flash-preview",
      "gemini-2.0-flash-001",
      "gemini-2.5-flash-image",
      "gemini-2.5-flash-preview-tts",
      "gemini-live-2.5-flash",
      "text-embedding-004",
    ].map((id) => ({ name: `models/${id}`, supportedGenerationMethods: ["generateContent"] }));
    expect(rankModels(models)).toEqual(["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-2.5-flash-lite"]);
    const v35 = ["gemini-3.5-flash-preview", "gemini-3.5-flash", "gemini-3.5-flash-lite"].map((id) => ({ name: `models/${id}` }));
    expect(rankModels(v35)).toEqual(["gemini-3.5-flash", "gemini-3.5-flash-preview", "gemini-3.5-flash-lite"]);
    // "-latest" aliases always point at Google's newest model, so they come first.
    const withAlias = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-flash"].map((id) => ({ name: `models/${id}` }));
    expect(rankModels(withAlias)).toEqual(["gemini-flash-latest", "gemini-3.5-flash", "gemini-flash-lite-latest"]);
  });
  it("ignores models that can't generate content", () => {
    expect(rankModels([{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["embedContent"] }])).toEqual([]);
  });
});

describe("readResponse", () => {
  const ok = (text, finishReason = "STOP") => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });
  it("parses the JSON words array, skipping thought parts", () => {
    const json = { candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "hmm" }, { text: '{"words":[{"word":"abate"}]}' }] } }] };
    expect(readResponse(json)).toEqual([{ word: "abate" }]);
  });
  it("recovers JSON wrapped in a code fence", () => {
    expect(readResponse(ok('```json\n{"words":[{"word":"x"}]}\n```'))).toEqual([{ word: "x" }]);
  });
  it("reports truncation, blocks and empty answers", () => {
    expect(() => readResponse(ok("{", "MAX_TOKENS"))).toThrow(/too many words/);
    expect(() => readResponse({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(/blocked/);
    expect(() => readResponse({ candidates: [] })).toThrow(/no answer/);
  });
});

describe("suggestedModels", () => {
  it("reads the replacement Google names in a 404", () => {
    const msg = "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features.";
    expect(suggestedModels(msg, "gemini-2.5-flash-lite")).toEqual(["gemini-3.5-flash-lite"]);
    expect(suggestedModels("", "x")).toEqual([]);
  });
});
