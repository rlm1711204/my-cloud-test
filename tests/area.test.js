import { describe, expect, it } from "vitest";
import {
  AREA_SCHEMA, SECTION_NAMES, areaInstruction, buildAreaPrompt, cleanNotes, levelsOf, makePlace, notesToGkInputs,
  placeFromBigDataCloud, placeFromNominatim, placeFromText, placeTrail, readAreaNotes, regionOf, sectionGroups, sectionOf,
} from "../src/lib/area.js";
import { makeItem } from "../src/lib/gk.js";

describe("My Area: the place and its four levels", () => {
  it("reads an OpenStreetMap address into town, district, state and region", () => {
    const p = placeFromNominatim({ suburb: "Palayamkottai", city: "Tirunelveli", county: "Palayamkottai", state_district: "Tirunelveli District", state: "Tamil Nadu", country: "India" });
    expect(p).toMatchObject({ local: "Palayamkottai, Tirunelveli", district: "Tirunelveli", state: "Tamil Nadu", region: "South India", country: "India" });
    expect(p.regionDetail).toMatch(/Southern Zonal Council: .*Tamil Nadu/);
    expect(levelsOf(p).map((l) => [l.key, l.name])).toEqual([
      ["local", "Palayamkottai, Tirunelveli"],
      ["district", "Tirunelveli district"],
      ["state", "Tamil Nadu"],
      ["region", "South India"],
    ]);
    expect(placeTrail(p)).toBe("Palayamkottai, Tirunelveli › Tirunelveli › Tamil Nadu › South India");
    // A city that is also its district: the neighbourhood is the town level.
    expect(placeFromNominatim({ town: "Ambasamudram", county: "Ambasamudram", state_district: "Tirunelveli District", state: "Tamil Nadu" }).local).toBe("Ambasamudram");
    expect(placeFromNominatim({ village: "Kallidaikurichi", county: "Ambasamudram", state_district: "Tirunelveli District", state: "Tamil Nadu" }).local).toBe("Kallidaikurichi (Ambasamudram taluk)");
    expect(placeFromNominatim({ suburb: "T. Nagar", city: "Chennai", state_district: "Chennai District", state: "Tamil Nadu", country: "India" }).local).toBe("T. Nagar, Chennai");
  });
  it("uses the fallback geocoder and typed places; every state has a region", () => {
    const b = placeFromBigDataCloud({
      city: "Ambasamudram", principalSubdivision: "Tamil Nadu", countryName: "India",
      localityInfo: { administrative: [{ name: "Tirunelveli district", description: "district of Tamil Nadu" }, { name: "Ambasamudram taluk" }] },
    });
    expect(b).toMatchObject({ local: "Ambasamudram", district: "Tirunelveli", state: "Tamil Nadu", region: "South India" });
    expect(placeFromText("Palayamkottai, Tirunelveli, Tamil Nadu")).toMatchObject({ local: "Palayamkottai", district: "Tirunelveli", state: "Tamil Nadu", region: "South India" });
    expect(placeFromText("Guwahati")).toMatchObject({ local: "Guwahati", state: "" });
    for (const s of ["Orissa", "NCT of Delhi", "Jammu & Kashmir", "Assam", "Gujarat", "Bihar", "Uttarakhand", "Lakshadweep", "Pondicherry"]) expect(regionOf(s), s).not.toBeNull();
    expect(regionOf("Assam").name).toBe("North-East India");
    expect(makePlace({ town: "Kathmandu", state: "Bagmati", country: "Nepal" }).region).toBe("Nepal");
  });
});

describe("My Area: notes", () => {
  it("asks for every subject across the two requests, tagged SSC / UPSC / RBI", () => {
    const p = makePlace({ town: "Ambasamudram", district: "Tirunelveli", state: "Tamil Nadu", country: "India" });
    expect(sectionGroups().flat().sort()).toEqual([...SECTION_NAMES].sort());
    const t = areaInstruction(p, "local", sectionGroups()[1]);
    expect(t).toMatch(/Ambasamudram \(in Tirunelveli district, Tamil Nadu, India\)/);
    expect(t).toMatch(/Agriculture & Soils: soil types/);
    expect(t).toMatch(/never pad/);
    expect(areaInstruction(p, "region", sectionGroups()[0])).toMatch(/Southern Zonal Council/);
    expect(AREA_SCHEMA.properties.items.items.properties.exam.enum).toEqual(["SSC", "UPSC", "RBI"]);
    const prompt = buildAreaPrompt(p, "state");
    expect(prompt).toMatch(/exam notes about Tamil Nadu \(in India\)/);
    for (const n of SECTION_NAMES) expect(prompt).toContain(`## ${n} — `);
  });

  it("reads the chat app's answer: headings, tags, questions, years; sorted SSC → UPSC → RBI", () => {
    const answer = `Here are your notes!

## Geography & Rivers — location, relief…
- [UPSC] The Thamirabarani is a perennial river of Tamil Nadu fed by both monsoons.
  Q: Which river of Tamil Nadu is perennial, fed by both monsoons? | A: Thamirabarani | Wrong: Vaigai; Palar; Ponnaiyar
- [SSC] The Thamirabarani rises in the Pothigai hills of the Western Ghats.
  Q: Where does the Thamirabarani rise? | A: Pothigai hills | Wrong: Nilgiri hills; Anaimalai hills; Palani hills

**Agriculture & Soils**
1. [RBI] Paddy is the main crop of the Thamirabarani command area.
   Q: Main crop of the Thamirabarani command area?
   A: Paddy
   Wrong: Cotton; Sugarcane; Banana
## Current Affairs
- [UPSC] (2024) Heavy rain flooded Tirunelveli and Thoothukudi in December.
  Q: Which two districts were flooded in December 2024? | A: Tirunelveli and Thoothukudi | Wrong: Madurai and Theni; Salem and Erode; Vellore and Ranipet
- [SSC] The Thamirabarani rises in the Pothigai hills of the Western Ghats.`;
    const notes = readAreaNotes(answer);
    expect(notes.map((n) => [n.section, n.exam])).toEqual([
      ["Geography & Rivers", "SSC"],
      ["Geography & Rivers", "UPSC"],
      ["Agriculture & Soils", "RBI"],
      ["Current Affairs", "UPSC"],
    ]); // the repeat is dropped
    expect(notes[2]).toMatchObject({ note: "Paddy is the main crop of the Thamirabarani command area.", q: "Main crop of the Thamirabarani command area?", a: "Paddy", options: ["Cotton", "Sugarcane", "Banana"] });
    expect(notes[3]).toMatchObject({ year: 2024, note: "Heavy rain flooded Tirunelveli and Thoothukudi in December." });
    expect(sectionOf("Banking, Credit & Rural Development")).toBe("Banking & Rural Development");
    expect(sectionOf("Art, Culture & Heritage")).toBe("Art & Culture");
    expect(sectionOf("Tirunelveli district")).toBe("");
  });

  it("saves notes under their own head: Places Visited › place › level, with the subject and exam in the tags", async () => {
    const { topicKey } = await import("../src/lib/gk-taxonomy.js");
    const notes = cleanNotes([
      { section: "Geography & Rivers", exam: "SSC", note: "The Thamirabarani rises in the Pothigai hills.", q: "Where does the Thamirabarani river rise?", a: "Pothigai hills", options: ["Nilgiris", "Palani hills", "Javadi hills"] },
      { section: "Current Affairs", exam: "UPSC", note: "Floods hit Tirunelveli in December.", q: "Which month did floods hit Tirunelveli?", a: "December", options: [], year: 2024 },
      { section: "Banking & Rural Development", exam: "RBI", note: "Tamil Nadu Grama Bank is the regional rural bank of the area.", q: "", a: "" },
      { section: "nonsense", exam: "xyz", note: "The Kattabomman memorial fort is at Panchalankurichi near Ottapidaram.", q: "", a: "" },
    ]);
    expect(notes.map((n) => n.section)).toEqual(["History", "Geography & Rivers", "Banking & Rural Development", "Current Affairs"]);
    expect(notes[0].exam).toBe("SSC");
    const items = notesToGkInputs(notes, "Tirunelveli district", "Palayamkottai, Tirunelveli").map((x) => makeItem(x));
    const river = items.find((i) => /Thamirabarani/.test(i.q));
    expect(river).toMatchObject({ category: "Places Visited", sub: "Tirunelveli district", place: "Palayamkottai, Tirunelveli", a: "Pothigai hills", source: "My area · Tirunelveli district" });
    expect(river.tags).toEqual(["My area", "Geography & Rivers", "SSC"]);
    expect(topicKey(river)).toBe("Places Visited › Palayamkottai, Tirunelveli › Tirunelveli district");
    expect(items.find((i) => /floods/i.test(i.q))).toMatchObject({ category: "Places Visited", explain: "(2024) Floods hit Tirunelveli in December." });
    expect(items.find((i) => /Grama Bank/.test(i.q))).toMatchObject({ category: "Places Visited", a: "" }); // a fact to remember
    expect(new Set(items.map(topicKey)).size).toBe(1); // never spread over History / Geography / Economy…
  });

});
