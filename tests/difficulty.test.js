import { beforeAll, describe, expect, it } from "vitest";
import { candidatesFromText, isEasy, loadLevels } from "../src/lib/difficulty.js";

let levels;
beforeAll(async () => {
  levels = await loadLevels();
});

describe("offline difficulty filter", () => {
  it("treats everyday words as easy and exam words as hard", () => {
    for (const w of ["government", "important", "increased", "beautiful"]) expect(isEasy(w, levels)).toBe(true);
    for (const w of ["obdurate", "ameliorate", "cajoled", "perfunctory"]) expect(isEasy(w, levels)).toBe(false);
  });
  it("extracts only difficult words from a passage, with context", () => {
    const text =
      "The government's perfunctory response did little to ameliorate the crisis. " +
      "Officials remained obdurate, while critics cajoled them to act. Rahul Sharma visited Tirunelveli.";
    const out = candidatesFromText(text, levels).map((c) => c.word);
    expect(out).toEqual(expect.arrayContaining(["perfunctory", "ameliorate", "obdurate", "cajoled"]));
    for (const easy of ["government", "response", "crisis", "officials", "visited", "rahul", "tirunelveli"]) expect(out).not.toContain(easy);
    const c = candidatesFromText(text, levels).find((x) => x.word === "obdurate");
    expect(c.context).toMatch(/Officials remained obdurate/);
  });
  it("re-joins words hyphenated across OCR line breaks", () => {
    const out = candidatesFromText("a truly perfunc-\ntory reply", levels).map((c) => c.word);
    expect(out).toContain("perfunctory");
  });
});
