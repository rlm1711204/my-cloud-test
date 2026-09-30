import { beforeEach, describe, expect, it } from "vitest";
import * as store from "../src/lib/store.js";

describe("today's plan", () => {
  beforeEach(() => store.resetAll());

  it("tops up the daily list when words are added later the same day", () => {
    store.addWords([{ word: "abate", meaning: "m" }]);
    let plan = store.todaysPlan();
    expect(plan.wotd).toBeTruthy(); // the only word becomes Word of the Day…
    expect(plan.ids).toHaveLength(0); // …leaving nothing for the list
    store.addWords(["cajole", "obdurate", "sanguine", "laconic"].map((word) => ({ word, meaning: "m" })));
    plan = store.todaysPlan();
    expect(plan.ids).toHaveLength(4);
    expect(plan.ids).not.toContain(plan.wotd);
    const wotd = plan.wotd;
    expect(store.todaysPlan().wotd).toBe(wotd); // Word of the Day stays the same
  });

  it("keeps finished words and removes deleted ones", () => {
    store.addWords(["abate", "cajole", "obdurate", "sanguine"].map((word) => ({ word, meaning: "m" })));
    const plan = store.todaysPlan();
    const [first, second] = plan.ids;
    store.update((s) => (s.daily.done[first] = "good"));
    store.deleteWord(second);
    const next = store.todaysPlan();
    expect(next.ids).toContain(first);
    expect(next.ids).not.toContain(second);
    expect(next.done[first]).toBe("good");
  });
});
