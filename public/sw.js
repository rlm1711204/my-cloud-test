// Offline support: cache the app shell so the daily revision works without internet.
const CACHE = "vocabvault-v3";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== "vv-notify").map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // never cache API calls
  if (e.request.mode === "navigate") {
    // Always fetch the page fresh (skip the browser's HTTP cache) so a new version shows up on the
    // very next open; fall back to the cached shell only when offline.
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }
  // Hashed build assets never change: cache first.
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        }),
    ),
  );
});

// ---------- Daily "2 words for today" notification ----------
// The app writes the next 14 days of words into the "vv-notify" cache; Chrome wakes this worker
// periodically (Periodic Background Sync) and we show the day's words once, after the chosen hour.
const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

async function showDailyWords() {
  const cache = await caches.open("vv-notify");
  const key = new URL("notify.json", self.registration.scope).href;
  const res = await cache.match(key);
  if (!res) return;
  const p = await res.json();
  const now = new Date();
  const today = localDate(now);
  if (!p.enabled || p.lastShown === today || now.getHours() < p.hour) return;
  const words = p.days?.[today];
  if (!words?.length) return;
  await self.registration.showNotification("📘 Your 2 words for today", {
    body: words.map((x) => `${x.w} — ${x.m}${x.h ? ` (${x.h})` : ""}`).join("\n"),
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: "vv-daily",
    data: { url: "./#today" },
  });
  p.lastShown = today;
  await cache.put(key, new Response(JSON.stringify(p), { headers: { "Content-Type": "application/json" } }));
}

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "vv-daily-words") e.waitUntil(showDailyWords());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.registration.scope));
      return open ? open.focus().then((w) => w.navigate?.(url)) : self.clients.openWindow(url);
    }),
  );
});
