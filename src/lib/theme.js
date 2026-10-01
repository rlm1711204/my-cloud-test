// Turns the one colour in src/brand.js into the shades the app needs, in light and dark mode.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** "#4338ca" or "#43c" -> {r,g,b}. Falls back to the default indigo if the code is mistyped. */
export function parseHex(hex) {
  const h = String(hex || "").trim().replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return { r: 67, g: 56, b: 202 };
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}

export const toHex = ({ r, g, b }) => `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;

/** Blend towards white (amount > 0) or black (amount < 0). */
export function shade(hex, amount) {
  const { r, g, b } = parseHex(hex);
  const t = amount >= 0 ? 255 : 0;
  const k = Math.abs(amount);
  return toHex({ r: r + (t - r) * k, g: g + (t - g) * k, b: b + (t - b) * k });
}

/** Rough brightness (0–255) — used to keep text readable on the chosen colour. */
export const luminance = (hex) => {
  const { r, g, b } = parseHex(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** The CSS variables for one mode. Dark mode lightens the colour so it stays readable. */
export function themeVars(color, dark = false) {
  const base = toHex(parseHex(color));
  if (!dark) {
    return {
      "--primary": base,
      "--primary-ink": luminance(base) > 150 ? "#1d2230" : "#ffffff",
      "--primary-soft": shade(base, 0.88),
    };
  }
  const lifted = luminance(base) < 150 ? shade(base, 0.45) : base;
  return {
    "--primary": lifted,
    "--primary-ink": "#11121a",
    "--primary-soft": shade(base, -0.45),
  };
}

/** Apply the brand colour and name to the page (called once when the app starts). */
export function applyBrand(brand, doc = document) {
  const root = doc.documentElement;
  const media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : null;
  const paint = () => {
    for (const [k, v] of Object.entries(themeVars(brand.color, Boolean(media?.matches)))) root.style.setProperty(k, v);
  };
  paint();
  media?.addEventListener?.("change", paint);
  doc.title = brand.name;
  const head = doc.querySelector(".brand span");
  if (head) head.textContent = brand.name;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", brand.color);
}
