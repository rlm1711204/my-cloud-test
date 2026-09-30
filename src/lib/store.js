// App state persisted in localStorage (works offline); the synced part mirrors Google Drive.
import { DEFAULT_MODEL } from "./ai.js";
import { BANK_PREFIX, bankLoaded, bankRecord, isBankId, progressOf } from "./bank.js";
import { emptyPractice, mergePractice } from "./practice.js";
import { buildDailyPlan } from "./srs.js";
import { buildIndex, makeWord, mergeWordLists, todayISO, wordKey } from "./words.js";

const KEY = "vv.state.v1";

export const DEFAULT_SETTINGS = {
  geminiKeys: [], // several free keys: when one hits its limit the next is used
  geminiModel: "auto",
  apiKey: "",
  model: DEFAULT_MODEL,
  exam: "general",
  dailyCount: 10,
  tamil: false,
  voice: "en-IN",
  googleClientId: import.meta.env?.VITE_GOOGLE_CLIENT_ID || "",
  autoSync: true,
  dailySource: "mine", // "mine" | "bank" | "mixed" — where Today's words come from
  practiceSource: "mixed", // default source on the Practice screen
  practiceKind: "mixed",
  practiceSize: 20,
  notify: { enabled: false, hour: 8, source: "mixed" },
};

export const SOURCES = { mine: "My words", bank: "Word Bank", mixed: "Mixed" };

function blank() {
  return {
    words: [],
    featured: [], // words already used as Word of the Day
    activity: [], // dates with at least one review (for the streak)
    daily: null, // {date, wotd, ids, done: {id: grade}}
    bank: {}, // Word Bank revision progress: id -> {box, due, reviews, lapses, lastReviewed, starred, updatedAt}
    practice: emptyPractice(), // practice rounds & weak words (see practice.js)
    settings: { ...DEFAULT_SETTINGS },
    drive: { folderId: null, fileId: null, sheetId: null, lastSync: null },
    dirty: false, // local changes not yet uploaded
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw) return blank();
    const s = {
      ...blank(),
      ...raw,
      settings: { ...DEFAULT_SETTINGS, ...raw.settings, notify: { ...DEFAULT_SETTINGS.notify, ...raw.settings?.notify } },
    };
    s.practice = { ...emptyPractice(), ...raw.practice };
    s.words = (s.words || []).map((w) => makeWord(w));
    // Older versions kept one Gemini key; move it into the list.
    if (s.settings.geminiKey) {
      s.settings.geminiKeys = [...new Set([...(s.settings.geminiKeys || []), s.settings.geminiKey.trim()])];
      delete s.settings.geminiKey;
    }
    return s;
  } catch {
    return blank();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save locally", e);
  }
}

export const get = () => state;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

/** Apply a change. `touchesData` marks the synced part as changed so it gets uploaded. */
export function update(mutator, { touchesData = true } = {}) {
  mutator(state);
  if (touchesData) state.dirty = true;
  save();
  for (const fn of listeners) fn(state);
}

export const liveWords = () => state.words.filter((w) => !w.deleted);

/** Word Bank entries with the learner's progress, shaped like normal word records. */
export const bankWords = () => (bankLoaded() || []).map((e) => bankRecord(e, state.bank[BANK_PREFIX + wordKey(e.word)]));

/** Words for a source: "mine", "bank" or "mixed" (own words win over a bank word with the same spelling). */
export function wordsFor(source) {
  if (source === "mine") return liveWords();
  if (source === "bank") return bankWords();
  const mine = liveWords();
  const own = new Set(mine.map((w) => wordKey(w.word)));
  return [...mine, ...bankWords().filter((w) => !own.has(wordKey(w.word)))];
}

export function byId(id) {
  if (isBankId(id)) {
    const key = String(id).slice(BANK_PREFIX.length);
    const e = (bankLoaded() || []).find((x) => wordKey(x.word) === key);
    return e ? bankRecord(e, state.bank[id]) : undefined;
  }
  return state.words.find((w) => w.id === id && !w.deleted);
}

/** Update a word's revision state (works for own words and Word Bank words). */
export function updateWord(id, fn) {
  const cur = byId(id);
  if (!cur) return;
  const next = fn(cur);
  update((s) => {
    if (isBankId(id)) s.bank[id] = { ...progressOf(next), updatedAt: new Date().toISOString() };
    else {
      const i = s.words.findIndex((w) => w.id === id);
      if (i >= 0) s.words[i] = next;
    }
  });
}

/** Add new words. Words already in the live list are skipped so their revision history is kept. */
export function addWords(records) {
  const now = new Date();
  const index = buildIndex(state.words);
  const fresh = records
    .filter((r) => wordKey(r.word) && !index.has(wordKey(r.word)))
    .map((r) => makeWord({ ...r, id: undefined, addedAt: now.toISOString(), updatedAt: now.toISOString() }, now));
  if (fresh.length) update((s) => (s.words = mergeWordLists(s.words, fresh)));
  return fresh.length;
}

export function saveWord(rec) {
  update((s) => {
    const next = makeWord({ ...rec, updatedAt: new Date().toISOString() });
    const i = s.words.findIndex((w) => w.id === rec.id);
    if (i >= 0) s.words[i] = next;
    else s.words.unshift(next);
  });
}

export function deleteWord(id) {
  update((s) => {
    const w = s.words.find((x) => x.id === id);
    if (w) Object.assign(w, { deleted: true, updatedAt: new Date().toISOString() });
    if (s.daily) s.daily.ids = s.daily.ids.filter((x) => x !== id);
  });
}

/** Today's plan — created once per day (or when it's empty and words have since been added). */
export function todaysPlan() {
  const today = todayISO();
  const d = state.daily;
  const source = state.settings.dailySource;
  const pool = wordsFor(source);
  const stale = !d || d.date !== today || d.count !== state.settings.dailyCount || (d.source || "mine") !== source;
  const empty = d && d.date === today && !d.ids.length && !d.wotd && pool.length > 0;
  if (stale || empty) {
    const plan = buildDailyPlan(pool, { count: state.settings.dailyCount, date: today, featured: state.featured });
    const keepDone = d && d.date === today ? d.done : {};
    update(
      (s) => {
        s.daily = { ...plan, count: s.settings.dailyCount, source, done: keepDone };
        const wotd = pool.find((w) => w.id === plan.wotd);
        if (wotd && !s.featured.includes(wotd.word)) s.featured.push(wotd.word);
      },
      { touchesData: true },
    );
  }
  return state.daily;
}

/** The synced payload (no API keys or device settings). */
export const exportData = () => ({
  app: "VocabVault",
  version: 1,
  exportedAt: new Date().toISOString(),
  words: state.words,
  featured: state.featured,
  activity: state.activity,
  bank: state.bank,
  practice: state.practice,
});

/** Copy a Word Bank word into the learner's own master list. */
export function addBankWordToMine(id) {
  const w = byId(id);
  if (!w) return 0;
  const { word, pos, meaning, hindi, synonyms, antonyms, sentences } = w;
  return addWords([{ word, pos, meaning, hindi, synonyms, antonyms, sentences, source: "Word Bank", difficulty: 4 }]);
}

/** Merge a payload from Drive or a backup file into local state. */
export function importData(data, { markDirty = false } = {}) {
  if (!data || !Array.isArray(data.words)) throw new Error("That file doesn't look like a VocabVault backup.");
  update(
    (s) => {
      s.words = mergeWordLists(s.words, data.words.map((w) => makeWord(w)));
      s.featured = [...new Set([...s.featured, ...(data.featured || [])])];
      s.activity = [...new Set([...s.activity, ...(data.activity || [])])].sort().slice(-400);
      for (const [id, p] of Object.entries(data.bank || {})) {
        if (!s.bank[id] || String(p.updatedAt) > String(s.bank[id].updatedAt)) s.bank[id] = p;
      }
      s.practice = mergePractice(s.practice, data.practice);
    },
    { touchesData: markDirty },
  );
}

export function resetAll() {
  const settings = state.settings;
  state = { ...blank(), settings };
  save();
  for (const fn of listeners) fn(state);
}
