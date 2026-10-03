import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let reply = async () => ({ words: [], provider: "Gemini", skipped: [] });
vi.mock("../src/lib/engine.js", async (orig) => ({ ...(await orig()), aiTask: (s, task) => (calls.push(task), reply(task)) }));

const { areaNotes } = await import("../src/lib/area-ai.js");
const { AllProvidersFailed } = await import("../src/lib/engine.js");
const gk = await import("../src/lib/gk-store.js");
const { makePlace } = await import("../src/lib/area.js");
const place = makePlace({ town: "Ambasamudram", district: "Tirunelveli", state: "Tamil Nadu", country: "India" });
const note = (section, exam, n) => ({ section, exam, note: `${["", "Chola inscriptions were found", "Pandya rulers built temples", "The taluk office opened"][n]} near Ambasamudram`, q: `Question ${section} ${n}?`, a: `Answer ${n}`, options: ["x", "y", "z"], year: 0 });

beforeEach(() => {
  calls.length = 0;
  gk.resetAll();
});

describe("My Area with AI", () => {
  it("writes a level in two requests and keeps one group when the other fails", async () => {
    reply = async (task) => {
      if (/Geography & Rivers/.test(task.text)) throw new AllProvidersFailed([{ name: "Gemini", reason: "limit" }]);
      return { words: [note("History", "UPSC", 1), note("History", "SSC", 2), note("Polity & Governance", "RBI", 3)], provider: "Gemini", skipped: [] };
    };
    const r = await areaNotes({}, place, "local");
    expect(calls).toHaveLength(2);
    expect(calls[0].schema.properties.items.items.required).toContain("exam");
    expect(r.notes.map((n) => `${n.section}/${n.exam}`)).toEqual(["History/SSC", "History/UPSC", "Polity & Governance/RBI"]);
    expect(r.provider).toBe("Gemini");
    expect(r.messages.join(" ")).toMatch(/Remake/);

    reply = async () => {
      throw new AllProvidersFailed([{ name: "Gemini", reason: "no key" }]);
    };
    await expect(areaNotes({}, place, "district")).rejects.toBeInstanceOf(AllProvidersFailed);
  });

  it("saves places and notes, and they travel with the GK backup without duplicates", () => {
    const a = gk.saveAreaPlace(place);
    expect(gk.saveAreaPlace({ ...place }).id).toBe(a.id); // the same place again
    gk.setAreaNotes(a.id, "state", [note("History", "SSC", 1)], "Gemini");
    const backup = JSON.parse(JSON.stringify(gk.exportData()));
    gk.resetAll();
    expect(gk.currentArea()).toBeNull();
    gk.importData(backup);
    gk.importData(backup);
    expect(gk.get().areas).toHaveLength(1);
    expect(gk.currentArea().levels.state.notes).toHaveLength(1);
    gk.editAreaPlace(a.id, { ...place, state: "Kerala" });
    expect(gk.currentArea().levels.state).toBeUndefined(); // notes of a renamed level are dropped
    gk.showArea("__new__");
    expect(gk.currentArea()).toBeNull();
    gk.deleteArea(a.id);
    expect(gk.get().areas).toHaveLength(0);
  });

  it("a new place in the same state starts with the state and region notes; a saved district is recognised", () => {
    const home = gk.saveAreaPlace(place, { ...place, local: "Vasantha Nagar" });
    gk.setAreaNotes(home.id, "state", [note("History", "SSC", 1)], "Gemini");
    gk.setAreaNotes(home.id, "region", [note("History", "UPSC", 2)], "Gemini");
    gk.setAreaNotes(home.id, "district", [note("History", "RBI", 3)], "Gemini");
    const madurai = makePlace({ town: "Madurai", district: "Madurai", state: "Tamil Nadu", country: "India", area: "Anna Nagar" });
    const m = gk.saveAreaPlace(madurai, madurai);
    expect(m.id).not.toBe(home.id);
    expect(Object.keys(m.levels).sort()).toEqual(["region", "state"]); // Madurai's town and district still to write
    expect(m.levels.state.notes[0].note).toMatch(/Chola/);
    expect(gk.currentArea().id).toBe(m.id);
    expect(gk.areaInDistrict({ district: "tirunelveli", state: "Tamil Nadu" }).id).toBe(home.id);
    expect(gk.areaInDistrict({ district: "Madurai", state: "Tamil Nadu" }).id).toBe(m.id);
    expect(gk.areaInDistrict({ district: "Theni", state: "Tamil Nadu" })).toBeNull();
    // Changing the copy for one place doesn't change the other's.
    gk.setAreaNotes(m.id, "state", [], "x");
    expect(gk.get().areas.find((a) => a.id === home.id).levels.state.notes).toHaveLength(1);
  });
});
