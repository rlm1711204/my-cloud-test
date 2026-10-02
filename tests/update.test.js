import { afterEach, describe, expect, it, vi } from "vitest";
import { isStaleFileError, reloadForUpdate, takeDraft } from "../src/lib/update.js";

afterEach(() => vi.unstubAllGlobals());

describe("staying on the newest version", () => {
  it("recognises 'file from an old version' errors in every browser's wording", () => {
    expect(isStaleFileError("Failed to fetch dynamically imported module: https://x/assets/src-BmSLl9Z4.js")).toBe(true);
    expect(isStaleFileError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isStaleFileError("error loading dynamically imported module")).toBe(true);
    expect(isStaleFileError("Gemini free limit reached for now.")).toBe(false);
  });

  it("reloads once, keeps the typed words, and never loops", () => {
    const store = new Map();
    vi.stubGlobal("sessionStorage", { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    expect(reloadForUpdate({ typed: "obdurate, sanguine" }, 1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForUpdate({ typed: "x" }, 1_010_000)).toBe(false); // 10 s later: don't loop
    const { draft } = takeDraft();
    expect(draft).toEqual({ typed: "obdurate, sanguine" });
    expect(takeDraft().draft).toBeNull(); // given back only once
  });
});
