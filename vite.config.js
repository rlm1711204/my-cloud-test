import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { brand } from "./src/brand.js";
import { buildBrandFiles } from "./scripts/brand-build.mjs";

const sha = (() => {
  try {
    return (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString()).trim().slice(0, 7);
  } catch {
    return "dev";
  }
})();
// Shown in Settings so it's easy to check which version the phone is running.
const version = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${sha}`;

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Puts the name, tagline and colour from src/brand.js into the page, the icon and the manifest. */
const brandPlugin = () => ({
  name: "vocabvault-brand",
  buildStart: () => buildBrandFiles(brand),
  // The open app compares this with its own version to know when to reload (see src/lib/update.js).
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version }) });
  },
  transformIndexHtml: (html) =>
    html
      .replace(/%BRAND_NAME%/g, escAttr(brand.name))
      .replace(/%BRAND_TAGLINE%/g, escAttr(brand.tagline))
      .replace(/%BRAND_COLOR%/g, escAttr(brand.color)),
});

// Relative base so the build works on GitHub Pages (served from /<repo>/) and locally.
export default defineConfig({
  base: "./",
  plugins: [brandPlugin()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
