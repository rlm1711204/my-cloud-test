// GK data, kept apart from vocabulary and grammar: its own storage key, backup file and Google Drive file.
// Revision is planned so every subject, chapter and question comes round periodically (see todaysPlan).
import { emptyPractice, interleave, mergePractice, normalize } from "./practice.js";
import { stage } from "./srs.js";
import { addDays } from "./srs.js";
import { todayISO } from "./words.js";
import { BANK_PREFIX, bankLoaded, bankRecord, isBankId } from "./gkbank.js";
import { CA, PLACES, SEP, topicKey } from "./gk-taxonomy.js";
import { answerKey, findDuplicate, makeItem, mergeItems } from "./gk.js";

const KEY = "vv.gk.v1";
export const BACKUP_APP = "VocabVault-GK";
export const DATA_VERSION = 1;

export const SOURCES = { mine: "My questions", bank: "Question Bank", mixed: "Mixed" };

export const DEFAULT_PREFS = {
  dailyCount: 10,
  dailySource: "mixed",
  practiceSource: "mixed",
  practiceKind: "mixed",
  practiceSize: 20,
  excluded: [], // topic keys (or a whole subject / "Current Affairs › 2025") left out of practice
  excludeToday: false, // also leave them out of Today's revision
};

function blank() {
  return {
    version: DATA_VERSION,
    items: [],
    featured: [], // ids already used as Question of the Day
    activity: [],
    daily: null,
    bank: {}, // Question Bank progress: id -> {box, due, reviews, lapses, lastReviewed, starred, updatedAt}
    practice: emptyPractice(),
    topicSeen: {}, // topic key -> last date any question of it was revised (for balancing)
    areas: [], // "My Area" notes: [{id, place, levels: {local|district|state|region: {notes, by, madeAt}}, createdAt, updatedAt}]
    areaId: null, // the place shown on the My Area screen
    prefs: { ...DEFAULT_PREFS },
    drive: { fileId: null, sheetId: null, lastSync: null },
    dirty: false,
  };
}

let state = load();
const listeners = new Set();
if (state.moved) {
  delete state.moved;
  save();
}

function load() {
  try {
    const raw = typeof localStorage === "undefined" ? null : JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw) return blank();
    const s = { ...blank(), ...raw, prefs: { ...DEFAULT_PREFS, ...raw.prefs } };
    s.practice = normalize(raw.practice);
    s.items = (s.items || []).map((i) => makeItem(i));
    s.areas = Array.isArray(s.areas) ? s.areas.filter((a) => a && a.id && a.place) : [];
    const before = s.items;
    s.items = s.items.map((i) => toPlaces(i, s.areas));
    if (s.items.some((i, k) => i !== before[k])) s.moved = true; // saved once below
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
    console.warn("Could not save GK data", e);
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

export const liveItems = () => state.items.filter((i) => !i.deleted);
export const bankItems = () => (bankLoaded() || []).map((e, i) => bankRecord(e, state.bank[e.id], i));

/** True when `item` falls under an excluded topic, subject or Current Affairs year. */
export function isExcluded(item, excluded = state.prefs.excluded) {
  if (!excluded?.length) return false;
  const key = topicKey(item);
  return excluded.some((x) => key === x || key.startsWith(x + SEP));
}

/** Questions for a source ("mine", "bank", "mixed"); `forPractice` applies the topic filter. */
export function itemsFor(source, { forPractice = false, forToday = false } = {}) {
  const mine = liveItems();
  let list = source === "mine" ? mine : source === "bank" ? bankItems() : [...mine, ...bankItems().filter((b) => !findDuplicate(b, mine))];
  if (forPractice || (forToday && state.prefs.excludeToday)) list = list.filter((i) => !isExcluded(i));
  return list;
}

export function byId(id) {
  if (isBankId(id)) {
    const entries = bankLoaded() || [];
    const i = entries.findIndex((e) => e.id === id);
    return i < 0 ? null : bankRecord(entries[i], state.bank[id], i);
  }
  return state.items.find((i) => i.id === id && !i.deleted) ?? null;
}

const PROGRESS_FIELDS = ["box", "due", "reviews", "lapses", "lastReviewed", "starred"];

export function updateItem(id, fn) {
  const cur = byId(id);
  if (!cur) return;
  const next = fn(cur);
  update((s) => {
    if (isBankId(id)) {
      s.bank[id] = { ...Object.fromEntries(PROGRESS_FIELDS.map((k) => [k, next[k]])), updatedAt: new Date().toISOString() };
    } else {
      s.items = s.items.map((i) => (i.id === id ? makeItem({ ...next, updatedAt: new Date().toISOString() }) : i));
    }
  });
}

/** Note that a question's topic was revised today (used to rotate topics fairly). */
export function markTopic(item) {
  const key = topicKey(item);
  const today = todayISO();
  update(
    (s) => {
      s.topicSeen[key] = today;
      if (!s.activity.includes(today)) s.activity.push(today);
    },
    { touchesData: false },
  );
}

/** Add questions, skipping any already saved (same answer, very similar wording). Returns {added, skipped}. */
export function addItems(list) {
  const added = [];
  const skipped = [];
  const existing = liveItems();
  for (const input of list) {
    const it = makeItem(input);
    const dup = findDuplicate(it, [...existing, ...added]);
    if (dup) skipped.push({ q: it.q, existing: dup.q, id: dup.id });
    else added.push(it);
  }
  if (added.length) update((s) => (s.items = mergeItems(s.items, added)));
  return { added, skipped };
}

export function saveItem(input) {
  const it = makeItem({ ...input, updatedAt: new Date().toISOString() });
  update((s) => {
    const i = s.items.findIndex((x) => x.id === it.id);
    if (i >= 0) s.items[i] = it;
    else s.items.unshift(it);
  });
  return it;
}

export function deleteItem(id) {
  update((s) => {
    s.items = s.items.map((i) => (i.id === id ? { ...i, deleted: true, updatedAt: new Date().toISOString() } : i));
  });
}

/** Copy a Question Bank question into the learner's own list. Returns the new item or null. */
export function addBankItemToMine(id) {
  const b = byId(id);
  if (!b || !isBankId(id)) return null;
  const { added } = addItems([{ ...b, id: undefined, bank: undefined, source: "Question Bank", addedAt: undefined, updatedAt: undefined }]);
  return added[0] ?? null;
}

// ---------- the topic tree with progress ----------
/**
 * Counts for the topic tree: for every subject, chapter (and Current Affairs year → topic): how many
 * questions, how many asked in the current practice round, mastered, weak and due.
 */
export function topicTree(items, practice = state.practice, source = state.prefs.practiceSource, today = todayISO()) {
  const { asked } = normalize(practice);
  // "Covered this round" = asked more often than the least-practised question in the list.
  const base = items.length ? Math.min(...items.map((it) => asked[it.id] ?? 0)) : 0;
  const tree = new Map();
  const bump = (key, it) => {
    if (!tree.has(key)) tree.set(key, { key, total: 0, covered: 0, mastered: 0, weak: 0, due: 0, fresh: 0 });
    const n = tree.get(key);
    n.total += 1;
    if ((asked[it.id] ?? 0) > base) n.covered += 1;
    if (stage(it) === "mastered") n.mastered += 1;
    if (stage(it) === "new") n.fresh += 1;
    if (practice.weak?.[it.id]?.need) n.weak += 1;
    if (stage(it) !== "new" && it.due <= today) n.due += 1;
  };
  for (const it of items) {
    const parts = topicKey(it).split(SEP);
    for (let i = 1; i <= parts.length; i++) bump(parts.slice(0, i).join(SEP), it);
  }
  return tree;
}

// ---------- Today ----------
/**
 * Question of the Day + N questions to revise, spread across topics:
 *  1. due reviews first (oldest first), one topic at a time in turn;
 *  2. then new questions, taking turns between topics, starting with topics revised longest ago;
 *  3. then the weakest not-yet-due questions, so every topic keeps coming round.
 */
export function buildGkPlan(pool, { count = 10, date = todayISO(), featured = [], topicSeen = {}, groupOf = topicKey, featuredOk = (i) => i.a } = {}) {
  const seed = [...date].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  let h = seed;
  const rand = () => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const group = groupOf;
  const byStale = (a, b) => String(topicSeen[group(a)] || "").localeCompare(String(topicSeen[group(b)] || ""));

  const featuredSet = new Set(featured);
  const qotdPool = pool.filter((i) => !featuredSet.has(i.id) && featuredOk(i));
  const qotd = (qotdPool.length ? qotdPool : pool)
    .map((i) => ({ i, s: (stage(i) === "new" ? 2 : 0) + (i.starred ? 2 : 0) + i.difficulty / 2 + rand() * 3 }))
    .sort((a, b) => b.s - a.s)[0]?.i ?? null;
  const rest = pool.filter((i) => i !== qotd);

  const ordered = (list) => {
    const byId = new Map(list.map((i) => [i.id, i]));
    // Topics revised longest ago go first; within a topic keep the given order.
    const sorted = [...list].sort(byStale);
    return interleave(sorted.map((i) => i.id), (id) => group(byId.get(id)), null).map((id) => byId.get(id));
  };
  const due = ordered(rest.filter((i) => stage(i) !== "new" && i.due <= date).sort((a, b) => a.due.localeCompare(b.due)));
  const fresh = ordered(rest.filter((i) => stage(i) === "new").sort((a, b) => Number(b.starred) - Number(a.starred) || a.addedAt.localeCompare(b.addedAt)));
  const n = Math.max(1, count);
  const minFresh = Math.min(fresh.length, Math.ceil(n * 0.4));
  const reviews = due.slice(0, n - minFresh);
  const news = fresh.slice(0, n - reviews.length);
  const extra = ordered(
    rest.filter((i) => !reviews.includes(i) && !news.includes(i) && stage(i) !== "new").sort((a, b) => a.box - b.box || a.due.localeCompare(b.due)),
  ).slice(0, Math.max(0, n - reviews.length - news.length));
  return { date, wotd: qotd?.id ?? null, ids: [...reviews, ...news, ...extra].map((i) => i.id) };
}

export function todaysPlan() {
  const today = todayISO();
  const d = state.daily;
  const { dailySource: source, dailyCount: count } = state.prefs;
  const pool = itemsFor(source, { forToday: true });
  const sig = `${source}|${count}|${state.prefs.excludeToday ? state.prefs.excluded.join(",") : ""}`;
  const stale = !d || d.date !== today || d.sig !== sig;
  const build = () => buildGkPlan(pool, { count, date: today, featured: state.featured, topicSeen: state.topicSeen });
  if (stale) {
    const plan = build();
    const done = d && d.date === today ? d.done : {};
    update(
      (s) => {
        s.daily = { ...plan, sig, done };
        if (plan.wotd && !s.featured.includes(plan.wotd)) s.featured.push(plan.wotd);
        // Once every question has been Question of the Day, start again.
        if (s.featured.length >= pool.length) s.featured = plan.wotd ? [plan.wotd] : [];
      },
      { touchesData: false },
    );
    return state.daily;
  }
  const ids = new Set(pool.map((i) => i.id));
  const kept = d.ids.filter((id) => ids.has(id));
  const qOk = Boolean(d.wotd && ids.has(d.wotd));
  const spare = pool.length - (qOk ? 1 : 0) - kept.length;
  if (!qOk || kept.length !== d.ids.length || (kept.length < count && spare > 0)) {
    const plan = build();
    const wotd = qOk ? d.wotd : plan.wotd;
    const topUp = [...plan.ids, plan.wotd].filter((id) => id && id !== wotd && !kept.includes(id));
    update((s) => (s.daily = { ...d, wotd, ids: [...kept, ...topUp].slice(0, Math.max(count, kept.length)) }), { touchesData: false });
  }
  return state.daily;
}

// ---------- My Area ----------
/**
 * My Area notes saved by the first version were filed under the common subjects (tags ["My area", level, exam]);
 * they now live under Places Visited › place › level.
 */
function toPlaces(it, areas) {
  if (it.category === PLACES || it.tags?.[0] !== "My area" || !String(it.source).startsWith("My area · ")) return it;
  const level = String(it.source).slice("My area · ".length);
  const area = areas.find((a) => ["local", "district", "state", "region"].some((k) => a.place?.[k] && level.startsWith(a.place[k]))) ?? null;
  const placeName = area ? area.place.local || area.place.district || area.place.state || area.place.region : level;
  const subject = { History: "History", Geography: "Geography & Rivers", Economy: "Economy & Industry", Polity: "Polity & Governance", "Banking & Finance": "Banking & Rural Development", "Science & Tech": "Science, Energy & Defence", "Static GK": "Personalities", [CA]: "Current Affairs" }[it.category] || it.category;
  return makeItem({ ...it, category: PLACES, sub: level, place: placeName, year: 0, tags: ["My area", subject, it.tags[2] || ""].filter(Boolean) });
}
const sameAreaPlace = (a, b) => ["local", "district", "state", "region"].every((k) => String(a?.[k] || "").toLowerCase() === String(b?.[k] || "").toLowerCase());

/** The place shown on the My Area screen (the last one opened), or null. */
export const currentArea = () => (state.areaId === "__new__" ? null : (state.areas.find((a) => a.id === state.areaId) ?? state.areas[0] ?? null));

/** Save a place (a new one, or the same place again keeps its notes) and show it. Returns the area. */
export function saveAreaPlace(place) {
  const now = new Date().toISOString();
  let area = state.areas.find((a) => sameAreaPlace(a.place, place));
  update((s) => {
    if (!area) {
      area = { id: `area-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, place, levels: {}, createdAt: now, updatedAt: now };
      s.areas.unshift(area);
    }
    s.areaId = area.id;
  });
  return area;
}

/** Change the place names of a saved place (notes of a level whose name changed are dropped). */
export function editAreaPlace(id, place) {
  update((s) => {
    const a = s.areas.find((x) => x.id === id);
    if (!a) return;
    for (const k of ["local", "district", "state", "region"]) if (String(a.place[k] || "") !== String(place[k] || "")) delete a.levels[k];
    a.place = place;
    a.updatedAt = new Date().toISOString();
  });
}

export function setAreaNotes(id, key, notes, by = "") {
  update((s) => {
    const a = s.areas.find((x) => x.id === id);
    if (!a) return;
    a.levels[key] = { notes, by, madeAt: new Date().toISOString() };
    a.updatedAt = new Date().toISOString();
  });
}

export const showArea = (id) => update((s) => (s.areaId = id), { touchesData: false });

export function deleteArea(id) {
  update((s) => {
    s.areas = s.areas.filter((a) => a.id !== id);
    if (s.areaId === id) s.areaId = s.areas[0]?.id ?? null;
  });
}

/** Current Affairs years present in a list, newest first. */
export const caYears = (items) => [...new Set(items.filter((i) => i.category === CA).map((i) => i.year))].sort((a, b) => b - a);

// ---------- backups ----------
export const exportData = () => ({
  app: BACKUP_APP,
  version: DATA_VERSION,
  exportedAt: new Date().toISOString(),
  items: state.items,
  featured: state.featured,
  activity: state.activity,
  bank: state.bank,
  practice: state.practice,
  topicSeen: state.topicSeen,
  areas: state.areas,
  prefs: state.prefs,
});

/** Which part of VocabVault a backup file belongs to: "vocab", "grammar", "gk" or null. */
export function backupKind(data) {
  if (!data || typeof data !== "object") return null;
  if ((data.app === "VocabVault-Quant" || data.app === "VocabVault-Reasoning" || (Array.isArray(data.items) && data.items.some((i) => i && (i.kind === "formula" || "solution" in i))))) return "quant";
  if (data.app === BACKUP_APP || (Array.isArray(data.items) && !data.words && !data.rules)) return "gk";
  if (data.app === "VocabVault-Grammar" || Array.isArray(data.rules)) return "grammar";
  if (data.app === "VocabVault" || Array.isArray(data.words)) return "vocab";
  return null;
}

/** Merge a GK backup or Drive copy. Restoring the same file twice never duplicates. */
export function importData(data, { markDirty = false, applyPrefs = false } = {}) {
  const kind = backupKind(data);
  if (kind === "vocab") throw new Error("This is a vocabulary backup — restore it under 📘 Vocabulary → Settings.");
  if (kind === "grammar") throw new Error("This is a grammar backup — restore it under 📗 Grammar → Settings.");
  if (kind === "quant") throw new Error("This is a Maths or Reasoning backup — restore it under 🔢 Maths or 🧩 Reasoning → Settings.");
  if (kind !== "gk") throw new Error("That file doesn't look like a VocabVault GK backup.");
  const incoming = (data.items || []).map((i) => makeItem(i)).filter((i) => !i.deleted);
  const before = state.items.filter((i) => !i.deleted);
  let added = 0;
  let updated = 0;
  const merged = [];
  for (const it of incoming) {
    const match = state.items.find((x) => x.id === it.id) ?? findDuplicate(it, before);
    if (!match) {
      added += 1;
      merged.push(it);
    } else if (String(it.updatedAt) > String(match.updatedAt)) {
      updated += 1;
      merged.push({ ...it, id: match.id });
    }
  }
  const deletions = (data.items || []).filter((i) => i.deleted).map((i) => makeItem(i));
  update(
    (s) => {
      s.items = mergeItems(s.items, [...merged, ...deletions]);
      s.featured = [...new Set([...s.featured, ...(data.featured || [])])];
      s.activity = [...new Set([...s.activity, ...(data.activity || [])])].sort().slice(-400);
      for (const [id, p] of Object.entries(data.bank || {})) {
        if (!id.startsWith(BANK_PREFIX)) continue;
        if (!s.bank[id] || String(p.updatedAt) > String(s.bank[id].updatedAt)) s.bank[id] = p;
      }
      for (const [k, d] of Object.entries(data.topicSeen || {})) if (!s.topicSeen[k] || d > s.topicSeen[k]) s.topicSeen[k] = d;
      s.practice = mergePractice(s.practice, data.practice);
      for (const a of Array.isArray(data.areas) ? data.areas : []) {
        if (!a?.id || !a.place) continue;
        const i = s.areas.findIndex((x) => x.id === a.id || sameAreaPlace(x.place, a.place));
        if (i < 0) s.areas.push(a);
        else if (String(a.updatedAt) > String(s.areas[i].updatedAt)) s.areas[i] = { ...a, id: s.areas[i].id };
      }
      if (applyPrefs && data.prefs) {
        s.prefs = { ...s.prefs, ...Object.fromEntries(Object.entries(data.prefs).filter(([k]) => k in DEFAULT_PREFS)) };
        s.daily = null;
      }
    },
    { touchesData: markDirty },
  );
  return { inBackup: incoming.length, added, updated, bankProgress: Object.keys(data.bank || {}).length };
}

export function resetAll() {
  const keepDrive = state.drive;
  state = { ...blank(), drive: keepDrive };
  save();
  for (const fn of listeners) fn(state);
}

export { answerKey, addDays };
