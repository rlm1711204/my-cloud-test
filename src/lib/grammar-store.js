// Grammar Rules data: kept completely apart from the vocabulary data — its own storage key, its own backup
// file and its own Google Drive file — so either part can be backed up, restored or reset on its own.
import { emptyPractice, mergePractice, normalize } from "./practice.js";
import { buildDailyPlan } from "./srs.js";
import { todayISO } from "./words.js";
import { BOOK_PREFIX, bookRecord, isAdvanced, isBookId, ruleBookLoaded } from "./rulebook.js";
import { SAME_RULE, findSimilarRule, makeRule, mergeRuleLists, ruleKey } from "./rules.js";

const KEY = "vv.grammar.v1";
export const BACKUP_APP = "VocabVault-Grammar";
export const DATA_VERSION = 1; // bump with a migration in load() if the stored shape ever changes

export const SOURCES = { mine: "My rules", book: "Rule Book", mixed: "Mixed" };
/** Which Rule Book rules Today and Practice use (the learner's own rules are always included). */
export const LEVELS = { all: "All levels", basic: "Basic", advanced: "Advanced (RBI Grade B)" };

/** Grammar study preferences. They travel with the grammar backup (never API keys). */
export const DEFAULT_PREFS = {
  dailyCount: 5, // rules to revise each day
  dailySource: "mixed", // the Rule Book gives something to learn from day one
  practiceSource: "mixed",
  practiceKind: "mixed",
  practiceSize: 15,
  bookLevel: "all", // "all" | "basic" | "advanced"
};

function blank() {
  return {
    version: DATA_VERSION,
    rules: [],
    featured: [], // rule keys already used as Rule of the Day
    activity: [], // dates with grammar revision (for the streak)
    daily: null,
    book: {}, // Rule Book progress: id -> {box, due, reviews, lapses, lastReviewed, starred, updatedAt}
    practice: emptyPractice(),
    prefs: { ...DEFAULT_PREFS },
    drive: { fileId: null, sheetId: null, lastSync: null },
    dirty: false,
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = typeof localStorage === "undefined" ? null : JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw) return blank();
    const s = { ...blank(), ...raw, prefs: { ...DEFAULT_PREFS, ...raw.prefs } };
    s.practice = normalize(raw.practice);
    s.rules = (s.rules || []).map((r) => makeRule(r));
    s.version = DATA_VERSION;
    return s;
  } catch {
    return blank();
  }
}

function save() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save grammar data", e);
  }
}

export const get = () => state;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function update(mutator, { touchesData = true } = {}) {
  mutator(state);
  if (touchesData) state.dirty = true;
  save();
  for (const fn of listeners) fn(state);
}

export const liveRules = () => state.rules.filter((r) => !r.deleted);

/** Rule Book entries with the learner's progress, shaped like their own rules. */
export const bookRules = () => (ruleBookLoaded() || []).map((e, i) => bookRecord(e, state.book[e.id], i));

/** Rules for a source: "mine", "book" or "mixed" (a learner's rule replaces the Rule Book rule it came from). */
export const levelOk = (r, level = state.prefs.bookLevel) =>
  level === "advanced" ? isAdvanced(r) : level === "basic" ? !isAdvanced(r) : true;

/**
 * Rules for a source: "mine", "book" or "mixed" (a learner's rule replaces the Rule Book rule it came from).
 * Rule Book rules are filtered by the chosen level; the whole book is always browsable via bookRules().
 */
export function rulesFor(source) {
  if (source === "mine") return liveRules();
  const book = bookRules().filter((r) => levelOk(r));
  if (source === "book") return book;
  const mine = liveRules();
  const covered = new Set(mine.flatMap((r) => [r.bookId, ruleKey(r.title)]).filter(Boolean));
  return [...mine, ...book.filter((b) => !covered.has(b.id) && !covered.has(ruleKey(b.title)))];
}

export function byId(id) {
  if (isBookId(id)) {
    const entries = ruleBookLoaded() || [];
    const i = entries.findIndex((e) => e.id === id);
    return i < 0 ? null : bookRecord(entries[i], state.book[id], i);
  }
  return state.rules.find((r) => r.id === id && !r.deleted) ?? null;
}

const PROGRESS_FIELDS = ["box", "due", "reviews", "lapses", "lastReviewed", "starred"];

/** Change a rule — own or Rule Book (only progress and the star are stored for Rule Book rules). */
export function updateRule(id, fn) {
  const cur = byId(id);
  if (!cur) return;
  const next = fn(cur);
  update((s) => {
    if (isBookId(id)) {
      s.book[id] = { ...Object.fromEntries(PROGRESS_FIELDS.map((k) => [k, next[k]])), updatedAt: new Date().toISOString() };
    } else {
      s.rules = s.rules.map((r) => (r.id === id ? makeRule({ ...next, updatedAt: new Date().toISOString() }) : r));
    }
  });
}

/**
 * Add rules, skipping ones already saved (same title, or so similar they are the same rule).
 * Returns {added, skipped: [{title, existing}]}.
 */
export function addRules(list) {
  const added = [];
  const skipped = [];
  const existing = liveRules();
  for (const input of list) {
    const r = makeRule(input);
    const dup = findSimilarRule(r, [...existing, ...added]);
    if (dup && (dup.exact || dup.score >= SAME_RULE)) {
      skipped.push({ title: r.title, existing: dup.rule.title });
      continue;
    }
    added.push(r);
  }
  if (added.length) update((s) => (s.rules = mergeRuleLists(s.rules, added)));
  return { added, skipped };
}

export function saveRule(input) {
  const r = makeRule({ ...input, updatedAt: new Date().toISOString() });
  update((s) => {
    const i = s.rules.findIndex((x) => x.id === r.id);
    if (i >= 0) s.rules[i] = r;
    else s.rules.unshift(r);
  });
  return r;
}

export function deleteRule(id) {
  update((s) => {
    s.rules = s.rules.map((r) => (r.id === id ? { ...r, deleted: true, updatedAt: new Date().toISOString() } : r));
  });
}

/** Copy a Rule Book rule into the learner's own list (keeping its progress). Returns the new rule or null. */
export function addBookRuleToMine(id) {
  const b = byId(id);
  if (!b || !isBookId(id)) return null;
  if (liveRules().some((r) => r.bookId === id || ruleKey(r.title) === ruleKey(b.title))) return null;
  const { added } = addRules([{ ...b, id: undefined, book: undefined, bookId: id, source: "Rule Book", addedAt: undefined, updatedAt: undefined }]);
  return added[0] ?? null;
}

/** Rule of the Day + rules to revise today (same scheme as the vocabulary daily plan). */
export function todaysPlan() {
  const today = todayISO();
  const d = state.daily;
  const { dailySource: source, dailyCount: count, bookLevel: level } = state.prefs;
  const pool = rulesFor(source);
  const asWords = pool.map((r) => ({ ...r, word: ruleKey(r.title) }));
  const stale = !d || d.date !== today || d.count !== count || d.source !== source || (d.level || "all") !== level;
  const build = () => buildDailyPlan(asWords, { count, date: today, featured: state.featured });
  const feature = (s, id) => {
    const r = pool.find((x) => x.id === id);
    if (r && !s.featured.includes(ruleKey(r.title))) s.featured.push(ruleKey(r.title));
  };
  if (stale) {
    const plan = build();
    const done = d && d.date === today ? d.done : {};
    update(
      (s) => {
        s.daily = { ...plan, count, source, level, done };
        feature(s, plan.wotd);
      },
      { touchesData: false },
    );
    return state.daily;
  }
  const ids = new Set(pool.map((r) => r.id));
  const kept = d.ids.filter((id) => ids.has(id));
  const rotdOk = Boolean(d.wotd && ids.has(d.wotd));
  const spare = pool.length - (rotdOk ? 1 : 0) - kept.length;
  if (!rotdOk || kept.length !== d.ids.length || (kept.length < count && spare > 0)) {
    const plan = build();
    const wotd = rotdOk ? d.wotd : plan.wotd;
    const topUp = [...plan.ids, plan.wotd].filter((id) => id && id !== wotd && !kept.includes(id));
    update(
      (s) => {
        s.daily = { ...d, wotd, ids: [...kept, ...topUp].slice(0, Math.max(count, kept.length)) };
        if (!rotdOk) feature(s, wotd);
      },
      { touchesData: false },
    );
  }
  return state.daily;
}

export function markActive() {
  const today = todayISO();
  if (!state.activity.includes(today)) update((s) => s.activity.push(today), { touchesData: false });
}

/** The grammar backup / Drive payload: rules, Rule Book progress, practice history and preferences. */
export const exportData = () => ({
  app: BACKUP_APP,
  version: DATA_VERSION,
  exportedAt: new Date().toISOString(),
  rules: state.rules,
  featured: state.featured,
  activity: state.activity,
  book: state.book,
  practice: state.practice,
  prefs: state.prefs,
});

/** What kind of VocabVault backup a parsed file is: "grammar", "vocab" or null. */
export function backupKind(data) {
  if (!data || typeof data !== "object") return null;
  if (data.app === "VocabVault-GK" || (Array.isArray(data.items) && !data.rules && !data.words)) return "gk";
  if (data.app === BACKUP_APP || Array.isArray(data.rules)) return "grammar";
  if (data.app === "VocabVault" || Array.isArray(data.words)) return "vocab";
  return null;
}

/**
 * Merge a grammar backup or Drive copy into this device. Rules match by id, then by title/similarity, so
 * restoring the same file twice never creates duplicates. Returns a summary for the "restored" message.
 */
export function importData(data, { markDirty = false, applyPrefs = false } = {}) {
  const kind = backupKind(data);
  if (kind === "vocab") throw new Error("This is a vocabulary backup — restore it under 📘 Vocabulary → Settings.");
  if (kind === "gk") throw new Error("This is a GK backup — restore it under 🌍 GK → Settings.");
  if (kind !== "grammar") throw new Error("That file doesn't look like a VocabVault grammar backup.");
  const incoming = (data.rules || []).map((r) => makeRule(r)).filter((r) => !r.deleted);
  const before = state.rules;
  let added = 0;
  let updated = 0;
  const merged = [];
  for (const r of incoming) {
    let match = before.find((x) => x.id === r.id) ?? null;
    if (!match) {
      const sim = findSimilarRule(r, before.filter((x) => !x.deleted));
      if (sim && (sim.exact || sim.score >= SAME_RULE)) match = sim.rule;
    }
    if (!match) {
      added += 1;
      merged.push(r);
    } else if (String(r.updatedAt) > String(match.updatedAt)) {
      updated += 1;
      merged.push({ ...r, id: match.id });
    }
  }
  const deletions = (data.rules || []).filter((r) => r.deleted).map((r) => makeRule(r));
  update(
    (s) => {
      s.rules = mergeRuleLists(s.rules, [...merged, ...deletions]);
      s.featured = [...new Set([...s.featured, ...(data.featured || [])])];
      s.activity = [...new Set([...s.activity, ...(data.activity || [])])].sort().slice(-400);
      for (const [id, p] of Object.entries(data.book || {})) {
        if (!id.startsWith(BOOK_PREFIX)) continue;
        if (!s.book[id] || String(p.updatedAt) > String(s.book[id].updatedAt)) s.book[id] = p;
      }
      s.practice = mergePractice(s.practice, data.practice);
      if (applyPrefs && data.prefs) {
        s.prefs = { ...s.prefs, ...Object.fromEntries(Object.entries(data.prefs).filter(([k]) => k in DEFAULT_PREFS)) };
        s.daily = null;
      }
    },
    { touchesData: markDirty },
  );
  return { inBackup: incoming.length, added, updated, bookProgress: Object.keys(data.book || {}).length };
}

export function resetAll() {
  const keepDrive = state.drive;
  state = { ...blank(), drive: keepDrive };
  save();
  for (const fn of listeners) fn(state);
}

/** For tests: replace the state wholesale. */
export function _setState(s) {
  state = { ...blank(), ...s };
}
