/* =====================================================================
 * store.js — keeps your records on the phone and does all the maths.
 *
 * Records live in the browser's localStorage (works offline). Google
 * Drive sync (drive.js) copies the same data to your Drive.
 * Deleting marks a record as deleted instead of erasing it, so that a
 * phone and Drive can merge safely without deleted items coming back.
 * ===================================================================== */
(function (root) {
  'use strict';

  const KEY = 'expense-tracker.data.v1';

  function now() { return new Date().toISOString(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function emptyData() {
    return {
      version: 1,
      txns: [],          // every record
      learned: {},       // phrase -> {type, category, at}  (what you taught the app)
      settings: { budget: 0, name: '', updatedAt: '' },
      updatedAt: now(),
    };
  }

  let data = emptyData();
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = Object.assign(emptyData(), JSON.parse(raw));
    } catch (e) { console.warn('Could not read saved data', e); }
    return data;
  }

  function save(opts) {
    data.updatedAt = now();
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { alert('Phone storage is full — please download a backup from Settings.'); }
    if (!(opts && opts.silent)) listeners.forEach((fn) => fn(data));
  }

  function onChange(fn) { listeners.push(fn); }

  /* ---------- Records ---------------------------------------------------- */

  function active() { return data.txns.filter((t) => !t.deleted); }

  function add(rec) {
    const t = {
      id: uid(),
      type: rec.type,
      amount: Math.abs(Number(rec.amount) || 0),
      category: rec.category || 'Other',
      person: rec.person || '',
      note: rec.note || '',
      date: rec.date,
      mode: rec.mode || '',
      source: rec.source || 'text',   // text | bill | voice | manual
      raw: rec.raw || '',
      createdAt: now(),
      updatedAt: now(),
    };
    data.txns.push(t);
    save();
    return t;
  }

  function addMany(recs) {
    const out = recs.map((r) => {
      const t = Object.assign({}, r, { id: uid(), amount: Math.abs(Number(r.amount) || 0), createdAt: now(), updatedAt: now() });
      delete t.ok; delete t.error;
      data.txns.push(t);
      return t;
    });
    save();
    return out;
  }

  function update(id, changes) {
    const t = data.txns.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, changes, { updatedAt: now() });
    if (changes.amount != null) t.amount = Math.abs(Number(changes.amount) || 0);
    save();
    return t;
  }

  function remove(id) { return update(id, { deleted: true }); }
  function restore(id) { return update(id, { deleted: false }); }

  /** Remember "this phrase means this category" so next time it's automatic. */
  function learn(phrase, type, category) {
    phrase = String(phrase || '').toLowerCase().replace(/[^a-z0-9 &'-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!phrase || phrase.length < 2) return;
    data.learned[phrase] = { type, category, at: now() };
    save({ silent: true });
  }
  function forget(phrase) { delete data.learned[phrase]; save(); }

  function setSetting(k, v) { data.settings[k] = v; data.settings.updatedAt = now(); save(); }

  /* ---------- Merge (phone <-> Google Drive) ----------------------------- */

  /** Combine two copies. For each record the most recently edited version wins. */
  function merge(a, b) {
    a = a || emptyData(); b = b || emptyData();
    const byId = new Map();
    for (const t of [...(a.txns || []), ...(b.txns || [])]) {
      const cur = byId.get(t.id);
      if (!cur || (t.updatedAt || '') > (cur.updatedAt || '')) byId.set(t.id, t);
    }
    const learned = Object.assign({}, a.learned);
    for (const [k, v] of Object.entries(b.learned || {})) if (!learned[k] || (v.at || '') > (learned[k].at || '')) learned[k] = v;
    const settings = ((b.settings && b.settings.updatedAt) || '') > ((a.settings && a.settings.updatedAt) || '') ? b.settings : a.settings;
    return {
      version: 1,
      txns: [...byId.values()].sort((x, y) => (x.createdAt || '').localeCompare(y.createdAt || '')),
      learned,
      settings: Object.assign(emptyData().settings, settings),
      updatedAt: now(),
    };
  }

  function replaceAll(newData, opts) { data = Object.assign(emptyData(), newData); save(opts); }
  function get() { return data; }

  /* ---------- Maths for screens and reports ------------------------------ */

  const monthKey = (iso) => iso.slice(0, 7);  // "2026-09"

  function inRange(t, from, to) { return t.date >= from && t.date <= to; }

  /** Totals for every record type between two dates (inclusive, "YYYY-MM-DD"). */
  function totals(from, to) {
    const s = { expense: 0, income: 0, saving: 0, lent: 0, borrowed: 0, got_back: 0, paid_back: 0, count: 0 };
    for (const t of active()) if (inRange(t, from, to)) { s[t.type] = (s[t.type] || 0) + t.amount; s.count++; }
    // Cash in hand change: everything that came in minus everything that went out.
    s.moneyIn = s.income + s.borrowed + s.got_back;
    s.moneyOut = s.expense + s.saving + s.lent + s.paid_back;
    s.left = s.moneyIn - s.moneyOut;
    s.savingsRate = s.income ? Math.round((s.saving / s.income) * 100) : 0;
    return s;
  }

  /** Spending per category, biggest first. */
  function byCategory(from, to, type) {
    type = type || 'expense';
    const m = new Map();
    for (const t of active()) if (t.type === type && inRange(t, from, to)) m.set(t.category, (m.get(t.category) || 0) + t.amount);
    return [...m.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }

  /** Spending for each day of a month. */
  function byDay(year, month0) {
    const days = new Date(year, month0 + 1, 0).getDate();
    const out = Array.from({ length: days }, (_, i) => ({ day: i + 1, amount: 0 }));
    const prefix = year + '-' + String(month0 + 1).padStart(2, '0');
    for (const t of active()) if (t.type === 'expense' && t.date.startsWith(prefix)) out[+t.date.slice(8, 10) - 1].amount += t.amount;
    return out;
  }

  /** Income / expense / saving for the last n months ending at (year, month0). */
  function byMonth(year, month0, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(year, month0 - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      out.push({ key, label: d.toLocaleString('en-IN', { month: 'short' }), year: d.getFullYear(), income: 0, expense: 0, saving: 0 });
    }
    const idx = new Map(out.map((o, i) => [o.key, i]));
    for (const t of active()) {
      const i = idx.get(monthKey(t.date));
      if (i != null && (t.type === 'income' || t.type === 'expense' || t.type === 'saving')) out[i][t.type] += t.amount;
    }
    return out;
  }

  /**
   * Who owes whom. Positive balance = they owe you. Negative = you owe them.
   * Names are matched without caring about capital letters.
   */
  function people() {
    const m = new Map();
    for (const t of active()) {
      if (!t.person || !['lent', 'borrowed', 'got_back', 'paid_back'].includes(t.type)) continue;
      const key = t.person.trim().toLowerCase();
      const p = m.get(key) || { key, name: t.person.trim(), balance: 0, given: 0, taken: 0, last: '', txns: [] };
      if (t.type === 'lent') { p.balance += t.amount; p.given += t.amount; }
      if (t.type === 'got_back') p.balance -= t.amount;
      if (t.type === 'borrowed') { p.balance -= t.amount; p.taken += t.amount; }
      if (t.type === 'paid_back') p.balance += t.amount;
      if (t.date > p.last) p.last = t.date;
      p.txns.push(t);
      m.set(key, p);
    }
    return [...m.values()].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || b.last.localeCompare(a.last));
  }

  function owesMe(name) {
    const p = people().find((x) => x.key === String(name || '').toLowerCase());
    return !!(p && p.balance > 0);
  }

  /* ---------- Export ------------------------------------------------------ */

  const TYPE_LABEL = { expense: 'Expense', income: 'Income', saving: 'Saving', lent: 'Money given', borrowed: 'Money taken', got_back: 'Got back', paid_back: 'Paid back' };

  /** CSV that opens directly in Excel / Google Sheets. */
  function toCSV(from, to, txns) {
    const rows = [['Date', 'Type', 'Category', 'Person', 'Description', 'Amount (INR)', 'In/Out', 'Payment mode', 'Added by']];
    const src = txns ? txns.filter((t) => !t.deleted) : active();
    const list = src.filter((t) => (!from || inRange(t, from, to))).sort((a, b) => a.date.localeCompare(b.date));
    for (const t of list) {
      const inflow = ['income', 'borrowed', 'got_back'].includes(t.type);
      rows.push([t.date, TYPE_LABEL[t.type] || t.type, t.category, t.person, t.note, t.amount.toFixed(2), inflow ? 'In' : 'Out', t.mode, t.source || '']);
    }
    const esc = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'); // ﻿ = Excel reads ₹ and Tamil correctly
  }

  const api = {
    load, save, onChange, get, active, add, addMany, update, remove, restore, learn, forget, setSetting,
    merge, replaceAll, totals, byCategory, byDay, byMonth, people, owesMe, toCSV, emptyData, TYPE_LABEL,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Store = api;
})(typeof self !== 'undefined' ? self : this);
