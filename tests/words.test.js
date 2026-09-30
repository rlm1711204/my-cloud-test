import { describe, expect, it } from "vitest";
import { baseForms, buildIndex, findExisting, makeWord, mergeWordLists, parseTypedWords, toCSV, wordKey } from "../src/lib/words.js";

describe("wordKey / baseForms", () => {
  it("normalises case, curly quotes and possessives", () => {
    expect(wordKey("  Obdurate’s ")).toBe("obdurate");
    expect(wordKey("Cut  Corners")).toBe("cut corners");
  });
  it("derives likely base forms of inflections", () => {
    expect(baseForms("mitigated")).toContain("mitigate");
    expect(baseForms("abetted")).toContain("abet");
    expect(baseForms("placating")).toContain("placate");
    expect(baseForms("remedies")).toContain("remedy");
    expect(baseForms("candidly")).toContain("candid");
  });
});

describe("findExisting", () => {
  const index = buildIndex([makeWord({ word: "mitigate" }), makeWord({ word: "Sanguine" }), makeWord({ word: "gone", deleted: true })]);
  it("finds exact duplicates regardless of case", () => {
    expect(findExisting("SANGUINE", index)).toMatchObject({ exact: true });
  });
  it("flags inflected forms as similar, not exact", () => {
    expect(findExisting("mitigated", index)).toMatchObject({ exact: false, match: { word: "mitigate" } });
  });
  it("ignores deleted words and unrelated words", () => {
    expect(findExisting("gone", index)).toBeNull();
    expect(findExisting("obdurate", index)).toBeNull();
  });
});

describe("makeWord", () => {
  it("fills defaults and clamps difficulty", () => {
    const w = makeWord({ word: " abate ", difficulty: 9, sentences: ["a", "", "b"] });
    expect(w.word).toBe("abate");
    expect(w.difficulty).toBe(5);
    expect(w.sentences).toEqual(["a", "b"]);
    expect(w.box).toBe(0);
    expect(w.id).toBeTruthy();
  });
});

describe("mergeWordLists", () => {
  it("keeps the newer copy of each word and propagates deletions", () => {
    const old = makeWord({ word: "abate", meaning: "old", updatedAt: "2026-01-01T00:00:00Z" });
    const newer = makeWord({ word: "Abate", meaning: "new", updatedAt: "2026-02-01T00:00:00Z" });
    const del = makeWord({ word: "cajole", deleted: true, updatedAt: "2026-03-01T00:00:00Z" });
    const live = makeWord({ word: "cajole", updatedAt: "2026-01-01T00:00:00Z" });
    const merged = mergeWordLists([old, live], [newer, del]);
    expect(merged).toHaveLength(2);
    expect(merged.find((w) => wordKey(w.word) === "abate").meaning).toBe("new");
    expect(merged.find((w) => wordKey(w.word) === "cajole").deleted).toBe(true);
  });
});

describe("parseTypedWords", () => {
  it("splits on commas/newlines, strips numbering and de-duplicates", () => {
    expect(parseTypedWords("1. obdurate, Sanguine\n- cut corners;\nsanguine\n\n")).toEqual(["obdurate", "Sanguine", "cut corners"]);
  });
});

describe("toCSV", () => {
  it("quotes cells with commas and skips deleted words", () => {
    const csv = toCSV([makeWord({ word: "abate", meaning: "lessen, reduce", sentences: ["x", "y"] }), makeWord({ word: "x", deleted: true })]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"lessen, reduce"');
    expect(lines[1]).toContain("x | y");
  });
});

describe("needsEnrichment", () => {
  it("flags words missing a meaning, Hindi or any example", async () => {
    const { needsEnrichment } = await import("../src/lib/words.js");
    expect(needsEnrichment(makeWord({ word: "a", meaning: "m", hindi: "ह", sentences: ["s"] }))).toBe(false);
    expect(needsEnrichment(makeWord({ word: "a", meaning: "m", sentences: ["s"] }))).toBe(true);
    expect(needsEnrichment(makeWord({ word: "a", meaning: "m", hindi: "ह" }))).toBe(true);
  });
});
