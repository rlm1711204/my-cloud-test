import { describe, expect, it } from "vitest";
import { manualSteps, platform } from "../src/lib/install.js";

describe("install help", () => {
  it("detects where the page is open", () => {
    expect(platform("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36")).toBe("android");
    expect(platform("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36")).toBe("inapp");
    expect(platform("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Instagram 300.0")).toBe("inapp");
    expect(platform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe("ios");
    expect(platform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128 Safari/537.36")).toBe("desktop");
  });

  it("gives matching manual steps", () => {
    expect(manualSteps("android")).toMatch(/Add to Home screen/);
    expect(manualSteps("inapp")).toMatch(/Open in Chrome/);
    expect(manualSteps("ios")).toMatch(/Add to Home Screen/);
  });
});
