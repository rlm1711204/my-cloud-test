// Maths and Reasoning data — two separate parts, each with its own storage key, backup file and Google Drive file
// (createQuantStore makes one store per subject). Items are questions (with practice questions linked to them) and
// formula / trick cards, filed by topic → question type. Anything added to one part that belongs to the other subject
// is handed over to it. Revision is planned so every topic comes round (same planner as GK).
import { emptyPractice, mergePractice, normalize } from "./practice.js";
import { stage } from "./srs.js";
import { todayISO } from "./words.js";
import { buildGkPlan } from "./gk-store.js";
import { mergeItems } from "./gk.js";
import { BOOK_PREFIX, bookRecord, isBookId, qbookLoaded } from "./qbook.js";
import { QUANT, REASONING, SEP, qPatternKey, qTopicKey } from "./quant-taxonomy.js";
import { findDuplicateQ, makeQItem, matchPattern } from "./quant.js";

export const DATA_VERSION = 1;
export const SOURCES = { mine: "My notes", book: "Formula Book", mixed: "Mixed" };
export const APPS = { [QUANT]: "VocabVault-Quant", [REASONING]: "VocabVault-Reasoning" };

const DEFAULT_PREFS = {
  dailyCount: 10,
  dailySource: "mixed",
  practiceSource: "mixed",
  practiceSize: 15,
  excluded: [], // topic keys left out of practice
  excludeToday: false,
  variants: true, // add 2 practice questions to every new question (AI or copied prompt)
};

/** Which part of VocabVault a backup file belongs to: "vocab", "grammar", "gk", "quant" (Maths), "reasoning" or null. */
export function backupKind(data) {
  if (!data || typeof data !== "object") return null;
  if (data.app === APPS[QUANT]) return "quant";
  if (data.app === APPS[REASONING]) return "reasoning";
  if (data.app === "VocabVault-GK") return "gk";
  if (data.app === "VocabVault-Grammar" || Array.isArray(data.rules)) return "grammar";
  if (data.app === "VocabVault" || Array.isArray(data.words)) return "vocab";
  if (Array.isArray(data.items)) {
    const q = data.items.filter((i) => i && (i.kind === "formula" || "solution" in i));
    if (!q.length) return "gk";
    return q.filter((i) => i.subject === REASONING).length > q.length / 2 ? "reasoning" : "quant";
  }
  return null;
}

let saveErrorHandler = null;
/** Called when the phone refuses to store more (usually too many figure photos). */
export const onSaveError = (fn) => (saveErrorHandler = fn);

/**
 * One part's store. cfg: {subject: "Quant" | "Reasoning", key: localStorage key, name: "Maths", other: () => the other store}.
 */
export function createQuantStore(cfg) {
  const KEY = cfg.key;
  const BACKUP_APP = APPS[cfg.subject];
  const mine = (it) => it.subject === cfg.subject;
  cfg.name ??= cfg.subject === QUANT ? "Maths" : "Reasoning";


  function blank() {
    return {
      version: DATA_VERSION,
      items: [],
      featured: [],
      activity: [],
      daily: null,
      bank: {}, // Formula Book progress: id -> {box, due, reviews, lapses, lastReviewed, starred, updatedAt}
      practice: emptyPractice(),
      topicSeen: {},
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
      s.items = (s.items || []).map((i) => makeQItem(i));
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
      console.warn(`Could not save ${cfg.name} data`, e);
      saveErrorHandler?.(e, cfg.name);
    }
  }

  const get = () => state;
  const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

  function update(mutator, { touchesData = true } = {}) {
    mutator(state);
    if (touchesData) state.dirty = true;
    save();
    for (const fn of listeners) fn(state);
  }

  const liveItems = () => state.items.filter((i) => !i.deleted);
  const bookItems = () => (qbookLoaded() || []).filter(mine).map((e) => bookRecord(e, state.bank[e.id]));

  function isExcluded(item, excluded = state.prefs.excluded) {
    if (!excluded?.length) return false;
    const key = qPatternKey(item);
    return excluded.some((x) => key === x || key.startsWith(x + SEP));
  }

  /** Items for a source ("mine", "book", "mixed"); `forPractice` applies the topic filter. */
  function itemsFor(source, { forPractice = false, forToday = false } = {}) {
    const mine = liveItems();
    let list = source === "mine" ? mine : source === "book" ? bookItems() : [...mine, ...bookItems().filter((b) => !findDuplicateQ(b, mine))];
    if (forPractice || (forToday && state.prefs.excludeToday)) list = list.filter((i) => !isExcluded(i));
    return list;
  }

  function byId(id) {
    if (isBookId(id)) {
      const e = (qbookLoaded() || []).find((x) => x.id === id);
      return e ? bookRecord(e, state.bank[id]) : null;
    }
    return state.items.find((i) => i.id === id && !i.deleted) ?? null;
  }

  const FILLABLE = ["figure", "image", "draw", "solution", "formula", "trick", "pattern"];
  const PROGRESS_FIELDS = ["box", "due", "reviews", "lapses", "lastReviewed", "starred"];

  function updateItem(id, fn) {
    const cur = byId(id);
    if (!cur) return;
    const next = fn(cur);
    update((s) => {
      if (isBookId(id)) s.bank[id] = { ...Object.fromEntries(PROGRESS_FIELDS.map((k) => [k, next[k]])), updatedAt: new Date().toISOString() };
      else s.items = s.items.map((i) => (i.id === id ? makeQItem({ ...next, updatedAt: new Date().toISOString() }) : i));
    });
  }

  function markTopic(item) {
    const key = qTopicKey(item);
    const today = todayISO();
    update(
      (s) => {
        s.topicSeen[key] = today;
        if (!s.activity.includes(today)) s.activity.push(today);
      },
      { touchesData: false },
    );
  }

  /** Question types already used, per topic: {"Quant › Time & Work": ["Two workers together", …]}. */
  function patternsByTopic(items = liveItems()) {
    const out = {};
    for (const it of items) {
      if (it.kind !== "question" || !it.pattern) continue;
      const k = qTopicKey(it);
      (out[k] ??= []).includes(it.pattern) || out[k].push(it.pattern);
    }
    return out;
  }

  /**
   * Add items, skipping any already saved. Practice questions keep pointing at their question even when that question
   * was already saved (they then join the saved one). Type names are matched to the topic's existing types.
   * Items of the other subject (a reasoning question in maths notes) are handed to the other part.
   * Returns {added, skipped, moved}: moved = items added to the other part.
   */
  function addItems(list) {
    const subjectOf = (x) => makeQItem(x).subject;
    const foreign = list.filter((x) => subjectOf(x) !== cfg.subject);
    let moved = [];
    if (foreign.length && cfg.other) {
      const r = cfg.other().addItems(foreign);
      moved = r.added;
      list = list.filter((x) => !foreign.includes(x));
    }
    const added = [];
    const skipped = [];
    const filled = []; // details added to items already saved
    const existing = liveItems();
    const idMap = new Map(); // id in the list → id it ends up with
    const types = patternsByTopic(existing);
    const t0 = Date.now();
    for (const [n, input] of list.entries()) {
      // One millisecond apart, so a question and its practice questions keep their order.
      let it = makeQItem({ ...input, addedAt: input.addedAt || new Date(t0 + n).toISOString() });
      const known = types[qTopicKey(it)] ?? [];
      if (it.kind === "question" && it.pattern) {
        it = { ...it, pattern: matchPattern(it.pattern, known) };
        if (!known.includes(it.pattern)) (types[qTopicKey(it)] ??= []).push(it.pattern);
      }
      if (it.variantOf && idMap.has(it.variantOf)) it = { ...it, variantOf: idMap.get(it.variantOf) };
      const dup = findDuplicateQ(it, [...existing, ...added]);
      if (dup) {
        idMap.set(input.id ?? it.id, dup.id);
        skipped.push({ q: it.q, existing: dup.q });
        // The saved copy gets anything it was missing (a figure, solution, trick…).
        const fill = Object.fromEntries(FILLABLE.filter((k) => !dup[k] && it[k]).map((k) => [k, it[k]]));
        if (dup.kind === "question" && dup.options.length < 3 && it.options.length >= 3) fill.options = it.options;
        if (Object.keys(fill).length) filled.push({ id: dup.id, fill });
      } else {
        idMap.set(input.id ?? it.id, it.id);
        added.push(it);
      }
    }
    if (added.length) update((s) => (s.items = mergeItems(s.items, added)));
    const now = new Date().toISOString();
    for (const { id, fill } of filled) {
      if (isBookId(id)) continue;
      update((s) => (s.items = s.items.map((i) => (i.id === id ? makeQItem({ ...i, ...fill, updatedAt: now }) : i))));
    }
    return { added, skipped, moved, filled: filled.filter((f) => !isBookId(f.id)) };
  }

  function saveItem(input) {
    const it = makeQItem({ ...input, updatedAt: new Date().toISOString() });
    update((s) => {
      const i = s.items.findIndex((x) => x.id === it.id);
      if (i >= 0) s.items[i] = it;
      else s.items.unshift(it);
    });
    return it;
  }

  /** Practice questions made from a question. */
  const variantsOf = (id) => liveItems().filter((i) => i.variantOf === id);

  /** Delete an item; deleting a question also deletes its practice questions. Returns how many were deleted. */
  function deleteItem(id) {
    const ids = new Set([id, ...variantsOf(id).map((v) => v.id)]);
    const now = new Date().toISOString();
    update((s) => {
      s.items = s.items.map((i) => (ids.has(i.id) ? { ...i, deleted: true, updatedAt: now } : i));
    });
    return ids.size;
  }

  function addBookItemToMine(id) {
    const b = byId(id);
    if (!b || !isBookId(id)) return null;
    const { added } = addItems([{ ...b, id: undefined, book: undefined, source: "Formula Book", addedAt: undefined, updatedAt: undefined }]);
    return added[0] ?? null;
  }

  /** Every item of one question type ("Quant › Time & Work › Two workers together"): oldest question first, each followed by its practice questions, then formula cards. */
  function itemsOfPattern(key, source = "mixed") {
    const list = itemsFor(source).filter((i) => qPatternKey(i) === key);
    const byAge = (a, b) => String(a.addedAt).localeCompare(String(b.addedAt)) || a.id.localeCompare(b.id);
    const questions = list.filter((i) => i.kind === "question").sort(byAge);
    const originals = questions.filter((i) => !i.variantOf || !questions.some((x) => x.id === i.variantOf));
    return [...originals.flatMap((o) => [o, ...questions.filter((v) => v.variantOf === o.id)]), ...list.filter((i) => i.kind === "formula")];
  }

  /** Counts for subject → topic → type: questions, formulas, covered in this practice round, mastered, weak, due. */
  function qTopicTree(items, practice = state.practice, today = todayISO()) {
    const { asked } = normalize(practice);
    const base = items.length ? Math.min(...items.map((it) => asked[it.id] ?? 0)) : 0;
    const tree = new Map();
    const bump = (key, it) => {
      if (!tree.has(key)) tree.set(key, { key, total: 0, questions: 0, formulas: 0, covered: 0, mastered: 0, weak: 0, due: 0, fresh: 0 });
      const n = tree.get(key);
      n.total += 1;
      n[it.kind === "formula" ? "formulas" : "questions"] += 1;
      if ((asked[it.id] ?? 0) > base) n.covered += 1;
      if (stage(it) === "mastered") n.mastered += 1;
      if (stage(it) === "new") n.fresh += 1;
      if (practice.weak?.[it.id]?.need) n.weak += 1;
      if (stage(it) !== "new" && it.due <= today) n.due += 1;
    };
    for (const it of items) {
      const parts = qPatternKey(it).split(SEP);
      for (let i = 1; i <= parts.length; i++) bump(parts.slice(0, i).join(SEP), it);
    }
    return tree;
  }

  /** Subject → topic → type keys for the items, in a stable order (Quant first). */
  function qBuildTree(items, { withTypes = true } = {}) {
    const children = new Map([["", new Set()]]);
    for (const it of items) {
      const parts = (withTypes ? qPatternKey(it) : qTopicKey(it)).split(SEP);
      let parent = "";
      for (let i = 1; i <= parts.length; i++) {
        const key = parts.slice(0, i).join(SEP);
        if (!children.has(parent)) children.set(parent, new Set());
        children.get(parent).add(key);
        if (!children.has(key)) children.set(key, new Set());
        parent = key;
      }
    }
    const order = (a, b) => (a.startsWith("Quant") === b.startsWith("Quant") ? a.localeCompare(b) : a.startsWith("Quant") ? -1 : 1);
    return new Map([...children].map(([k, set]) => [k, [...set].sort(order)]));
  }

  // ---------- Today ----------
  function todaysPlan() {
    const today = todayISO();
    const d = state.daily;
    const { dailySource: source, dailyCount: count } = state.prefs;
    const pool = itemsFor(source, { forToday: true });
    const sig = `${source}|${count}|${state.prefs.excludeToday ? state.prefs.excluded.join(",") : ""}`;
    const build = () =>
      buildGkPlan(pool, { count, date: today, featured: state.featured, topicSeen: state.topicSeen, groupOf: qTopicKey, featuredOk: () => true });
    if (!d || d.date !== today || d.sig !== sig) {
      const plan = build();
      const done = d && d.date === today ? d.done : {};
      update(
        (s) => {
          s.daily = { ...plan, sig, done };
          if (plan.wotd && !s.featured.includes(plan.wotd)) s.featured.push(plan.wotd);
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

  // ---------- backups ----------
  const exportData = () => ({
    app: BACKUP_APP,
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    items: state.items,
    featured: state.featured,
    activity: state.activity,
    bank: state.bank,
    practice: state.practice,
    topicSeen: state.topicSeen,
    prefs: state.prefs,
  });


  /**
   * Merge a backup or Drive copy of this part. Restoring the same file twice never duplicates. An older combined
   * "Maths & Reasoning" backup restored under Maths hands its reasoning cards to the Reasoning part.
   */
  function importData(data, { markDirty = false, applyPrefs = false } = {}) {
    const kind = backupKind(data);
    const own = cfg.subject === QUANT ? "quant" : "reasoning";
    if (kind === "vocab") throw new Error("This is a vocabulary backup — restore it under 📘 Vocabulary → Settings.");
    if (kind === "grammar") throw new Error("This is a grammar backup — restore it under 📗 Grammar → Settings.");
    if (kind === "gk") throw new Error("This is a GK backup — restore it under 🌍 GK → Settings.");
    if (kind === "quant" && own !== "quant") throw new Error("This is a Maths backup — restore it under 🔢 Maths → Settings (any reasoning cards in it go to Reasoning automatically).");
    if (kind === "reasoning" && own !== "reasoning") throw new Error("This is a Reasoning backup — restore it under 🧩 Reasoning → Settings.");
    if (kind !== own) throw new Error(`That file doesn't look like a VocabVault ${cfg.name} backup.`);
    const all = (data.items || []).map((i) => makeQItem(i));
    let movedToOther = 0;
    const foreign = (data.items || []).filter((_, n) => !mine(all[n]));
    if (foreign.length && cfg.other) {
      const other = cfg.other();
      movedToOther = other.importData({ app: other.BACKUP_APP, items: foreign, practice: data.practice, bank: data.bank }, { markDirty }).inBackup;
    }
    const incoming = all.filter((i) => !i.deleted && mine(i));
    const before = state.items.filter((i) => !i.deleted);
    let added = 0;
    let updated = 0;
    const merged = [];
    for (const it of incoming) {
      const match = state.items.find((x) => x.id === it.id) ?? findDuplicateQ(it, before);
      if (!match) {
        added += 1;
        merged.push(it);
      } else if (String(it.updatedAt) > String(match.updatedAt)) {
        updated += 1;
        merged.push({ ...it, id: match.id });
      }
    }
    const deletions = all.filter((i) => i.deleted && mine(i));
    update(
      (s) => {
        s.items = mergeItems(s.items, [...merged, ...deletions]);
        s.featured = [...new Set([...s.featured, ...(data.featured || [])])];
        s.activity = [...new Set([...s.activity, ...(data.activity || [])])].sort().slice(-400);
        const book = qbookLoaded();
        for (const [id, p] of Object.entries(data.bank || {})) {
          if (!id.startsWith(BOOK_PREFIX)) continue;
          if (book && !book.some((e) => e.id === id && mine(e))) continue; // the other part's Formula Book card
          if (!s.bank[id] || String(p.updatedAt) > String(s.bank[id].updatedAt)) s.bank[id] = p;
        }
        for (const [k, d] of Object.entries(data.topicSeen || {})) if (!s.topicSeen[k] || d > s.topicSeen[k]) s.topicSeen[k] = d;
        s.practice = mergePractice(s.practice, data.practice);
        if (applyPrefs && data.prefs) {
          s.prefs = { ...s.prefs, ...Object.fromEntries(Object.entries(data.prefs).filter(([k]) => k in DEFAULT_PREFS)) };
          s.daily = null;
        }
      },
      { touchesData: markDirty },
    );
    return { inBackup: incoming.length, added, updated, movedToOther, bookProgress: Object.keys(data.bank || {}).length };
  }

  /**
   * Hand over everything that belongs to the other part (from the time Maths and Reasoning were one part): cards,
   * their Formula Book progress, practice history and topic dates. Needs the Formula Book loaded. Returns how many cards moved.
   */
  function handOver() {
    const other = cfg.other?.();
    const book = qbookLoaded();
    if (!other || !book) return 0;
    const items = state.items.filter((i) => !mine(i));
    const bookIds = new Set(book.filter((e) => !mine(e)).map((e) => e.id));
    const bank = Object.fromEntries(Object.entries(state.bank).filter(([id]) => bookIds.has(id)));
    const topics = Object.fromEntries(Object.entries(state.topicSeen).filter(([k]) => !k.startsWith(cfg.subject + SEP)));
    if (!items.length && !Object.keys(bank).length && !Object.keys(topics).length) return 0;
    const ids = new Set([...items.map((i) => i.id), ...bookIds]);
    const pick = (o) => Object.fromEntries(Object.entries(o || {}).filter(([id]) => ids.has(id)));
    other.update((s) => {
      s.items = mergeItems(s.items, items);
      for (const [id, p] of Object.entries(bank)) if (!s.bank[id] || String(p.updatedAt) > String(s.bank[id].updatedAt)) s.bank[id] = p;
      for (const [k, d] of Object.entries(topics)) if (!s.topicSeen[k] || d > s.topicSeen[k]) s.topicSeen[k] = d;
      s.practice = mergePractice(s.practice, { asked: pick(state.practice.asked), weak: pick(state.practice.weak) });
      s.activity = [...new Set([...s.activity, ...state.activity])].sort().slice(-400);
      s.daily = null;
    });
    update((s) => {
      s.items = s.items.filter((i) => mine(i));
      for (const id of Object.keys(bank)) delete s.bank[id];
      for (const k of Object.keys(topics)) delete s.topicSeen[k];
      s.practice = { asked: Object.fromEntries(Object.entries(s.practice.asked).filter(([id]) => !ids.has(id))), weak: Object.fromEntries(Object.entries(s.practice.weak).filter(([id]) => !ids.has(id))) };
      s.daily = null;
    });
    return items.length;
  }

  function resetAll() {
    const keepDrive = state.drive;
    state = { ...blank(), drive: keepDrive };
    save();
    for (const fn of listeners) fn(state);
  }

  return {
    subject: cfg.subject,
    name: cfg.name,
    BACKUP_APP,
    handOver,
    get,
    subscribe,
    update,
    liveItems,
    bookItems,
    isExcluded,
    itemsFor,
    byId,
    updateItem,
    markTopic,
    patternsByTopic,
    addItems,
    saveItem,
    variantsOf,
    deleteItem,
    addBookItemToMine,
    itemsOfPattern,
    qTopicTree,
    qBuildTree,
    todaysPlan,
    exportData,
    importData,
    resetAll,
  };
}
