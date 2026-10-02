/**
 * Builds the app icon and the phone manifest from src/brand.js.
 * Runs automatically on `npm run dev` and `npm run build` — nothing to do by hand.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brand as defaultBrand } from "../src/brand.js";
import { luminance, shade } from "../src/lib/theme.js";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The app icon as SVG: either the open book, or your own letters on a coloured tile. */
export function iconSvg(brand) {
  const { color, accent } = brand;
  const star = `<circle cx="392" cy="128" r="40" fill="${esc(accent)}"/>
  <path d="M392 104l7 16 17 2-13 11 4 17-15-9-15 9 4-17-13-11 17-2z" fill="#fff"/>`;
  if (brand.iconStyle === "letters") {
    const letters = String(brand.iconLetters || brand.shortName || "V").trim().slice(0, 2).toUpperCase();
    const ink = luminance(color) > 150 ? "#1d2230" : "#ffffff";
    // Kept inside the middle 60% so Android's circular crop never cuts the letters.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${esc(color)}"/>
  <text x="256" y="256" fill="${ink}" font-family="DejaVu Sans, Verdana, Arial, Helvetica, sans-serif" font-weight="700"
        font-size="${letters.length > 1 ? 190 : 260}" text-anchor="middle" dominant-baseline="central">${esc(letters)}</text>
  ${star}
</svg>
`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${esc(color)}"/>
  <path d="M120 136c46-18 94-18 136 10 42-28 90-28 136-10v240c-46-18-94-18-136 10-42-28-90-28-136-10z" fill="#fff" opacity=".96"/>
  <path d="M256 146v240" stroke="${esc(color)}" stroke-width="12"/>
  <path d="M164 214l28 64 28-64M292 214l28 64 28-64" stroke="${esc(color)}" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  ${star}
</svg>
`;
}

/** What Android reads when the app is installed to the home screen. */
export const manifestJson = (brand) => ({
  id: "./",
  name: brand.name,
  short_name: brand.shortName || brand.name,
  description: brand.tagline,
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: shade(brand.color, 0.95),
  theme_color: brand.color,
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
  ],
});

/** Write icon.svg + manifest, and redraw the PNG icons when the drawing tool is available. */
export async function buildBrandFiles(brand = defaultBrand, dir = PUBLIC_DIR) {
  mkdirSync(dir, { recursive: true });
  const svg = iconSvg(brand);
  writeFileSync(join(dir, "icon.svg"), svg);
  writeFileSync(join(dir, "manifest.webmanifest"), `${JSON.stringify(manifestJson(brand), null, 2)}\n`);
  try {
    const { default: sharp } = await import("sharp");
    for (const size of [192, 512]) {
      const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
      writeFileSync(join(dir, `icon-${size}.png`), png);
    }
  } catch (e) {
    // No image tool here: keep the icon-192/512.png files already in the repo.
    console.warn(`[brand] Home-screen PNG icons were left unchanged (${e.message.split("\n")[0]}).`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await buildBrandFiles();
