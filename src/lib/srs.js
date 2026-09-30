// Spaced repetition (Leitner boxes) and the daily plan: Word of the Day + N words to memorise.
import { todayISO, wordKey } from "./words.js";

/** Days until the next review for each box. Box 0 = never studied. */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
export const MASTERED_BOX = 5;

export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function stage(w) {
  if (w.box === 0 && w.reviews === 0) return "new";
  if (w.box >= MASTERED_BOX) return "mastered";
  return "learning";
}

/**
 * Apply a review result. grade: "again" (forgot), "hard", "good" (knew it), "easy".
 * Returns an updated copy of the word.
 */
export function review(w, grade, today = todayISO(), now = new Date()) {
  let box = w.box;
  let lapses = w.lapses;
  if (grade === "again") {
    lapses += 1;
    box = 1; // back to the start, but marked as seen
  } else if (grade === "hard") {
    box = Math.max(1, box);
  } else if (grade === "easy") {
    box = Math.min(INTERVALS.length - 1, box + 2);
  } else {
    box = Math.min(INTERVALS.length - 1, box + 1);
  }
  // "again" words come back tomorrow; others follow the box interval.
  const days = grade === "again" ? 1 : INTERVALS[box];
  return {
    ...w,
    box,
    lapses,
    reviews: w.reviews + 1,
    due: addDays(today, days),
    lastReviewed: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Small deterministic PRNG so a given date always produces the same picks. */
function seeded(seedStr) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1e9) / 1e9;
  };
}

/**
 * Build today's plan.
 * - Word of the Day: a word never featured before, preferring harder and starred words.
 * - Study list (size `count`): overdue reviews first, but at least ~30% fresh words when available,
 *   so new words keep flowing even when reviews pile up.
 * @returns {{date: string, wotd: string|null, ids: string[]}}
 */
export function buildDailyPlan(words, { count = 10, date = todayISO(), featured = [] } = {}) {
  const live = words.filter((w) => !w.deleted);
  const rand = seeded(date);
  const featuredSet = new Set(featured.map(wordKey));

  const pool = live.filter((w) => !featuredSet.has(wordKey(w.word)));
  const wotdPool = (pool.length ? pool : live)
    .map((w) => ({ w, score: w.difficulty + (w.starred ? 2 : 0) + (stage(w) === "new" ? 1 : 0) + rand() * 2.5 }))
    .sort((a, b) => b.score - a.score);
  const wotd = wotdPool[0]?.w ?? null;

  const rest = live.filter((w) => w !== wotd);
  const due = rest
    .filter((w) => stage(w) !== "new" && w.due <= date)
    .sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box);
  // New words in the order they were added (starred ones jump the queue).
  const fresh = rest
    .filter((w) => stage(w) === "new")
    .sort((a, b) => Number(b.starred) - Number(a.starred) || a.addedAt.localeCompare(b.addedAt));

  const n = Math.max(1, count);
  const minFresh = Math.min(fresh.length, Math.ceil(n * 0.3));
  const reviews = due.slice(0, n - minFresh);
  const news = fresh.slice(0, n - reviews.length);
  // Still short (few new words left)? Pull the weakest not-yet-due words forward.
  const extra = rest
    .filter((w) => !reviews.includes(w) && !news.includes(w) && stage(w) !== "new")
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due))
    .slice(0, Math.max(0, n - reviews.length - news.length));

  return { date, wotd: wotd?.id ?? null, ids: [...reviews, ...news, ...extra].map((w) => w.id) };
}

/** Current streak of consecutive days (ending today or yesterday) with at least one review. */
export function streak(activityDates, today = todayISO()) {
  const days = new Set(activityDates);
  let d = days.has(today) ? today : addDays(today, -1);
  let s = 0;
  while (days.has(d)) {
    s += 1;
    d = addDays(d, -1);
  }
  return s;
}

export function stats(words, today = todayISO()) {
  const live = words.filter((w) => !w.deleted);
  const by = { new: 0, learning: 0, mastered: 0 };
  for (const w of live) by[stage(w)] += 1;
  return { total: live.length, ...by, due: live.filter((w) => stage(w) !== "new" && w.due <= today).length };
}
