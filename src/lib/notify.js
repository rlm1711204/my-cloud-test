// Daily "2 words for today" notification.
// The page prepares the next 14 days of words in Cache Storage; the service worker shows them from a
// Periodic Background Sync event (Chrome on Android, app installed to the home screen). Browsers decide
// the exact timing, so the notification arrives some time after the chosen hour, not at an exact minute.
import { addDays } from "./srs.js";
import { todayISO } from "./words.js";

export const NOTIFY_CACHE = "vv-notify";
export const NOTIFY_TAG = "vv-daily-words";
const DAYS_AHEAD = 14;
const MS_PER_DAY = 86400000;

function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Two words for a date, rotating through the whole pool so every word comes up in turn
 * (a fixed shuffled order; day N shows words 2N and 2N+1). Pure; unit-tested.
 */
export function wordsForDay(pool, date = todayISO(), perDay = 2) {
  if (!pool.length) return [];
  const order = [...pool].sort((a, b) => hash(a.id) - hash(b.id) || String(a.id).localeCompare(String(b.id)));
  const day = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / MS_PER_DAY);
  const n = Math.min(perDay, order.length);
  return Array.from({ length: n }, (_, i) => order[(day * perDay + i) % order.length]);
}

const brief = (w) => ({ id: w.id, w: w.word, m: String(w.meaning || "").slice(0, 90), h: String(w.hindi || "").split(",")[0].trim() });

export const notifyText = (words) => words.map((x) => `${x.w} — ${x.m}${x.h ? ` (${x.h})` : ""}`).join("\n");

async function cacheKey() {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  return new URL("notify.json", reg?.scope || location.href).href;
}

/** Write the next two weeks of notification words for the service worker (keeps its "last shown" date). */
export async function writeSchedule(pool, notify) {
  if (!("caches" in window)) return;
  const cache = await caches.open(NOTIFY_CACHE);
  const key = await cacheKey();
  let lastShown = null;
  try {
    lastShown = (await (await cache.match(key))?.json())?.lastShown ?? null;
  } catch {
    /* no previous schedule */
  }
  const days = {};
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = addDays(todayISO(), i);
    days[d] = wordsForDay(pool, d).map(brief);
  }
  const payload = { enabled: Boolean(notify.enabled), hour: Number(notify.hour) || 8, days, lastShown, updated: Date.now() };
  await cache.put(key, new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }));
}

/** What this phone/browser supports. */
export async function capability() {
  const out = { notifications: "Notification" in window, permission: window.Notification?.permission ?? "unsupported", periodic: false, periodicAllowed: false };
  const reg = await navigator.serviceWorker?.getRegistration?.();
  out.periodic = Boolean(reg && "periodicSync" in reg);
  if (out.periodic) {
    try {
      out.periodicAllowed = (await navigator.permissions.query({ name: "periodic-background-sync" })).state === "granted";
    } catch {
      out.periodicAllowed = false;
    }
  }
  return out;
}

/** Ask for permission and register the daily background check. Returns a status message. */
export async function enable() {
  if (!("Notification" in window)) throw new Error("This browser can't show notifications.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications are blocked. Allow them for this site in your browser settings.");
  const reg = await navigator.serviceWorker?.ready;
  if (reg && "periodicSync" in reg) {
    try {
      await reg.periodicSync.register(NOTIFY_TAG, { minInterval: 6 * 60 * 60 * 1000 });
      return "scheduled";
    } catch {
      return "no-background"; // usually: the app isn't installed to the home screen yet
    }
  }
  return "no-background";
}

export async function disable() {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  try {
    await reg?.periodicSync?.unregister(NOTIFY_TAG);
  } catch {
    /* ignore */
  }
}

/** Show today's words right now (the "Send test notification" button). */
export async function showNow(words) {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  const body = notifyText(words.map(brief));
  const opts = { body, icon: "icon-192.png", badge: "icon-192.png", tag: "vv-daily", data: { url: "./#today" } };
  if (reg) return reg.showNotification("📘 Your 2 words for today", opts);
  return new Notification("📘 Your 2 words for today", opts);
}
