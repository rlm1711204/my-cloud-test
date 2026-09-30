/* =====================================================================
 * drive.js — saves your records into YOUR Google Drive.
 *
 * What it creates in your Drive:
 *   My Drive / Expense Tracker / expense-tracker-data.json  (full backup, used to sync & restore)
 *   My Drive / Expense Tracker / All records.csv            (opens in Google Sheets)
 *   My Drive / Expense Tracker / Reports / ...csv           (reports you save)
 *
 * Privacy: the app asks only for the "drive.file" permission, which lets
 * it see ONLY the files it created — never your other Drive files.
 * Nothing goes to any server except Google's.
 * ===================================================================== */
(function (root) {
  'use strict';

  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const CFG_KEY = 'expense-tracker.drive.v1';
  const FOLDER = 'Expense Tracker';
  const DATA_FILE = 'expense-tracker-data.json';
  const CSV_FILE = 'All records.csv';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { cfg = {}; }
  const saveCfg = () => localStorage.setItem(CFG_KEY, JSON.stringify(cfg));

  let token = null;       // { access_token, expiresAt }
  let tokenClient = null;
  let gisLoading = null;

  try { const t = JSON.parse(sessionStorage.getItem(CFG_KEY + '.token') || 'null'); if (t && t.expiresAt > Date.now()) token = t; } catch (e) { /* ignore */ }

  /* ---------- Google sign-in library ------------------------------------ */

  function loadGIS() {
    if (root.google && root.google.accounts && root.google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new Error('Could not load Google sign-in. Check your internet.')); };
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  function setClientId(id) {
    cfg.clientId = String(id || '').trim();
    tokenClient = null;
    saveCfg();
  }

  const isConfigured = () => !!cfg.clientId;
  const hasToken = () => !!(token && token.expiresAt > Date.now() + 60 * 1000);
  const wasConnected = () => !!cfg.connected;
  const lastSync = () => cfg.lastSync || '';
  const account = () => cfg.email || '';

  /* ---------- iPhone / iPad: full-page sign-in --------------------------
   * Home-screen apps on iOS can't use Google's pop-up window, so there we
   * go to Google's sign-in page and come back with the key in the address. */

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');

  function redirectSignIn() {
    const state = Math.random().toString(36).slice(2);
    localStorage.setItem(CFG_KEY + '.state', state);
    const q = new URLSearchParams({
      client_id: cfg.clientId, redirect_uri: redirectUri(), response_type: 'token',
      scope: SCOPE, include_granted_scopes: 'true', state,
    });
    if (!cfg.connected) q.set('prompt', 'consent');
    if (cfg.email) q.set('login_hint', cfg.email);
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + q.toString();
  }

  /** Runs when the app opens: picks up the key Google sent back (if any). */
  let redirectResult = null;
  (function handleRedirect() {
    if (typeof location === 'undefined') return; // not in a browser (tests)
    const h = location.hash || '';
    if (!/access_token=|error=/.test(h)) return;
    const p = new URLSearchParams(h.slice(1));
    const expected = localStorage.getItem(CFG_KEY + '.state');
    localStorage.removeItem(CFG_KEY + '.state');
    history.replaceState(null, '', location.pathname + location.search); // hide the key from the address bar
    if (p.get('error')) { redirectResult = { error: p.get('error') === 'access_denied' ? 'Google sign-in was cancelled or blocked (access_denied).' : 'Google sign-in failed: ' + p.get('error') }; return; }
    if (!expected || p.get('state') !== expected) { redirectResult = { error: 'Sign-in could not be verified. Please try Connect again.' }; return; }
    token = { access_token: p.get('access_token'), expiresAt: Date.now() + (Number(p.get('expires_in')) || 3600) * 1000 };
    try { sessionStorage.setItem(CFG_KEY + '.token', JSON.stringify(token)); } catch (e) { /* ignore */ }
    cfg.connected = true; saveCfg();
    redirectResult = { ok: true };
  })();

  /**
   * Ask Google for permission. MUST be called from a button tap (browsers
   * block pop-ups otherwise). After the first "Allow", later calls usually
   * finish instantly without asking again.
   */
  async function connect() {
    if (!isConfigured()) throw new Error('Add your Google Client ID in Settings first.');
    if (isIOS()) { redirectSignIn(); return new Promise(() => {}); } // page leaves for Google and comes back
    await loadGIS();
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        tokenClient = root.google.accounts.oauth2.initTokenClient({
          client_id: cfg.clientId,
          scope: SCOPE,
          callback: () => {},
        });
      }
      tokenClient.callback = (resp) => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
        token = { access_token: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        try { sessionStorage.setItem(CFG_KEY + '.token', JSON.stringify(token)); } catch (e) { /* ignore */ }
        cfg.connected = true; saveCfg();
        resolve(token);
      };
      tokenClient.error_callback = (err) => reject(new Error((err && err.message) || 'Sign-in window was closed.'));
      tokenClient.requestAccessToken({ prompt: cfg.connected ? '' : 'consent', hint: cfg.email || undefined });
    });
  }

  function disconnect() {
    if (token && root.google && root.google.accounts) root.google.accounts.oauth2.revoke(token.access_token, () => {});
    token = null;
    sessionStorage.removeItem(CFG_KEY + '.token');
    cfg = { clientId: cfg.clientId };
    saveCfg();
  }

  /* ---------- Drive API calls ------------------------------------------- */

  async function call(url, opts) {
    if (!hasToken()) throw Object.assign(new Error('Google Drive needs you to tap "Sync" once to sign in again.'), { needsTap: true });
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + token.access_token }, opts.headers || {});
    const res = await fetch(url, opts);
    if (res.status === 401) { token = null; throw Object.assign(new Error('Google sign-in expired. Tap "Sync" to continue.'), { needsTap: true }); }
    if (!res.ok) throw new Error('Google Drive error ' + res.status + ': ' + (await res.text()).slice(0, 200));
    const type = res.headers.get('content-type') || '';
    return type.includes('json') ? res.json() : res.text();
  }

  async function findFile(name, parentId, mime) {
    let q = "name = '" + name.replace(/'/g, "\\'") + "' and trashed = false";
    if (parentId) q += " and '" + parentId + "' in parents";
    if (mime) q += " and mimeType = '" + mime + "'";
    const r = await call(API + '/files?spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&q=' + encodeURIComponent(q));
    return (r.files && r.files[0]) || null;
  }

  async function ensureFolder(name, parentId) {
    const mime = 'application/vnd.google-apps.folder';
    const found = await findFile(name, parentId, mime);
    if (found) return found.id;
    const body = { name, mimeType: mime };
    if (parentId) body.parents = [parentId];
    const r = await call(API + '/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.id;
  }

  async function folderId() {
    if (cfg.folderId) {
      try { await call(API + '/files/' + cfg.folderId + '?fields=id,trashed'); return cfg.folderId; } catch (e) { if (e.needsTap) throw e; }
    }
    cfg.folderId = await ensureFolder(FOLDER);
    saveCfg();
    return cfg.folderId;
  }

  /** Create or overwrite a file with the given text content. */
  async function writeFile(name, content, mime, parentId, knownId) {
    let id = knownId;
    if (!id) { const f = await findFile(name, parentId); id = f && f.id; }
    if (id) {
      try {
        await call(UPLOAD + '/files/' + id + '?uploadType=media&fields=id', { method: 'PATCH', headers: { 'Content-Type': mime }, body: content });
        return id;
      } catch (e) { if (e.needsTap) throw e; /* file was deleted — create a new one below */ }
    }
    const boundary = 'et' + Math.random().toString(36).slice(2);
    const meta = { name, mimeType: mime, parents: [parentId] };
    const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
      '\r\n--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n' + content + '\r\n--' + boundary + '--';
    const r = await call(UPLOAD + '/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
    return r.id;
  }

  async function readJSON(id) {
    const text = await call(API + '/files/' + id + '?alt=media');
    return typeof text === 'string' ? JSON.parse(text) : text;
  }

  /* ---------- High-level actions used by the app ------------------------ */

  /**
   * Two-way sync: download what's in Drive, merge with the phone's copy,
   * upload the result. Returns the merged data.
   */
  /** Every copy of the data file this app can see (any folder), oldest first. */
  async function allDataFiles() {
    const q = "name = '" + DATA_FILE + "' and trashed = false";
    const r = await call(API + '/files?spaces=drive&pageSize=50&fields=files(id,createdTime,modifiedTime)&orderBy=createdTime&q=' + encodeURIComponent(q));
    return r.files || [];
  }

  async function loadAccount() {
    try {
      const r = await call(API + '/about?fields=user(emailAddress)');
      if (r && r.user && r.user.emailAddress) { cfg.email = r.user.emailAddress; saveCfg(); }
    } catch (e) { if (e.needsTap) throw e; }
  }

  async function sync(localData, merge, csv) {
    const folder = await folderId();
    if (!cfg.email) await loadAccount();
    // Read EVERY copy in Drive (two phones may each have made one) and merge them all.
    const files = await allDataFiles();
    let merged = localData;
    let readOk = [];
    for (const f of files) {
      try { merged = merge(merged, await readJSON(f.id)); readOk.push(f); }
      catch (e) { if (e.needsTap) throw e; }
    }
    // Keep the oldest copy as "the" file; write the merged result there; bin the extras.
    const keep = readOk[0] ? readOk[0].id : null;
    cfg.dataId = await writeFile(DATA_FILE, JSON.stringify(merged), 'application/json', folder, keep);
    for (const f of readOk.slice(1)) {
      try { await call(API + '/files/' + f.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); }
      catch (e) { /* not fatal: it'll be merged again next time */ }
    }
    cfg.copiesMerged = readOk.length;
    if (csv) cfg.csvId = await writeFile(CSV_FILE, csv(merged), 'text/csv', folder, cfg.csvId);
    cfg.lastSync = new Date().toISOString();
    saveCfg();
    return merged;
  }

  /** Save a report file into "Expense Tracker/Reports". */
  async function saveReport(name, content, mime) {
    const folder = await folderId();
    const reports = await ensureFolder('Reports', folder);
    await writeFile(name, content, mime || 'text/csv', reports);
  }

  const api = { redirectResult: () => redirectResult, isIOS, redirectUri, copiesMerged: () => cfg.copiesMerged || 0, setClientId, isConfigured, hasToken, wasConnected, lastSync, account, connect, disconnect, sync, saveReport, clientId: () => cfg.clientId || '' };
  root.Drive = api;
})(self);
