import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let reply = async () => ({ words: [], provider: "Gemini", skipped: [] });
vi.mock("../src/lib/engine.js", async (orig) => ({ ...(await orig()), aiTask: (s, task) => (calls.push(task), reply(task)) }));

const { gkFromFiles, gkFromText, gkFromTopic } = await import("../src/lib/gk-ai.js");
const { AllProvidersFailed } = await import("../src/lib/engine.js");
const S = { exam: "rbi" };
const isList = (task) => task.schema.properties.items.items.required.length === 3;
const card = (q, a, extra = {}) => ({ q, a, options: ["W1", "W2", "W3"], explain: "Because.", trick: "Remember it.", category: "Static GK", sub: "Countries, Capitals & Currencies", year: 0, month: 0, difficulty: 2, aiAnswered: false, ...extra });

beforeEach(() => (calls.length = 0));

describe("GK AI", () => {
  it("reads typed Q/A locally and only asks the AI to complete the cards", async () => {
    reply = async (task) => ({ words: [card("Capital of Japan?", "Tokyo"), card("Who wrote Godan?", "Premchand", { category: "Static GK", sub: "Books & Authors" })], provider: "Gemini", skipped: [] });
    const r = await gkFromText(S, "Capital of Japan? Tokyo\nWho wrote Godan? Premchand");
    expect(calls).toHaveLength(1);
    expect(isList(calls[0])).toBe(false);
    expect(calls[0].system).toMatch(/RBI/);
    expect(r.items.map((i) => [i.q, i.a, i.sub, i.trick])).toEqual([
      ["Capital of Japan?", "Tokyo", "Countries, Capitals & Currencies", "Remember it."],
      ["Who wrote Godan?", "Premchand", "Books & Authors", "Remember it."],
    ]);
    expect(r.items[0].options).toEqual(["W1", "W2", "W3"]);
  });

  it("turns current-affairs notes into questions filed under the year", async () => {
    reply = async (task) =>
      isList(task)
        ? { words: [{ q: "Who was appointed X in 2026?", a: "Y", options: [] }], provider: "Groq", skipped: [] }
        : { words: [card("Who was appointed X in 2026?", "Y", { category: "Current Affairs", sub: "Appointments", year: 2026, month: 3 })], provider: "Groq", skipped: [] };
    const notes =
      "In March 2026, Y was appointed as X. The appointment was announced by the ministry after a long selection process.\n" +
      "Several candidates from the banking sector and public life were considered.\n" +
      "The term is for three years, and the post was vacant for two months before the appointment was made.\n" +
      "Y earlier headed a large public-sector bank.";
    const r = await gkFromText(S, notes);
    expect(calls.map(isList)).toEqual([true, false]);
    expect(r.items[0]).toMatchObject({ category: "Current Affairs", year: 2026, month: 3, sub: "Appointments" });
  });

  it("marks answers the AI supplied, retries left-out questions once, and keeps the rest as written", async () => {
    let step = 0;
    reply = async (task) => {
      step += 1;
      if (step === 1) return { words: [{ q: "Who founded the INC?", a: "", options: [] }, { q: "Odd question", a: "Z", options: [] }], provider: "Gemini", skipped: [] };
      return { words: [card("Who founded the INC?", "A. O. Hume", { category: "History", sub: "Modern India" })], provider: "Gemini", skipped: [] };
    };
    const r = await gkFromFiles(S, [{ kind: "image", name: "p.jpg", mediaType: "image/jpeg", data: "x" }], "p.jpg");
    expect(calls).toHaveLength(3); // list, cards, retry
    expect(r.items[0]).toMatchObject({ a: "A. O. Hume", aiAnswered: true, category: "History" });
    expect(r.items[1]).toMatchObject({ q: "Odd question", a: "Z" });
    expect(r.failed).toBe(1);
  });

  it("throws when no AI can read the material, so the app can fall back", async () => {
    reply = async () => {
      throw new AllProvidersFailed([{ name: "Gemini", reason: "limit" }]);
    };
    await expect(gkFromFiles(S, [{ kind: "image", name: "p", mediaType: "image/jpeg", data: "x" }], "p")).rejects.toBeInstanceOf(AllProvidersFailed);
  });
});

describe("GK AI: questions on a topic", () => {
  const isPlan = (task) => "point" in task.schema.properties.items.items.properties;
  const pointsOf = (task) => [...task.text.matchAll(/^- (.+) \((\d)\)$/gm)].map((m) => [m[1], Number(m[2])]);

  it("covers EVERY item of a range: Articles 124 to 147 → one point per Article, written in batches", async () => {
    reply = async (task) => {
      if (isPlan(task)) {
        expect(task.text).toMatch(/EVERY item from 124 to 147 as its own point \(24 points\)/);
        const pts = Array.from({ length: 24 }, (_, i) => ({ point: `Article ${124 + i}`, questions: 1 }));
        return { words: [...pts, { point: "Overview: Part V Chapter IV", questions: 3 }], provider: "Gemini", skipped: [] };
      }
      const words = pointsOf(task).flatMap(([p, n]) =>
        Array.from({ length: n }, (_, k) => card(`What does ${p} provide for (fact ${k + 1})?`, `${p} answer ${k + 1}`, { category: "Polity", sub: "Judiciary" })),
      );
      return { words, provider: "Gemini", skipped: [] };
    };
    const r = await gkFromTopic(S, "Articles 124 to 147", "auto", null);
    const asked = calls.filter((t) => !isPlan(t)).flatMap(pointsOf).map(([p]) => p);
    for (let a = 124; a <= 147; a++) expect(asked).toContain(`Article ${a}`);
    expect(calls.filter((t) => !isPlan(t)).every((t) => pointsOf(t).reduce((n, [, k]) => n + k, 0) <= 12)).toBe(true);
    expect(r.items.length).toBe(27);
    expect(r.items.every((i) => i.category === "Polity" && i.sub === "Judiciary" && !i.aiAnswered)).toBe(true);
    expect(r.notes.join(" ")).toMatch(/27 questions .* covering 25 of 25 points/);
  });

  it("with a set number, groups neighbouring items so none is dropped", async () => {
    reply = async (task) =>
      isPlan(task)
        ? { words: Array.from({ length: 24 }, (_, i) => ({ point: `Article ${124 + i}`, questions: 1 })), provider: "Gemini", skipped: [] }
        : { words: pointsOf(task).map(([p]) => card(`About ${p}?`, p)), provider: "Gemini", skipped: [] };
    const r = await gkFromTopic(S, "Articles 124 to 147", "10", null);
    expect(calls[0].text).toMatch(/group neighbouring items/);
    const pts = calls.slice(1).flatMap(pointsOf).map(([p]) => p);
    expect(pts).toHaveLength(8); // 24 Articles, 3 per question
    expect(pts.join(" / ")).toContain("Article 147");
    expect(r.items).toHaveLength(8);
  });

  it("a typed topic or one sentence gets a full set; a pasted answer is read with no AI call", async () => {
    reply = async (task) =>
      isPlan(task)
        ? { words: [{ point: "Harappan towns", questions: 2 }, { point: "Harappan seals", questions: 1 }], provider: "Gemini", skipped: [] }
        : { words: [card("Which Harappan site had a dockyard?", "Lothal"), card("Great Bath was found at?", "Mohenjo-daro"), card("Harappan seals were mostly made of?", "Steatite")], provider: "Gemini", skipped: [] };
    const r = await gkFromText(S, "Harappan civilisation");
    expect(calls.map(isPlan)).toEqual([true, false]);
    expect(r.items).toHaveLength(3);

    calls.length = 0;
    const pasted = "## History › Ancient India\nQ: Which Harappan site had a dockyard?\nA: Lothal\nO: Kalibangan; Banawali; Dholavira\nE: In Gujarat.\nT: Lothal = Loads of boats.\n\nQ: Who discovered Harappa?\nA: Daya Ram Sahni";
    reply = async () => ({ words: [card("Who discovered Harappa?", "Daya Ram Sahni", { category: "History", sub: "Ancient India" })], provider: "Gemini", skipped: [] });
    const p = await gkFromText(S, pasted);
    expect(calls).toHaveLength(1); // only the incomplete second question goes to the AI
    expect(p.items[0]).toMatchObject({ q: "Which Harappan site had a dockyard?", a: "Lothal", category: "History", sub: "Ancient India", trick: "Lothal = Loads of boats." });
    expect(p.items[1]).toMatchObject({ a: "Daya Ram Sahni", trick: "Remember it." });
  });

  it("keeps what was written when the AI stops part-way, and says what is missing", async () => {
    let n = 0;
    reply = async (task) => {
      if (isPlan(task)) return { words: Array.from({ length: 20 }, (_, i) => ({ point: `Point p${i}`, questions: 1 })), provider: "Gemini", skipped: [] };
      if ((n += 1) > 1) throw new AllProvidersFailed([{ name: "Gemini", reason: "limit" }]);
      return { words: pointsOf(task).map(([p]) => card(`Q on ${p}?`, p)), provider: "Gemini", skipped: [] };
    };
    const r = await gkFromTopic(S, "Some topic", "auto", null);
    expect(r.items).toHaveLength(12);
    expect(r.notes.join(" ")).toMatch(/8 point\(s\) were not covered/);
  });
});
