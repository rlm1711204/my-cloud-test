import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let reply = async () => ({ words: [], provider: "Gemini", skipped: [] });
vi.mock("../src/lib/engine.js", async (orig) => ({
  ...(await orig()),
  aiTask: (s, task) => (calls.push(task), reply(task)),
}));

const { RULE_BATCH, looksLikeOneRule, rulesFromFiles, rulesFromText } = await import("../src/lib/grammar-ai.js");
const { AllProvidersFailed } = await import("../src/lib/engine.js");
const S = { exam: "upsc" };
const card = (title) => ({
  title,
  topic: "Prepositions",
  rule: `Rule for ${title}.`,
  hindi: "नियम",
  examples: ["I have lived here since 2015."],
  mistakes: [{ wrong: "I am here since two days.", right: "I have been here for two days.", why: "Period of time: for." }],
  note: "",
  tip: "",
  questions: [{ q: "He has been ill ___ Monday.", options: ["since", "for", "from", "by"], answer: 0, why: "Point of time." }],
  difficulty: 2,
});

beforeEach(() => (calls.length = 0));

describe("grammar AI", () => {
  it("writes a card for one typed rule straight away (no listing step)", async () => {
    reply = async (task) => ({ words: [card("Since and for")], provider: "Gemini", skipped: [] });
    const r = await rulesFromText(S, "Use since for a point of time and for with a period of time.");
    expect(calls).toHaveLength(1);
    expect(calls[0].schema.required).toEqual(["rules"]);
    expect(calls[0].system).toMatch(/UPSC/);
    expect(r).toMatchObject({ usedBy: ["Gemini"], failed: 0 });
    expect(r.rules[0]).toMatchObject({ title: "Since and for", topic: "Prepositions" });
  });

  it("lists rules in longer notes first, then writes cards in batches", async () => {
    const titles = Array.from({ length: RULE_BATCH + 2 }, (_, i) => `Rule ${i + 1}`);
    reply = async (task) =>
      task.schema.properties.rules.items.required.length === 2
        ? { words: titles.map((t) => ({ title: t, text: `${t} text` })), provider: "Groq", skipped: [] }
        : { words: task.text.split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => card(l.replace(/^\d+\. /, "").split(" — ")[0])), provider: "Groq", skipped: [] };
    const r = await rulesFromText(S, "1. a\n2. b\n\n3. c");
    expect(calls).toHaveLength(3); // list + 2 batches
    expect(r.rules.map((x) => x.title)).toEqual(titles);
    expect(r.usedBy).toEqual(["Groq"]);
  });

  it("saves a rule the AI keeps leaving out as written, and says so", async () => {
    let step = 0;
    reply = async (task) => {
      step += 1;
      if (step === 1) return { words: [{ title: "Since and for", text: "since/for" }, { title: "Lest", text: "lest + should" }], provider: "Gemini", skipped: [] };
      return { words: [card("Since and for")], provider: "Gemini", skipped: [] }; // never returns "Lest"
    };
    const r = await rulesFromFiles(S, [{ kind: "image", name: "p.jpg", mediaType: "image/jpeg", data: "x" }], "p.jpg");
    expect(calls).toHaveLength(3); // list, cards, retry for the missing one
    expect(r.failed).toBe(1);
    expect(r.rules.map((x) => x.title)).toEqual(["Since and for", "Lest"]);
    expect(r.rules[1].rule).toBe("lest + should");
    expect(r.notes.join(" ")).toMatch(/left out 1 rule/);
  });

  it("throws when no AI can read the material, so the app can fall back", async () => {
    reply = async () => {
      throw new AllProvidersFailed([{ name: "Gemini", reason: "limit reached" }]);
    };
    await expect(rulesFromFiles(S, [{ kind: "image", name: "p", mediaType: "image/jpeg", data: "x" }], "p")).rejects.toBeInstanceOf(AllProvidersFailed);
  });

  it("tells a single rule from a list", () => {
    expect(looksLikeOneRule("Each takes a singular verb.")).toBe(true);
    expect(looksLikeOneRule("1. Each takes a singular verb.\n2. Use an before vowels.")).toBe(false);
    expect(looksLikeOneRule("Rule one.\n\nRule two.")).toBe(false);
  });
});
