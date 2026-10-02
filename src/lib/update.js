// Keeps an open app on the newest version.
// Each deploy replaces the app's files, so a copy that stayed open (phones keep apps alive for days) can ask
// for a file that no longer exists — "Failed to fetch dynamically imported module". The cure is a reload,
// which this module does automatically, at a safe moment, without losing what was being typed.

const RELOAD_KEY = "vv-reload-at";
const DRAFT_KEY = "vv-draft";

/** True for the browser errors that mean "this file belongs to an older version of the app". */
export const isStaleFileError = (e) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk \S+ failed/i.test(
    String(e?.message ?? e ?? ""),
  );

const session = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
  del: (k) => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* private mode */
    }
  },
};

/**
 * Reload into the newest version, saving `draft` (e.g. typed words) to restore afterwards.
 * Returns false instead of reloading if the app already reloaded in the last 30 seconds (avoids a loop
 * when the real problem is no internet).
 */
export function reloadForUpdate(draft = null, now = Date.now()) {
  const last = Number(session.get(RELOAD_KEY) || 0);
  if (now - last < 30_000) return false;
  session.set(RELOAD_KEY, String(now));
  if (draft) session.set(DRAFT_KEY, JSON.stringify(draft));
  location.reload();
  return true;
}

/** After a reload: the saved draft (once), plus whether this start came from an automatic update. */
export function takeDraft() {
  const raw = session.get(DRAFT_KEY);
  session.del(DRAFT_KEY);
  let draft = null;
  try {
    draft = raw ? JSON.parse(raw) : null;
  } catch {
    /* ignore */
  }
  const updated = Date.now() - Number(session.get(RELOAD_KEY) || 0) < 30_000;
  return { draft, updated };
}

/** Ask the server which version is live. Resolves the version string, or null when offline / in development. */
export async function liveVersion() {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()).version || null;
  } catch {
    return null;
  }
}
