import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let reply = async () => ({ words: [], provider: "Gemini", skipped: [] });
vi.mock("../src/lib/engine.js", async (orig) => ({ ...(await orig()), aiTask: (s, task) => (calls.push(task), reply(task)) }));

const { gkFromFiles, gkFromText } = await import("../src/lib/gk-ai.js");
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
    const notes = "In March 2026, Y was appointed as X. The appointment was announced by the ministry after a long selection process involving several candidates from the banking sector and public life.";
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
