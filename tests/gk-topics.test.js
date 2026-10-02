import { describe, expect, it } from "vitest";
import { buildTree, nodeState, toggle } from "../src/lib/gk-topics.js";

const items = [
  { category: "Polity", sub: "Constitution" },
  { category: "Polity", sub: "Parliament" },
  { category: "Polity", sub: "Judiciary" },
  { category: "History", sub: "Modern India" },
  { category: "Current Affairs", year: 2025, sub: "Sports" },
  { category: "Current Affairs", year: 2026, sub: "Sports" },
  { category: "Current Affairs", year: 2026, sub: "Banking & Finance" },
];
const tree = buildTree(items);

describe("practice topic picker", () => {
  it("orders Current Affairs first with the newest year first", () => {
    expect(tree.get("")[0]).toBe("Current Affairs");
    expect(tree.get("Current Affairs")).toEqual(["Current Affairs › 2026", "Current Affairs › 2025"]);
  });

  it("unticks a whole subject, then ticks back a single chapter inside it", () => {
    let ex = toggle("Polity", [], tree);
    expect(ex).toEqual(["Polity"]);
    expect(nodeState("Polity › Parliament", ex)).toBe("off");
    ex = toggle("Polity › Parliament", ex, tree);
    expect(ex).toEqual(["Polity › Constitution", "Polity › Judiciary"]);
    expect(nodeState("Polity", ex)).toBe("some");
    expect(nodeState("Polity › Parliament", ex)).toBe("on");
  });

  it("unticking every chapter is the same as unticking the subject; ticking a partly-ticked node ticks all", () => {
    let ex = toggle("Polity › Constitution", [], tree);
    ex = toggle("Polity › Parliament", ex, tree);
    ex = toggle("Polity › Judiciary", ex, tree);
    expect(ex).toEqual(["Polity"]);
    ex = toggle("Polity › Judiciary", ex, tree); // back on
    expect(nodeState("Polity", ex)).toBe("some");
    expect(toggle("Polity", ex, tree)).toEqual([]);
  });

  it("leaves out one Current Affairs year, or one topic within a year", () => {
    let ex = toggle("Current Affairs › 2025", [], tree);
    expect(nodeState("Current Affairs › 2025 › Sports", ex)).toBe("off");
    expect(nodeState("Current Affairs › 2026 › Sports", ex)).toBe("on");
    ex = toggle("Current Affairs › 2026 › Sports", ex, tree);
    expect(nodeState("Current Affairs", ex)).toBe("some");
  });
});
