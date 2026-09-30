// Practice scheduler: random questions that still cover EVERY word in a source before any word
// repeats (a "round"), with wrong answers coming back — a few questions later in the same session,
// and again in later sessions until answered correctly twice in a row. Pure functions; unit-tested.

export const RETRY_CORRECT_NEEDED = 2; // consecutive right answers that clear a "weak" word
export const RETRY_GAP = 3; // a wrong word comes back after this many other questions

/**
 * @typedef {{ rounds: Record<string, {round: number, seen: Record<string, number>}>,
 *             weak: Record<string, {need: number, wrong: number, right: number, last: number}> }} PracticeState
 */
export const emptyPractice = () => ({ rounds: {}, weak: {} });

function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Round progress for a source: how many of the pool's words were asked in the current round. */
export function coverage(pool, practice, source) {
  const r = practice.rounds[source] ?? { round: 1, seen: {} };
  const covered = pool.filter((w) => r.seen[w.id] === r.round).length;
  return { round: r.round, covered, total: pool.length };
}

/** Words the learner currently gets wrong, weakest first. */
export const weakWords = (pool, practice) =>
  pool
    .filter((w) => practice.weak[w.id]?.need > 0)
    .sort((a, b) => practice.weak[b.id].wrong - practice.weak[a.id].wrong || practice.weak[a.id].last - practice.weak[b.id].last);

/**
 * Pick the words for a new session of `size` questions.
 * Up to ~40% are weak words (wrong earlier); the rest are words not yet asked in the current round,
 * at random. When the round runs out, a new round starts, so every word is covered periodically.
 * Returns the chosen ids and the updated practice state (round bookkeeping happens here).
 */
export function pickSession(pool, practice, source, size, rand = Math.random) {
  const state = structuredClone(practice);
  const r = (state.rounds[source] ??= { round: 1, seen: {} });
  const ids = new Set(pool.map((w) => w.id));
  const chosen = [];

  const weak = weakWords(pool, state).map((w) => w.id);
  for (const id of weak.slice(0, Math.ceil(size * 0.4))) chosen.push(id);

  const take = () => shuffle(pool.filter((w) => r.seen[w.id] !== r.round && !chosen.includes(w.id)).map((w) => w.id), rand);
  // Words from the current round come first, so a round always finishes before the next begins.
  const segments = [chosen];
  let fresh = take();
  while (chosen.length < Math.min(size, ids.size)) {
    if (!fresh.length) {
      r.round += 1; // everything covered: start the next round
      segments.push([]);
      fresh = take();
      if (!fresh.length) break;
    }
    const id = fresh.shift();
    chosen.push(id);
    if (segments.length > 1) segments.at(-1).push(id);
  }
  const first = chosen.filter((id) => !segments.slice(1).some((seg) => seg.includes(id)));
  // Which round each word counts towards (pass it to recordAnswer).
  const startRound = r.round - (segments.length - 1);
  const roundOf = Object.fromEntries(first.map((id) => [id, startRound]));
  segments.slice(1).forEach((seg, i) => seg.forEach((id) => (roundOf[id] = startRound + 1 + i)));
  return { ids: [...shuffle(first, rand), ...segments.slice(1).flatMap((seg) => shuffle(seg, rand))], roundOf, practice: state };
}

/**
 * Record an answer. Wrong answers mark the word weak (needs 2 right in a row) and return a position
 * to re-ask it later in the same session; right answers count down a weak word's `need`.
 */
export function recordAnswer(practice, source, id, correct, { now = Date.now(), round } = {}) {
  const state = structuredClone(practice);
  const r = (state.rounds[source] ??= { round: 1, seen: {} });
  r.seen[id] = Math.max(r.seen[id] ?? 0, round ?? r.round);
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

/** Insert a wrongly answered id back into the session queue RETRY_GAP questions later (once per session). */
export function requeue(queue, position, id, alreadyRequeued) {
  if (alreadyRequeued.has(id)) return queue;
  alreadyRequeued.add(id);
  const q = [...queue];
  q.splice(Math.min(q.length, position + 1 + RETRY_GAP), 0, id);
  return q;
}

/** Merge two practice states (this device + Drive): keep the newest info per word, highest round. */
export function mergePractice(a = emptyPractice(), b = emptyPractice()) {
  const out = emptyPractice();
  for (const src of new Set([...Object.keys(a.rounds || {}), ...Object.keys(b.rounds || {})])) {
    const x = a.rounds?.[src] ?? { round: 1, seen: {} };
    const y = b.rounds?.[src] ?? { round: 1, seen: {} };
    const seen = { ...x.seen };
    for (const [id, n] of Object.entries(y.seen)) seen[id] = Math.max(seen[id] ?? 0, n);
    out.rounds[src] = { round: Math.max(x.round, y.round), seen };
  }
  for (const [id, w] of [...Object.entries(a.weak || {}), ...Object.entries(b.weak || {})]) {
    if (!out.weak[id] || w.last > out.weak[id].last) out.weak[id] = w;
  }
  return out;
}
