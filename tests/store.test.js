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

describe("backup restore", () => {
  beforeEach(() => store.resetAll());

  it("reports what was restored and brings back study preferences", () => {
    store.addWords(["abate", "cajole", "obdurate"].map((word) => ({ word, meaning: "m" })));
    store.update((s) => {
      s.settings.dailySource = "mixed";
      s.settings.dailyCount = 15;
      s.settings.geminiKeys = ["secret-key-should-not-travel"];
    });
    const backup = JSON.parse(JSON.stringify(store.exportData()));
    expect(JSON.stringify(backup)).not.toContain("secret-key");

    store.resetAll();
    store.update((s) => (s.settings.dailySource = "mine"));
    store.addWords([{ word: "abate", meaning: "m" }, { word: "laconic", meaning: "m" }]);
    const r = store.importData(backup, { applyPrefs: true });
    expect(r).toMatchObject({ inBackup: 3, added: 2, prefsApplied: true });
    expect(store.liveWords()).toHaveLength(4);
    expect(store.get().settings.dailySource).toBe("mixed");
    expect(store.get().settings.dailyCount).toBe(15);
  });

  it("leaves preferences alone for a Drive sync", () => {
    store.update((s) => (s.settings.dailySource = "bank"));
    const payload = { ...store.exportData(), prefs: { dailySource: "mine" } };
    store.importData(payload);
    expect(store.get().settings.dailySource).toBe("bank");
  });
});
