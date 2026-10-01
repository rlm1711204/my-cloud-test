import { describe, expect, it } from "vitest";
import { brand } from "../src/brand.js";
import { luminance, parseHex, shade, themeVars } from "../src/lib/theme.js";
import { iconSvg, manifestJson } from "../scripts/brand-build.mjs";

describe("brand settings", () => {
  it("has every field the app reads", () => {
    for (const k of ["name", "shortName", "tagline", "madeBy", "color", "accent", "iconStyle", "iconLetters"]) {
      expect(typeof brand[k], `brand.${k}`).toBe("string");
    }
    expect(brand.name.trim()).not.toBe("");
    expect(brand.color).toMatch(/^#[0-9a-f]{3,6}$/i);
  });

  it("survives a mistyped colour instead of breaking the app", () => {
    expect(parseHex("oops")).toEqual(parseHex("#4338ca"));
    expect(parseHex("#43c")).toEqual(parseHex("#4433cc"));
  });

  it("keeps text readable on light and dark backgrounds", () => {
    expect(themeVars("#111111")["--primary-ink"]).toBe("#ffffff");
    expect(themeVars("#ffe066")["--primary-ink"]).toBe("#1d2230");
    expect(luminance(themeVars("#1a1a8c", true)["--primary"])).toBeGreaterThan(luminance("#1a1a8c"));
    expect(shade("#000000", 1)).toBe("#ffffff");
  });
});

describe("generated icon and manifest", () => {
  const sample = { ...brand, name: "RamVocab", shortName: "RamVocab", color: "#0f766e", iconStyle: "letters", iconLetters: "rv" };

  it("draws the chosen letters in the chosen colour", () => {
    const svg = iconSvg(sample);
    expect(svg).toContain("#0f766e");
    expect(svg).toContain(">RV<"); // upper-cased for the icon
    expect(iconSvg({ ...sample, iconStyle: "book" })).toContain("M120 136c46-18");
  });

  it("names the installed app from the settings file", () => {
    const m = manifestJson(sample);
    expect(m).toMatchObject({ name: "RamVocab", short_name: "RamVocab", theme_color: "#0f766e" });
    expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("escapes anything that would break the page", () => {
    expect(iconSvg({ ...sample, iconLetters: '"<' })).not.toContain('>"<<');
  });
});
