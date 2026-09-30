import { execSync } from "node:child_process";
import { defineConfig } from "vite";

const sha = (() => {
  try {
    return (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString()).trim().slice(0, 7);
  } catch {
    return "dev";
  }
})();
// Shown in Settings so it's easy to check which version the phone is running.
const version = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${sha}`;

// Relative base so the build works on GitHub Pages (served from /<repo>/) and locally.
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
