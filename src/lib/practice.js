// Practice scheduler: random questions that still cover EVERY item before any item repeats, with wrong
// answers coming back — a few questions later in the same session, and again in later sessions until
// answered correctly twice in a row. Pure functions; unit-tested.
//
// Coverage is kept per item ("asked" = how many times it has been practised), not per list. So practising
// one topic, a level filter or a different source ("Mixed" / "My words") still counts, and when the full
// list is practised again the items asked least (never-asked first) always come first.

export const RETRY_CORRECT_NEEDED = 2; // consecutive right answers that clear a "weak" item
export const RETRY_GAP = 3; // a wrong item comes back after this many other questions

/**
 * @typedef {{ asked: Record<string, number>,
 *             weak: Record<string, {need: number, wrong: number, right: number, last: number}> }} PracticeState
 */
export const emptyPractice = () => ({ asked: {}, weak: {} });

/**
 * Practice state in the current shape. Older versions kept a round number per source
 * ({rounds: {mine: {round, seen: {id: round}}}}); the round an item was last seen in is a good stand-in
 * for how many times it was asked.
 */
export function normalize(practice) {
  const p = practice || {};
  const asked = { ...(p.asked || {}) };
  for (const r of Object.values(p.rounds || {})) {
    for (const [id, n] of Object.entries(r?.seen || {})) asked[id] = Math.max(asked[id] ?? 0, Number(n) || 0);
  }
  return { asked, weak: { ...(p.weak || {}) } };
}

function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Progress through the pool: round N means every item has been asked at least N−1 times; `covered` items
 * have already been asked in this round. (`source` is kept for callers; coverage no longer depends on it.)
 */
export function coverage(pool, practice, source) {
  const { asked } = normalize(practice);
  if (!pool.length) return { round: 1, covered: 0, total: 0 };
  const counts = pool.map((w) => asked[w.id] ?? 0);
  const base = Math.min(...counts);
  return { round: base + 1, covered: counts.filter((n) => n > base).length, total: pool.length };
}

/** Words the learner currently gets wrong, weakest first. */
export const weakWords = (pool, practice) =>
  pool
    .filter((w) => practice.weak[w.id]?.need > 0)
    .sort((a, b) => practice.weak[b.id].wrong - practice.weak[a.id].wrong || practice.weak[a.id].last - practice.weak[b.id].last);

/**
 * Order ids so groups (topics) take turns: one from each topic, then the next round, … — so a session
 * mixes topics instead of finishing one chapter first. Order within a topic and of the topics is shuffled.
 */
export function interleave(ids, groupOf, rand = Math.random) {
  const groups = new Map();
  for (const id of ids) {
    const g = groupOf(id);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(id);
  }
  // Without `rand`, topics keep the order they first appear in (e.g. "revised longest ago" first).
  const lanes = rand ? shuffle([...groups.values()], rand) : [...groups.values()];
  const out = [];
  for (let i = 0; out.length < ids.length; i++) for (const lane of lanes) if (i < lane.length) out.push(lane[i]);
  return out;
}

/**
 * Pick the items for a new session of `size` questions.
 * Up to ~40% are weak items (wrong earlier); the rest are the items asked the fewest times — never-asked
 * items first, ties at random — so every item is covered before any item repeats, whatever filter or
 * source was used before. With `groupOf`, topics take turns within the session.
 * Returns {ids, roundOf, practice} (roundOf is kept for older callers; it is always {}).
 */
export function pickSession(pool, practice, source, size, rand = Math.random, groupOf = null) {
  const state = normalize(practice);
  const all = [...new Set(pool.map((w) => w.id))];
  const n = Math.min(size, all.length);
  const weak = weakWords(pool, state)
    .map((w) => w.id)
    .slice(0, Math.min(n, Math.ceil(size * 0.4)));
  const taken = new Set(weak);
  const fresh = shuffle(all.filter((id) => !taken.has(id)), rand)
    .sort((x, y) => (state.asked[x] ?? 0) - (state.asked[y] ?? 0))
    .slice(0, n - weak.length);
  // Least-asked first (so finishing a session early never skips a never-asked item); random within a
  // tier, and with `groupOf` topics take turns within each tier.
  const tiers = new Map();
  for (const id of fresh) {
    const k = state.asked[id] ?? 0;
    if (!tiers.has(k)) tiers.set(k, []);
    tiers.get(k).push(id);
  }
  const ordered = [...tiers.keys()].sort((x, y) => x - y).flatMap((k) => (groupOf ? interleave(tiers.get(k), groupOf, rand) : tiers.get(k)));
  // Weak items are spread evenly through the session, starting with the first question.
  const gap = weak.length ? Math.max(1, Math.floor(ordered.length / weak.length)) : Infinity;
  const ids = [];
  let wi = 0;
  const weakOrder = shuffle(weak, rand);
  ordered.forEach((id, i) => {
    if (wi < weakOrder.length && i % gap === 0) ids.push(weakOrder[wi++]);
    ids.push(id);
  });
  ids.push(...weakOrder.slice(wi));
  return { ids, roundOf: {}, practice: state };
}

/**
 * Record an answer. Wrong answers mark the word weak (needs 2 right in a row) and return a position
 * to re-ask it later in the same session; right answers count down a weak word's `need`.
 */
export function recordAnswer(practice, source, id, correct, { now = Date.now() } = {}) {
  const state = normalize(practice);
  state.asked[id] = (state.asked[id] ?? 0) + 1;
  const w = state.weak[id] ?? { need: 0, wrong: 0, right: 0, last: 0 };
  w.last = now;
  if (correct) {
    w.right += 1;
    w.need = Math.max(0, w.need - 1);
  } else {
    w.wrong += 1;
    w.need = RETRY_CORRECT_NEEDED;
  }
  if (w.need === 0 && w.wrong === 0) delete state.weak[id];
  else state.weak[id] = w;
  return state;
}

/** Count an item as asked without an answer (e.g. it had too few details for a question), so it can't block coverage. */
export function markAsked(practice, id) {
  const state = normalize(practice);
  state.asked[id] = (state.asked[id] ?? 0) + 1;
  return state;
}

/** Insert a wrongly answered id back into the session queue RETRY_GAP questions later (once per session). */
export function requeue(queue, position, id, alreadyRequeued) {
  if (alreadyRequeued.has(id)) return queue;
  alreadyRequeued.add(id);
  const q = [...queue];
  q.splice(Math.min(q.length, position + 1 + RETRY_GAP), 0, id);
  return q;
}

/** Merge two practice states (this device + Drive): the higher count per item, the newest weak-item info. */
export function mergePractice(a = emptyPractice(), b = emptyPractice()) {
  const x = normalize(a);
  const y = normalize(b);
  const out = { asked: { ...x.asked }, weak: {} };
  for (const [id, n] of Object.entries(y.asked)) out.asked[id] = Math.max(out.asked[id] ?? 0, n);
  for (const [id, w] of [...Object.entries(x.weak), ...Object.entries(y.weak)]) {
    if (!out.weak[id] || w.last > out.weak[id].last) out.weak[id] = w;
  }
  return out;
}
