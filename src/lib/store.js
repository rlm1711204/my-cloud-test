// App state persisted in localStorage (works offline); the synced part mirrors Google Drive.
import { DEFAULT_MODEL } from "./ai.js";
import { buildDailyPlan } from "./srs.js";
import { buildIndex, makeWord, mergeWordLists, todayISO, wordKey } from "./words.js";

const KEY = "vv.state.v1";

export const DEFAULT_SETTINGS = {
  geminiKey: "",
  geminiModel: "auto",
  apiKey: "",
  model: DEFAULT_MODEL,
  exam: "general",
  dailyCount: 10,
  tamil: false,
  voice: "en-IN",
  googleClientId: import.meta.env?.VITE_GOOGLE_CLIENT_ID || "",
  autoSync: true,
};

function blank() {
  return {
    words: [],
    featured: [], // words already used as Word of the Day
    activity: [], // dates with at least one review (for the streak)
    daily: null, // {date, wotd, ids, done: {id: grade}}
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
    const s = { ...blank(), ...raw, settings: { ...DEFAULT_SETTINGS, ...raw.settings } };
    s.words = (s.words || []).map((w) => makeWord(w));
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
export const byId = (id) => state.words.find((w) => w.id === id && !w.deleted);

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
  const stale = !d || d.date !== today || d.count !== state.settings.dailyCount;
  const empty = d && d.date === today && !d.ids.length && !d.wotd && liveWords().length > 0;
  if (stale || empty) {
    const plan = buildDailyPlan(state.words, { count: state.settings.dailyCount, date: today, featured: state.featured });
    const keepDone = d && d.date === today ? d.done : {};
    update(
      (s) => {
        s.daily = { ...plan, count: s.settings.dailyCount, done: keepDone };
        const wotd = s.words.find((w) => w.id === plan.wotd);
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
});

/** Merge a payload from Drive or a backup file into local state. */
export function importData(data, { markDirty = false } = {}) {
  if (!data || !Array.isArray(data.words)) throw new Error("That file doesn't look like a VocabVault backup.");
  update(
    (s) => {
      s.words = mergeWordLists(s.words, data.words.map((w) => makeWord(w)));
      s.featured = [...new Set([...s.featured, ...(data.featured || [])])];
      s.activity = [...new Set([...s.activity, ...(data.activity || [])])].sort().slice(-400);
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
