// Google Drive storage using Google Identity Services (browser OAuth) and the Drive v3 REST API.
// Scope `drive.file` only lets the app see files it created itself — not the rest of your Drive.

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
export const FOLDER_NAME = "VocabVault";
export const JSON_NAME = "vocab-master.json";
export const SHEET_NAME = "Vocab Master List";
// The grammar part keeps its own files in the same folder, so each part syncs (and restores) separately.
export const GRAMMAR_JSON = "grammar-rules.json";
export const GRAMMAR_SHEET = "Grammar Rules";
export const GK_JSON = "gk-questions.json";
export const GK_SHEET = "GK Questions";
const TOKEN_KEY = "vv.driveToken";

let gisPromise = null;
let tokenClient = null;
let token = null;

function loadGis() {
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Couldn't load Google sign-in. Check your connection."));
    document.head.append(s);
  });
  return gisPromise;
}

function savedToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token;
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
    if (t && t.expiresAt > Date.now() + 60_000) return (token = t);
  } catch {
    /* storage unavailable */
  }
  return null;
}

export const isConnected = () => Boolean(savedToken());

/** Ask Google for an access token. Must be called from a user tap the first time (opens a popup). */
export async function connect(clientId, { silent = false } = {}) {
  if (!clientId) throw new Error("Add your Google OAuth Client ID in Settings first (see README).");
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(`Google sign-in failed: ${resp.error_description || resp.error}`));
        token = { value: resp.access_token, expiresAt: Date.now() + Number(resp.expires_in || 3600) * 1000 };
        try {
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
        } catch {
          /* ignore */
        }
        resolve(token);
      },
      error_callback: (e) => reject(new Error(e?.type === "popup_closed" ? "Google sign-in was closed." : `Google sign-in error: ${e?.type || e}`)),
    });
    tokenClient.requestAccessToken({ prompt: silent ? "" : undefined });
  });
}

export function disconnect() {
  const t = savedToken();
  if (t && globalThis.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t.value, () => {});
  token = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function gfetch(url, opts = {}) {
  const t = savedToken();
  if (!t) throw Object.assign(new Error("Not signed in to Google Drive."), { needsAuth: true });
  const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${t.value}`, ...(opts.headers || {}) } });
  if (res.status === 401) {
    disconnect();
    throw Object.assign(new Error("Google session expired — tap Sync to sign in again."), { needsAuth: true });
  }
  if (!res.ok) throw new Error(`Google Drive error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

const q = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findOne(name, mimeType, parent) {
  const query = [`name='${q(name)}'`, "trashed=false", mimeType && `mimeType='${mimeType}'`, parent && `'${parent}' in parents`]
    .filter(Boolean)
    .join(" and ");
  const res = await gfetch(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=drive`);
  return (await res.json()).files?.[0] ?? null;
}

async function exists(id) {
  if (!id) return false;
  try {
    const res = await gfetch(`${API}/files/${id}?fields=id,trashed`);
    return !(await res.json()).trashed;
  } catch (e) {
    if (e.needsAuth) throw e;
    return false;
  }
}

async function multipartCreate(metadata, body, contentType) {
  const boundary = `vv${Math.random().toString(36).slice(2)}`;
  const payload =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n${body}\r\n--${boundary}--`;
  const res = await gfetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: payload,
  });
  return (await res.json()).id;
}

const mediaUpdate = (id, body, contentType) =>
  gfetch(`${UPLOAD}/files/${id}?uploadType=media&fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": contentType },
    body,
  });

/** Make sure the VocabVault folder exists. Returns the ids we know about. */
async function ensureFolder(ids) {
  if (await exists(ids.folderId)) return ids;
  const found = await findOne(FOLDER_NAME, "application/vnd.google-apps.folder");
  const folderId = found?.id ?? (await multipartCreate({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }, "", "text/plain"));
  return { ...ids, folderId };
}

/** Download a data file from Drive (the vocabulary master list by default). Returns {data, ids}. */
export async function pull(ids = {}, jsonName = JSON_NAME) {
  ids = await ensureFolder(ids);
  if (!(await exists(ids.fileId))) ids.fileId = (await findOne(jsonName, null, ids.folderId))?.id ?? null;
  if (!ids.fileId) return { data: null, ids };
  const res = await gfetch(`${API}/files/${ids.fileId}?alt=media`);
  return { data: await res.json(), ids };
}

/** Upload a data file (and refresh its readable Google Sheet copy). Vocabulary names by default. */
export async function push(data, csv, ids = {}, { jsonName = JSON_NAME, sheetName = SHEET_NAME } = {}) {
  ids = await ensureFolder(ids);
  const json = JSON.stringify(data);
  if (await exists(ids.fileId)) await mediaUpdate(ids.fileId, json, "application/json");
  else ids.fileId = await multipartCreate({ name: jsonName, parents: [ids.folderId], mimeType: "application/json" }, json, "application/json");

  // Google Sheet mirror so the list can be opened/printed from Drive or the Sheets app.
  const sheetMeta = { name: sheetName, parents: [ids.folderId], mimeType: "application/vnd.google-apps.spreadsheet" };
  try {
    if (await exists(ids.sheetId)) await mediaUpdate(ids.sheetId, csv, "text/csv");
    else ids.sheetId = await multipartCreate(sheetMeta, csv, "text/csv");
  } catch (e) {
    if (e.needsAuth) throw e;
    // Some accounts reject in-place conversion; replace the sheet instead.
    if (ids.sheetId) await gfetch(`${API}/files/${ids.sheetId}`, { method: "DELETE" }).catch(() => {});
    ids.sheetId = await multipartCreate(sheetMeta, csv, "text/csv");
  }
  return ids;
}

export const sheetUrl = (ids) => (ids?.sheetId ? `https://docs.google.com/spreadsheets/d/${ids.sheetId}/edit` : null);
export const folderUrl = (ids) => (ids?.folderId ? `https://drive.google.com/drive/folders/${ids.folderId}` : null);
