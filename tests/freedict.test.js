import { describe, expect, it } from "vitest";
import { ipaToSay, parseDictApi, parseMyMemory, parseWiktionary } from "../src/lib/freedict.js";

// Shaped like real dictionaryapi.dev v2 responses.
const ABATE = [
  {
    word: "abate",
    phonetic: "/əˈbeɪt/",
    phonetics: [
      { text: "/əˈbeɪt/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/abate-us.mp3" },
      { text: "/əˈbeɪt/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/abate-uk.mp3" },
    ],
    meanings: [
      {
        partOfSpeech: "verb",
        definitions: [
          { definition: "(obsolete) To beat down; to overthrow.", synonyms: [], antonyms: [], example: "to abate a castle" },
          {
            definition: "To lessen in force or intensity.",
            synonyms: ["subside"],
            antonyms: [],
            example: "The storm finally abated after midnight, and the fishermen returned.",
          },
          { definition: "To decrease or become less in strength.", synonyms: [], antonyms: ["intensify"], example: "His anger abated." },
        ],
        synonyms: ["decrease", "lessen", "diminish"],
        antonyms: ["increase"],
      },
    ],
  },
];

describe("parseDictApi", () => {
  it("prefers everyday senses, UK audio, full-sentence examples", () => {
    const c = parseDictApi(ABATE, "abate");
    expect(c.pos).toBe("verb");
    expect(c.meaning).toBe("To lessen in force or intensity");
    expect(c.ipa).toBe("/əˈbeɪt/");
    expect(c.audio).toMatch(/abate-uk\.mp3$/);
    expect(c.sentences).toEqual(["The storm finally abated after midnight, and the fishermen returned."]);
    expect(c.synonyms).toEqual(["decrease", "lessen", "diminish", "subside"]);
    expect(c.antonyms).toEqual(["increase", "intensify"]);
  });
  it("returns null for empty/not-found responses", () => {
    expect(parseDictApi(null, "x")).toBeNull();
    expect(parseDictApi([], "x")).toBeNull();
  });
});

describe("parseWiktionary", () => {
  it("reads the English section, strips HTML and finds examples (idioms too)", () => {
    const json = {
      en: [
        {
          partOfSpeech: "Verb",
          language: "English",
          definitions: [
            {
              definition: "<span>(<i>idiomatic</i>)</span> To do something <b>badly</b> or cheaply to save time or money.",
              examples: ["The builders <b>cut corners</b> on the new bridge and it cracked within a year."],
            },
          ],
        },
      ],
      fr: [{ partOfSpeech: "Noun", definitions: [{ definition: "ignored" }] }],
    };
    const c = parseWiktionary(json, "cut corners");
    expect(c.pos).toBe("verb");
    expect(c.meaning).toBe("(idiomatic) To do something badly or cheaply to save time or money");
    expect(c.sentences).toEqual(["The builders cut corners on the new bridge and it cracked within a year."]);
  });
  it("returns null without an English section", () => {
    expect(parseWiktionary({ fr: [] }, "x")).toBeNull();
  });
});

describe("parseMyMemory", () => {
  it("keeps up to two distinct Devanagari translations and drops English echoes", () => {
    const json = {
      responseStatus: 200,
      responseData: { translatedText: "कम करना" },
      matches: [
        { translation: "कम करना", quality: "80" },
        { translation: "घटाना।", quality: "74" },
        { translation: "abate", quality: "70" },
        { translation: "शांत होना", quality: "70" },
      ],
    };
    expect(parseMyMemory(json)).toBe("कम करना, घटाना");
  });
  it("returns empty when the service echoes English", () => {
    expect(parseMyMemory({ responseStatus: 200, responseData: { translatedText: "abate" }, matches: [] })).toBe("");
  });
  it("signals the daily quota", () => {
    expect(() =>
      parseMyMemory({ responseStatus: 429, responseDetails: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" }),
    ).toThrow(/limit/);
  });
});

describe("ipaToSay", () => {
  it.each([
    ["/əˈbeɪt/", "uh-BAYT"],
    ["/ˈlækənɪk/", "LA-kuh-nik"],
    ["/ɒbˈdjʊəɹət/", "ob-DYOO-ruht"],
    ["/pəˈfʌŋktəɹi/", "puh-FUNGK-tuh-ree"],
    ["/ˈsæŋɡwɪn/", "SANG-gwin"],
    ["/kəˈdʒəʊl/", "kuh-JOHL"],
    ["/kæt/", "kat"],
    ["", ""],
  ])("%s -> %s", (ipa, say) => {
    expect(ipaToSay(ipa)).toBe(say);
  });
});
