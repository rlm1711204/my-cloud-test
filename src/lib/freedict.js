// Free word-card filling (no API key): meaning, pronunciation, audio, examples and synonyms from
// dictionaryapi.dev (Wiktionary data), Wiktionary itself as a fallback (idioms/phrases), and
// Hindi/Tamil meanings from the MyMemory translation service.
import { difficultyFromLevel, levelOf } from "./difficulty.js";
import { wordKey } from "./words.js";
import { countChars, noteLimitHit } from "./usage.js";

const DICT = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const WIKT = "https://en.wiktionary.org/api/rest_v1/page/definition/";
const MYMEMORY = "https://api.mymemory.translated.net/get";

const NOT_EVERYDAY = /\((?:[^)]*\b(?:obsolete|archaic|dated|rare|historical|dialect(?:al)?|law|legal|nautical|heraldry|chiefly|slang)\b[^)]*)\)/i;
const stripHtml = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** A usable example sentence: a real sentence (not a 3-word fragment) that uses the word. */
function goodExample(ex, word) {
  const s = stripHtml(ex);
  if (s.length < 25 || s.length > 220 || s.split(" ").length < 5) return null;
  const stem = wordKey(word).slice(0, Math.max(4, wordKey(word).length - 2));
  return s.toLowerCase().includes(stem) ? s.replace(/^[“"]|[”"]$/g, "") : null;
}

const uniq = (arr, n) => [...new Map(arr.filter(Boolean).map((s) => [s.toLowerCase(), s])).values()].slice(0, n);

/** Parse a dictionaryapi.dev response into card fields. Pure; unit-tested. */
export function parseDictApi(entries, word) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const phonetics = entries.flatMap((e) => e.phonetics || []);
  const ipa = entries.map((e) => e.phonetic).find(Boolean) || phonetics.map((p) => p.text).find(Boolean) || "";
  const audios = phonetics.map((p) => p.audio).filter(Boolean);
  const audio = audios.find((a) => /-uk\.mp3$/.test(a)) || audios.find((a) => /-in\.mp3$/.test(a)) || audios[0] || "";

  const meanings = entries.flatMap((e) => e.meanings || []);
  const defs = meanings.flatMap((m) => (m.definitions || []).map((d) => ({ ...d, pos: m.partOfSpeech })));
  const everyday = defs.filter((d) => !NOT_EVERYDAY.test(d.definition || ""));
  const main = everyday[0] || defs[0];
  if (!main) return null;

  return {
    pos: main.pos || meanings[0]?.partOfSpeech || "",
    meaning: stripHtml(main.definition).replace(/\.$/, ""),
    ipa: ipa.includes("/") ? ipa : ipa ? `/${ipa}/` : "",
    audio,
    sentences: uniq((everyday.length ? everyday : defs).map((d) => goodExample(d.example, word)), 2),
    synonyms: uniq([...meanings.flatMap((m) => m.synonyms || []), ...defs.flatMap((d) => d.synonyms || [])], 5),
    antonyms: uniq([...meanings.flatMap((m) => m.antonyms || []), ...defs.flatMap((d) => d.antonyms || [])], 4),
  };
}

/** Parse Wiktionary's REST definition response (English section only). Pure; unit-tested. */
export function parseWiktionary(json, word) {
  const en = json?.en;
  if (!Array.isArray(en) || !en.length) return null;
  const defs = en.flatMap((sec) =>
    (sec.definitions || []).map((d) => ({
      pos: String(sec.partOfSpeech || "").toLowerCase(),
      definition: stripHtml(d.definition),
      examples: [...(d.examples || []), ...(d.parsedExamples || []).map((p) => p.example)],
    })),
  );
  const usable = defs.filter((d) => d.definition && !NOT_EVERYDAY.test(d.definition));
  const main = usable[0] || defs.find((d) => d.definition);
  if (!main) return null;
  return {
    pos: main.pos,
    meaning: main.definition.replace(/\.$/, ""),
    sentences: uniq((usable.length ? usable : defs).flatMap((d) => d.examples.map((e) => goodExample(e, word))), 2),
  };
}

const nonLatin = (s) => s && !/[A-Za-z]/.test(s);

/** Parse a MyMemory response into up to two distinct translations in the target script. Pure. */
export function parseMyMemory(json) {
  if (!json || Number(json.responseStatus) !== 200) {
    if (/USED ALL AVAILABLE FREE TRANSLATIONS/i.test(json?.responseDetails || json?.responseData?.translatedText || "")) {
      throw Object.assign(new Error("Daily free translation limit reached — Hindi meanings will resume tomorrow."), { quota: true });
    }
    return "";
  }
  const main = stripHtml(json.responseData?.translatedText);
  const alts = (json.matches || [])
    .filter((m) => Number(m.quality) >= 50 || m.quality === "")
    .map((m) => stripHtml(m.translation));
  return uniq([main, ...alts].map((s) => s.replace(/[.।]+$/, "").trim()).filter(nonLatin), 2).join(", ");
}

// ---------- IPA -> easy respelling ("/əˈbeɪt/" -> "uh-BAYT") ----------
const VOWELS = [
  ["eɪ", "ay"], ["aɪ", "eye"], ["ɔɪ", "oy"], ["aʊ", "ow"], ["əʊ", "oh"], ["oʊ", "oh"], ["ɪə", "eer"], ["eə", "air"],
  ["ɛə", "air"], ["ʊə", "oor"], ["iː", "ee"], ["uː", "oo"], ["ɑː", "ah"], ["ɔː", "aw"], ["ɜː", "ur"], ["i", "ee"],
  ["ɪ", "i"], ["ᵻ", "i"], ["e", "e"], ["ɛ", "e"], ["æ", "a"], ["ɑ", "ah"], ["ɒ", "o"], ["ɔ", "aw"], ["ʊ", "oo"],
  ["u", "oo"], ["ʌ", "u"], ["ə", "uh"], ["ɐ", "uh"], ["ɜ", "ur"], ["ɝ", "ur"], ["ɚ", "er"], ["o", "oh"], ["a", "a"],
];
const CONSONANTS = [
  ["tʃ", "ch"], ["dʒ", "j"], ["ʃ", "sh"], ["ʒ", "zh"], ["θ", "th"], ["ð", "th"], ["ŋ", "ng"], ["j", "y"], ["ɹ", "r"],
  ["ɾ", "t"], ["ɡ", "g"], ["x", "kh"], ["ʔ", ""], ...[..."bdfhklmnprstvwzgc"].map((c) => [c, c]),
];

const isOnset = (a, b) => ["r", "l", "w", "y"].includes(b) || (a === "s" && ["p", "t", "k", "m", "n"].includes(b));

export function ipaToSay(ipa) {
  const first = String(ipa || "").split(/[,;]/)[0];
  const src = first
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks
    .replace(/[/[\]()ˑ‿]/g, "")
    .replace(/:/g, "ː");
  // Tokenise into stress marks, syllable dots, vowels and consonants.
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "ˈ" || ch === "ˌ" || ch === "'" || ch === ".") {
      toks.push({ t: ch === "'" ? "ˈ" : ch });
      i++;
      continue;
    }
    const v = VOWELS.find(([k]) => src.startsWith(k, i));
    if (v) {
      toks.push({ t: "V", s: v[1] });
      i += v[0].length;
      if (src[i] === "ː") i++;
      continue;
    }
    const c = CONSONANTS.find(([k]) => src.startsWith(k, i));
    if (c) toks.push({ t: "C", s: c[1] });
    i += c ? c[0].length : 1;
  }
  if (!toks.some((t) => t.t === "V")) return "";
  // Build syllables: stress marks and dots always break. Between two vowels, the last consonant starts
  // the next syllable, together with the one before it when the pair is a natural onset (tr, bl, st, gw…).
  const syl = [{ s: "", stress: 0 }];
  let pendingStress = 0;
  let pendingCons = [];
  let sawVowel = false;
  const flush = (list) => (syl.at(-1).s += list.map((x) => x.s).join(""));
  for (const tk of toks) {
    if (tk.t === "ˈ" || tk.t === "ˌ" || tk.t === ".") {
      if (sawVowel) {
        flush(pendingCons);
        pendingCons = [];
        syl.push({ s: "", stress: 0 });
        sawVowel = false;
      }
      if (tk.t !== ".") pendingStress = tk.t === "ˈ" ? 2 : 1;
      continue;
    }
    if (tk.t === "C") {
      pendingCons.push(tk);
      continue;
    }
    if (sawVowel) {
      const n = pendingCons.length;
      const onset = n >= 2 && isOnset(pendingCons[n - 2].s, pendingCons[n - 1].s) ? 2 : Math.min(n, 1);
      const keep = pendingCons.slice(0, n - onset);
      flush(keep);
      syl.push({ s: "", stress: 0 });
      pendingCons = pendingCons.slice(keep.length);
    }
    flush(pendingCons);
    pendingCons = [];
    syl.at(-1).s += tk.s;
    if (pendingStress) syl.at(-1).stress = pendingStress;
    pendingStress = 0;
    sawVowel = true;
  }
  flush(pendingCons);
  const parts = syl.filter((x) => x.s);
  // "DYOOR-ruht" -> "DYOO-ruht": don't double an r across the break.
  for (let k = 0; k + 1 < parts.length; k++) if (parts[k].s.endsWith("r") && parts[k + 1].s.startsWith("r")) parts[k].s = parts[k].s.slice(0, -1);
  const multi = parts.length > 1;
  return parts.map((x) => (x.stress === 2 && multi ? x.s.toUpperCase() : x.s)).join("-");
}

// ---------- network ----------
async function getJSON(url, { allow404 = true } = {}) {
  const res = await fetch(url);
  if (res.status === 404 && allow404) return null;
  if (!res.ok) throw new Error(`${new URL(url).hostname} error ${res.status}`);
  return res.json();
}

async function lookupEnglish(word) {
  const w = word.trim().toLowerCase();
  let card = null;
  try {
    card = parseDictApi(await getJSON(DICT + encodeURIComponent(w)), w);
  } catch {
    /* fall through to Wiktionary */
  }
  if (!card || card.sentences.length < 2) {
    try {
      const wk = parseWiktionary(await getJSON(WIKT + encodeURIComponent(w.replace(/ /g, "_"))), w);
      if (wk) {
        card = card
          ? { ...card, sentences: uniq([...card.sentences, ...wk.sentences], 2) }
          : { ipa: "", audio: "", synonyms: [], antonyms: [], ...wk };
      }
    } catch {
      /* no fallback available */
    }
  }
  return card;
}

let quotaHit = false;
async function translate(text, lang) {
  if (quotaHit || !text) return "";
  const url = `${MYMEMORY}?q=${encodeURIComponent(text)}&langpair=en|${lang}`;
  countChars("mymemory", text.length);
  try {
    return parseMyMemory(await getJSON(url, { allow404: false }));
  } catch (e) {
    if (e.quota) {
      quotaHit = true;
      noteLimitHit("mymemory");
    }
    return "";
  }
}

/** Run `fn` over items with limited parallelism (be polite to free services). */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/**
 * Build word cards for `words` from free sources. Words that can't be found keep just the word
 * (and anything already in `base`), so nothing is lost.
 * @param {{word: string}[]} records - partial records (e.g. with context/source from a scan)
 */
export async function enrichFree(records, { tamil = false, levels = null } = {}, onProgress) {
  quotaHit = false;
  let done = 0;
  const out = await pool(records, 4, async (rec) => {
    const word = rec.word;
    const card = (await lookupEnglish(word)) || {};
    // Translating the word alone is often ambiguous; the short meaning gives better context as a fallback.
    let hindi = await translate(word, "hi");
    if (!hindi && card.meaning) hindi = await translate(card.meaning.slice(0, 120), "hi");
    const ta = tamil ? await translate(word, "ta") : "";
    done += 1;
    onProgress?.(`Looking up words in free dictionaries… ${done}/${records.length}`);
    return {
      ...rec,
      pos: rec.pos || card.pos || "",
      meaning: rec.meaning || card.meaning || "",
      hindi: rec.hindi || hindi,
      tamil: rec.tamil || ta,
      ipa: rec.ipa || card.ipa || "",
      say: rec.say || ipaToSay(card.ipa),
      audio: rec.audio || card.audio || "",
      sentences: rec.sentences?.length ? rec.sentences : card.sentences || [],
      synonyms: rec.synonyms?.length ? rec.synonyms : card.synonyms || [],
      antonyms: rec.antonyms?.length ? rec.antonyms : card.antonyms || [],
      difficulty: rec.difficulty ?? (levels ? difficultyFromLevel(levelOf(word, levels)) : 3),
    };
  });
  if (quotaHit) onProgress?.("Free translation limit reached for today — some Hindi meanings are missing.");
  return { records: out, quotaHit };
}
