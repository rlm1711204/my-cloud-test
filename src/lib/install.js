// "Install app" support: Chrome's install prompt, plus manual steps where the prompt isn't offered.

let deferred = null; // the saved beforeinstallprompt event
let justInstalled = false;
let onChange = () => {};

const DISMISS_KEY = "vv-install-dismissed";

/** True when the app is running from the home-screen icon (not in a browser tab). */
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

/** Where the page is open, which decides what install help to show. */
export function platform(ua = navigator.userAgent) {
  if (/FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|; wv\)/i.test(ua)) return "inapp"; // in-app browser: no install
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function state() {
  if (isStandalone()) return "standalone";
  if (justInstalled) return "installed";
  return deferred ? "ready" : "manual";
}

/** Start listening. `cb` re-renders when the install option appears or the app gets installed. */
export function init(cb) {
  onChange = cb;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own button instead of Chrome's mini-bar
    deferred = e;
    onChange();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    justInstalled = true;
    onChange();
  });
}

/** Show Chrome's install dialog. Resolves true if the user accepted. */
export async function prompt() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") justInstalled = true;
  onChange();
  return outcome === "accepted";
}

export function dismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* private mode: banner just comes back next time */
  }
}

/** Manual install steps for browsers that don't offer the prompt. */
export function manualSteps(p = platform()) {
  if (p === "inapp") return "This page is open inside another app. Tap ⋮ (or ⋯) → <b>Open in Chrome</b>, then install from there.";
  if (p === "ios") return "In Safari, tap <b>Share</b> (□↑) → <b>Add to Home Screen</b> → <b>Add</b>.";
  if (p === "desktop") return "In Chrome or Edge, click the install icon (⊕) at the right end of the address bar.";
  return "In Chrome, tap <b>⋮</b> (top right) → <b>Add to Home screen</b> → <b>Install</b>. If you opened the link from another app, first tap ⋮ → <b>Open in Chrome</b>.";
}
