// Run with:  node expense-tracker/tests/sync.test.js
// Two phones syncing through a fake Google Drive.
const assert = require('assert');
const path = require('path');

// ---- fake Google Drive -------------------------------------------------
const drive = { files: {}, n: 0 };
const json = (o) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => o, text: async () => JSON.stringify(o) });
global.fetch = async (url, opts = {}) => {
  const u = new URL(url); const m = opts.method || 'GET';
  if (u.pathname.endsWith('/about')) return json({ user: { emailAddress: 'ram@gmail.com' } });
  if (!u.pathname.startsWith('/upload') && u.pathname.endsWith('/drive/v3/files') && m === 'GET') {
    const q = u.searchParams.get('q');
    const name = /name = '([^']+)'/.exec(q)[1];
    const list = Object.values(drive.files).filter((f) => f.name === name && !f.trashed).sort((a, b) => a.createdTime.localeCompare(b.createdTime));
    return json({ files: list.map(({ id, createdTime }) => ({ id, createdTime })) });
  }
  if (!u.pathname.startsWith('/upload') && u.pathname.endsWith('/drive/v3/files') && m === 'POST') { const id = 'f' + (++drive.n); drive.files[id] = { id, name: JSON.parse(opts.body).name, createdTime: String(drive.n).padStart(4, '0') }; return json({ id }); }
  const idm = /files\/([^/?]+)$/.exec(u.pathname); const id = idm && idm[1];
  if (u.pathname.startsWith('/upload') && m === 'POST') {
    const body = opts.body; const meta = JSON.parse(/\r\n\r\n(\{.*?\})\r\n--/s.exec(body)[1]);
    const content = body.split('\r\n\r\n')[2].replace(/\r\n--[^\r\n]*--$/, '');
    const nid = 'f' + (++drive.n); drive.files[nid] = { id: nid, name: meta.name, content, createdTime: String(drive.n).padStart(4, '0') }; return json({ id: nid });
  }
  if (u.pathname.startsWith('/upload') && m === 'PATCH') { drive.files[id].content = opts.body; return json({ id }); }
  if (m === 'PATCH') { Object.assign(drive.files[id], JSON.parse(opts.body)); return json({ id }); }
  if (u.searchParams.get('alt') === 'media') return json(JSON.parse(drive.files[id].content));
  if (drive.files[id] && !drive.files[id].trashed) return json({ id });
  return { ok: false, status: 404, headers: { get: () => '' }, text: async () => 'nf' };
};

// ---- one "phone" = its own storage + its own copy of the app modules ----
function phone() {
  const mem = {}, ses = {};
  global.localStorage = { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  global.sessionStorage = { getItem: (k) => ses[k] || null, setItem: (k, v) => { ses[k] = v; }, removeItem: (k) => { delete ses[k]; } };
  mem['expense-tracker.drive.v1'] = JSON.stringify({ clientId: 'x.apps.googleusercontent.com', connected: true });
  ses['expense-tracker.drive.v1.token'] = JSON.stringify({ access_token: 't', expiresAt: Date.now() + 3600e3 });
  global.self = global;
  for (const f of ['store.js', 'drive.js']) delete require.cache[path.resolve(__dirname, '../js/' + f)];
  const Store = require('../js/store.js');
  require('../js/drive.js');
  const Drive = global.Drive;
  const env = { mem, ses };
  const use = () => { global.localStorage.getItem = (k) => env.mem[k] || null; global.localStorage.setItem = (k, v) => { env.mem[k] = v; }; };
  Store.load();
  return {
    Store, Drive,
    async sync() { use(); const merged = await Drive.sync(Store.get(), Store.merge, (d) => Store.toCSV(null, null, d.txns)); Store.replaceAll(Store.merge(Store.get(), merged), { silent: true }); },
  };
}

(async () => {
  const A = phone();
  const B = phone();

  // Both phones add entries and each makes its OWN file in Drive (the old bug situation)
  A.Store.add({ type: 'expense', amount: 12000, category: 'EMI & Loans', note: 'Home loan', date: '2026-09-05' });
  B.Store.add({ type: 'expense', amount: 300, category: 'Food', note: 'Lunch', date: '2026-09-06' });
  const ids = ['fA', 'fB'];
  drive.files.fA = { id: 'fA', name: 'expense-tracker-data.json', createdTime: '0001', content: JSON.stringify(A.Store.get()) };
  drive.files.fB = { id: 'fB', name: 'expense-tracker-data.json', createdTime: '0002', content: JSON.stringify(B.Store.get()) };

  await A.sync(); await B.sync(); await A.sync();
  assert.strictEqual(A.Store.active().length, 2, 'A sees both entries');
  assert.strictEqual(B.Store.active().length, 2, 'B sees both entries');
  assert.strictEqual(Object.values(drive.files).filter((f) => f.name === 'expense-tracker-data.json' && !f.trashed).length, 1, 'duplicate copy removed');

  // A marks the loan as a Need; B changes the budget split. Both must survive.
  const loan = A.Store.active().find((t) => t.note === 'Home loan');
  A.Store.update(loan.id, { bucket: 'want' });
  A.Store.setSetting('bucketMap', { 'EMI & Loans': 'want', Food: 'need' });
  await new Promise((r) => setTimeout(r, 5));
  B.Store.setSetting('split', [60, 20, 20]);
  await A.sync(); await B.sync(); await A.sync();
  for (const [name, P] of [['A', A], ['B', B]]) {
    assert.deepStrictEqual(P.Store.get().settings.split, [60, 20, 20], name + ' split');
    assert.deepStrictEqual(P.Store.get().settings.bucketMap, { 'EMI & Loans': 'want', Food: 'need' }, name + ' category heads');
    assert.strictEqual(P.Store.active().find((t) => t.note === 'Home loan').bucket, 'want', name + ' entry head');
  }
  const pa = A.Store.budgetPlan(2026, 8), pb = B.Store.budgetPlan(2026, 8);
  assert.deepStrictEqual(pa.heads, pb.heads, 'same budget on both phones');
  assert.strictEqual(A.Drive.account(), 'ram@gmail.com');
  console.log('two-phone sync ok');
})().catch((e) => { console.error(e); process.exit(1); });
