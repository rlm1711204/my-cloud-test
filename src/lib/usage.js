// How much of each AI service's allowance has been used, for Settings → 📊 AI limits & usage.
// Three sources, in order of trust:
//   1. What a service says in its reply headers ("x-ratelimit-remaining-requests: 13980"), when the browser may read them.
//   2. What a service says when a limit is reached (Gemini names the limit and its size in a 429 reply).
//   3. The app's own count of today's requests (Gemini doesn't report what is left, so this is all there is until a limit
//      is hit). Gemini's daily allowance resets at midnight Pacific time, so its "today" is counted in that time zone.
// Kept on this phone only (never in backups). Keys are stored as a short fingerprint, never the key itself.
const KEY = "vv.usage.v1";
export const PACIFIC = "America/Los_Angeles";

let state = load();

function load() {
  try {
    const s = typeof localStorage === "undefined" ? null : JSON.parse(localStorage.getItem(KEY) || "null");
    return s && typeof s === "object" ? { days: {}, live: {}, limits: {}, hits: {}, ...s } : { days: {}, live: {}, limits: {}, hits: {} };
  } catch {
    return { days: {}, live: {}, limits: {}, hits: {} };
  }
}
function save() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: usage is only a convenience */
  }
}

/** A short fingerprint of a key (FNV-1a), so usage can be kept per key without storing the key. */
export function fingerprint(key) {
  let h = 0x811c9dc5;
  for (const ch of String(key)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
export const serviceId = (kind, key) => `${kind}:${fingerprint(key)}`;

/** The date (YYYY-MM-DD) in a time zone, or the phone's own when none is given. */
export function dayIn(tz, at = new Date()) {
  const opts = { year: "numeric", month: "2-digit", day: "2-digit" };
  if (tz) opts.timeZone = tz;
  return new Intl.DateTimeFormat("en-CA", opts).format(at);
}

function today(id, tz) {
  const day = dayIn(tz);
  const cur = state.days[id];
  if (!cur || cur.day !== day) state.days[id] = { day, requests: 0, chars: 0, models: {}, tz: tz || "" };
  return state.days[id];
}

/** One request sent (to `model`, if known). */
export function countRequest(id, { model = "", tz = "" } = {}) {
  const d = today(id, tz);
  d.requests += 1;
  if (model) d.models[model] = (d.models[model] || 0) + 1;
  save();
}

/** Characters sent to a service that counts characters (MyMemory translation). */
export function countChars(id, n, { tz = "" } = {}) {
  const d = today(id, tz);
  d.requests += 1;
  d.chars += Math.max(0, Number(n) || 0);
  save();
}

// ---------- rate-limit headers ----------
const toNum = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** "2m59.56s", "35s", "1h2m", "17" (seconds), an epoch in ms or s, or a date → milliseconds from now (or null). */
export function resetIn(v, now = Date.now()) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 1e12) return Math.max(0, n - now); // epoch ms
    if (n > 1e9) return Math.max(0, n * 1000 - now); // epoch s
    return n * 1000; // seconds
  }
  const m = /^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?$/.exec(s);
  if (m && m[0]) return ((Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)) * 1000 + (Number(m[4]) || 0);
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.max(0, t - now) : null;
}

/** A readable name for a header suffix: "requests-day" → "requests today", "tokens-minute" → "tokens this minute". */
function labelOf(suffix) {
  const s = suffix.replace(/^-|-$/g, "") || "requests";
  const what = /token/.test(s) ? s.replace(/-?(minute|day|hour|month)$/, "").replace(/-/g, " ") : /req/.test(s) ? "requests" : s.replace(/-/g, " ");
  const when = /day/.test(s) ? " today" : /minute/.test(s) ? " this minute" : /hour/.test(s) ? " this hour" : "";
  return `${what}${when}`;
}

/**
 * Rate limits in reply headers, from any service: x-ratelimit-{limit|remaining|reset}-<what> (Groq, Cerebras, OpenAI
 * style), x-ratelimit-{limit|remaining|reset} (OpenRouter) and anthropic-ratelimit-<what>-{limit|remaining|reset}
 * (Claude). `get(name)` reads one header; `names` lists the readable ones. Returns [{label, limit, remaining, resetMs}].
 */
export function parseRateHeaders(names, get, now = Date.now()) {
  const groups = new Map();
  for (const raw of names) {
    const n = raw.toLowerCase();
    let m = /^x-ratelimit-(limit|remaining|reset)(.*)$/.exec(n);
    let kind;
    let suffix;
    if (m) [, kind, suffix] = m;
    else if ((m = /^anthropic-ratelimit-(.+)-(limit|remaining|reset)$/.exec(n))) [, suffix, kind] = m;
    else continue;
    const g = groups.get(suffix) || {};
    g[kind] = get(raw);
    groups.set(suffix, g);
  }
  const out = [];
  for (const [suffix, g] of groups) {
    const remaining = toNum(g.remaining);
    if (remaining == null) continue;
    out.push({ label: labelOf(suffix), limit: toNum(g.limit), remaining, resetMs: resetIn(g.reset, now) });
  }
  return out;
}

/** Keep the rate limits a reply's headers show (if the browser may read any). */
export function noteHeaders(id, headers) {
  if (!headers?.forEach) return;
  const names = [];
  headers.forEach((_, k) => names.push(k));
  const limits = parseRateHeaders(names, (k) => headers.get(k));
  if (!limits.length) return;
  state.live[id] = { at: Date.now(), limits };
  save();
}

// ---------- limits a service names when they are reached ----------
/**
 * Gemini's 429 reply names the limit that was reached and its size:
 * details: [{@type: …QuotaFailure, violations: [{quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
 * quotaDimensions: {model}, quotaValue: "250"}]}, {@type: …RetryInfo, retryDelay: "35s"}].
 * Returns {limits: [{model, per: "day"|"minute", what: "requests"|"tokens", value}], retryMs}.
 */
export function parseGeminiQuota(error) {
  const limits = [];
  let retryMs = null;
  for (const d of error?.details || []) {
    const type = String(d["@type"] || "");
    if (/QuotaFailure/.test(type)) {
      for (const v of d.violations || []) {
        const id = String(v.quotaId || v.quotaMetric || "");
        const value = toNum(v.quotaValue);
        limits.push({
          model: v.quotaDimensions?.model || "",
          per: /PerDay/i.test(id) ? "day" : /PerMinute/i.test(id) ? "minute" : "",
          what: /Token/i.test(id) ? "tokens" : "requests",
          value,
        });
      }
    } else if (/RetryInfo/.test(type)) retryMs = resetIn(d.retryDelay);
  }
  return { limits, retryMs };
}

/** A limit was reached: remember what the service said (the limit and when to try again). */
export function noteLimitHit(id, { model = "", limits = [], retryMs = null, tz = "" } = {}) {
  const now = Date.now();
  state.hits[id] = { at: now, day: dayIn(tz), model, until: retryMs != null ? now + retryMs : null, limits };
  for (const l of limits) {
    if (!l.value || !l.per) continue;
    const m = l.model || model || "any";
    state.limits[id] ??= {};
    state.limits[id][`${m}|${l.per}|${l.what}`] = { model: m, per: l.per, what: l.what, value: l.value, at: now };
  }
  save();
}

/** Everything known about one service or key. */
export function usageOf(id, tz = "") {
  const d = state.days[id];
  const day = dayIn(tz || d?.tz || "");
  const t = d && d.day === day ? d : { requests: 0, chars: 0, models: {} };
  const hit = state.hits[id];
  return {
    today: { requests: t.requests, chars: t.chars, models: { ...t.models } },
    live: state.live[id] || null,
    limits: Object.values(state.limits[id] || {}),
    hit: hit && hit.day === day ? hit : null,
  };
}

/** The next midnight in a time zone, as a Date (for "resets at 12:30 pm"). */
export function nextMidnight(tz, now = new Date()) {
  // Walk forward a minute at a time from the next whole hour until the date in `tz` changes (at most a day).
  const start = dayIn(tz, now);
  const t = new Date(now);
  t.setMinutes(0, 0, 0);
  for (let i = 0; i < 26 * 60; i += 15) {
    const probe = new Date(t.getTime() + i * 60000);
    if (dayIn(tz, probe) !== start) {
      // refine to the minute
      for (let back = 15; back > 0; back--) {
        const p = new Date(probe.getTime() - back * 60000);
        if (dayIn(tz, p) !== start) return p;
      }
      return probe;
    }
  }
  return new Date(now.getTime() + 864e5);
}

export function resetUsage() {
  state = { days: {}, live: {}, limits: {}, hits: {} };
  save();
}
