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
      recurring: [],     // monthly auto entries (rent, salary, SIP…)
      settings: {
        budget: 0, name: '', updatedAt: '',
        split: [50, 30, 20],   // Needs / Wants / Savings (% of income)
        baseMode: 'income',    // 'income' = this month's income, 'fixed' = baseAmount
        baseAmount: 0,
        carryForward: true,    // add last month's leftover to this month
        bucketMap: {},         // category -> 'need' | 'want' (your changes to the defaults)
      },
      updatedAt: now(),
    };
  }

  let data = emptyData();
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = Object.assign(emptyData(), JSON.parse(raw));
      data.settings = Object.assign(emptyData().settings, data.settings); // new settings get defaults
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
      bucket: rec.bucket || '',       // '' = automatic (by category), or 'need' / 'want'
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

  function setSetting(k, v) {
    data.settings[k] = v;
    data.settings.updatedAt = now();
    data.settings._ts = Object.assign({}, data.settings._ts, { [k]: now() }); // when THIS setting changed
    save();
  }

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
    // Merge settings one by one: each setting keeps its most recent value,
    // so changing a category on one phone and the split on another both survive.
    const sa = a.settings || {}, sb = b.settings || {};
    const tsOf = (st, k) => (st._ts && st._ts[k]) || '';
    const settings = { _ts: {} };
    for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
      if (k === '_ts' || k === 'updatedAt') continue;
      const ta = tsOf(sa, k), tb = tsOf(sb, k);
      const useB = tb > ta || (!ta && !tb && (sb.updatedAt || '') > (sa.updatedAt || '')) || !(k in sa);
      settings[k] = useB && k in sb ? sb[k] : sa[k];
      settings._ts[k] = (useB ? tb : ta) || '';
    }
    settings.updatedAt = (sa.updatedAt || '') > (sb.updatedAt || '') ? sa.updatedAt : sb.updatedAt;
    const rules = new Map();
    for (const r of [...(a.recurring || []), ...(b.recurring || [])]) {
      const cur = rules.get(r.id);
      if (!cur || (r.updatedAt || '') > (cur.updatedAt || '')) rules.set(r.id, r);
    }
    return {
      version: 1,
      txns: [...byId.values()].sort((x, y) => (x.createdAt || '').localeCompare(y.createdAt || '')),
      learned,
      recurring: [...rules.values()],
      settings: Object.assign(emptyData().settings, settings),
      updatedAt: now(),
    };
  }

  /* ---------- Monthly auto entries (rent, salary, SIP…) ------------------
   * A rule says "add this entry every month on day N". Each month's entry
   * gets a fixed id (r_<rule>_<YYYY-MM>) so two phones never add it twice,
   * and a timestamp at the scheduled date so any edit you make always wins. */

  const pad2 = (n) => String(n).padStart(2, '0');
  const ymOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  const instanceId = (ruleId, ym) => 'r_' + ruleId + '_' + ym;

  function rules() { return (data.recurring || []).filter((r) => !r.deleted); }

  /** The date a rule fires in a month: its day, or the month's last day (e.g. 31 -> 30 Sep). */
  function ruleDate(rule, ym) {
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return ym + '-' + pad2(Math.min(rule.day, last));
  }

  /** Next date this rule will add an entry (for showing "next: 5 Oct"). */
  function nextRun(rule, today) {
    today = today || new Date();
    const t = today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());
    for (let i = 0; i < 3; i++) {
      const ym = ymOf(new Date(today.getFullYear(), today.getMonth() + i, 1));
      if (ym < rule.startMonth) continue;
      const d = ruleDate(rule, ym);
      if (d > t || (d === t && !hasInstance(rule.id, ym))) return d;
    }
    return '';
  }

  function hasInstance(ruleId, ym) {
    return data.txns.some((t) => t.recurId === ruleId && t.recurMonth === ym); // deleted ones count: you removed it on purpose
  }

  function addRule(r) {
    const rule = {
      id: uid(),
      type: r.type, amount: Math.abs(Number(r.amount) || 0), category: r.category || 'Other',
      note: r.note || '', mode: r.mode || '',
      day: Math.min(31, Math.max(1, parseInt(r.day, 10) || 1)),
      startMonth: r.startMonth || ymOf(new Date()),
      active: r.active !== false,
      createdAt: now(), updatedAt: now(),
    };
    data.recurring = data.recurring || [];
    data.recurring.push(rule);
    save({ silent: true });
    return rule;
  }

  function updateRule(id, changes) {
    const r = (data.recurring || []).find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, changes, { updatedAt: now() });
    if (changes.amount != null) r.amount = Math.abs(Number(changes.amount) || 0);
    if (changes.day != null) r.day = Math.min(31, Math.max(1, parseInt(changes.day, 10) || 1));
    save({ silent: true });
    return r;
  }

  function removeRule(id) { return updateRule(id, { deleted: true, active: false }); }

  /** Turn an existing entry into "this month's copy" of a rule. */
  function linkToRule(txnId, rule) {
    const t = data.txns.find((x) => x.id === txnId);
    if (!t) return;
    const ym = t.date.slice(0, 7);
    const newId = instanceId(rule.id, ym);
    if (t.id === newId) return;
    t.deleted = true; t.updatedAt = now();
    data.txns.push(Object.assign({}, t, { id: newId, deleted: false, recurId: rule.id, recurMonth: ym, source: 'auto', updatedAt: now() }));
    save({ silent: true });
  }

  /**
   * Add every monthly entry that is due (from the rule's start month up to
   * today) and not yet added. Safe to call any number of times.
   */
  function applyRecurring(today) {
    today = today || new Date();
    const todayIso = today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());
    const curYm = ymOf(today);
    const created = [];
    for (const r of rules()) {
      if (!r.active) continue;
      let [y, m] = r.startMonth.split('-').map(Number);
      // never go back more than 24 months
      const oldest = new Date(today.getFullYear(), today.getMonth() - 23, 1);
      if (new Date(y, m - 1, 1) < oldest) { y = oldest.getFullYear(); m = oldest.getMonth() + 1; }
      for (let d = new Date(y, m - 1, 1); ymOf(d) <= curYm; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const ym = ymOf(d);
        const date = ruleDate(r, ym);
        if (date > todayIso || hasInstance(r.id, ym)) continue;
        // a day before the scheduled date (UTC), so it's always older than any real edit in any time zone
        const stamp = new Date(Date.parse(date + 'T00:00:00.000Z') - 864e5).toISOString();
        const t = {
          id: instanceId(r.id, ym), type: r.type, amount: r.amount, category: r.category, person: '',
          note: r.note, date, mode: r.mode, source: 'auto', raw: '',
          recurId: r.id, recurMonth: ym, createdAt: stamp, updatedAt: stamp,
        };
        data.txns.push(t);
        created.push(t);
      }
    }
    if (created.length) save();
    return created;
  }

  function replaceAll(newData, opts) { data = Object.assign(emptyData(), newData); data.settings = Object.assign(emptyData().settings, data.settings); save(opts); }
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

  /* ---------- Budget plan: Needs / Wants / Savings ------------------------
   * Every expense falls under Needs or Wants (by category, unless you chose
   * otherwise on the entry). Savings entries fill the Savings head. */

  const NEED_CATEGORIES = new Set(['Groceries', 'Transport', 'Fuel', 'Bills', 'Rent', 'Health', 'Education', 'Home', 'Family', 'EMI & Loans', 'Insurance', 'Tax']);
  const HEADS = [
    { key: 'need', label: 'Needs' },
    { key: 'want', label: 'Wants' },
    { key: 'saving', label: 'Savings' },
  ];
  const SPLIT_PRESETS = [
    { name: '50 / 30 / 20 (most common)', split: [50, 30, 20] },
    { name: '60 / 20 / 20 (big fixed costs)', split: [60, 20, 20] },
    { name: '70 / 20 / 10 (tight month)', split: [70, 20, 10] },
    { name: '40 / 30 / 30 (saver)', split: [40, 30, 30] },
    { name: '50 / 20 / 30 (aggressive saver)', split: [50, 20, 30] },
  ];

  /** Default head for a category (your overrides in Settings win). */
  function categoryHead(category) {
    const m = data.settings.bucketMap || {};
    return m[category] || (NEED_CATEGORIES.has(category) ? 'need' : 'want');
  }

  /** Which head an entry belongs to: 'need' | 'want' | 'saving' | null (not budgeted). */
  function headOf(t) {
    if (t.type === 'saving') return 'saving';
    if (t.type !== 'expense') return null;
    return t.bucket || categoryHead(t.category);
  }

  const ymKey = (y, m0) => { const d = new Date(y, m0, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); };
  const monthRange = (y, m0) => { const d = new Date(y, m0 + 1, 0); const k = ymKey(y, m0); return [k + '-01', k + '-' + pad2(d.getDate())]; };

  /**
   * Money carried into a month = everything left over from earlier months
   * (from your first entry onwards). Only a positive leftover is carried.
   */
  function carryInto(y, m0) {
    if (!data.settings.carryForward) return 0;
    const first = active().map((t) => t.date).sort()[0];
    if (!first) return 0;
    let carry = 0;
    let fy = +first.slice(0, 4), fm = +first.slice(5, 7) - 1;
    const target = ymKey(y, m0);
    for (let d = new Date(fy, fm, 1); ymKey(d.getFullYear(), d.getMonth()) < target; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const [from, to] = monthRange(d.getFullYear(), d.getMonth());
      carry += totals(from, to).left; // a shortfall carries over too, as a minus
    }
    return Math.round(carry * 100) / 100;
  }

  /** The full budget picture for one month. */
  function budgetPlan(y, m0) {
    const st = data.settings;
    const [from, to] = monthRange(y, m0);
    const t = totals(from, to);
    let base = 0, baseSource = '';
    if (st.baseMode === 'fixed' && st.baseAmount > 0) { base = +st.baseAmount; baseSource = 'fixed amount'; }
    else if (t.income > 0) { base = t.income; baseSource = 'this month\'s income'; }
    else {
      const expected = rules().filter((r) => r.active && r.type === 'income').reduce((s, r) => s + r.amount, 0);
      if (expected) { base = expected; baseSource = 'expected salary'; }
    }
    const split = (st.split && st.split.length === 3) ? st.split : [50, 30, 20];
    const used = { need: 0, want: 0, saving: 0 };
    for (const x of active()) {
      if (x.date < from || x.date > to) continue;
      const h = headOf(x);
      if (h) used[h] += x.amount;
    }
    const heads = HEADS.map((h, i) => {
      const budget = Math.round(base * split[i] / 100);
      return { key: h.key, label: h.label, pct: split[i], budget, used: Math.round(used[h.key] * 100) / 100, left: Math.round((budget - used[h.key]) * 100) / 100 };
    });
    const carry = carryInto(y, m0);
    const first = active().map((t) => t.date).sort()[0];
    const hasEarlier = !!first && first.slice(0, 7) < ymKey(y, m0);
    return { base, baseSource, split, heads, carry, hasEarlier, monthLeft: t.left, totalLeft: t.left + carry, month: ymKey(y, m0) };
  }

  /* ---------- Export ------------------------------------------------------ */

  const TYPE_LABEL = { expense: 'Expense', income: 'Income', saving: 'Saving', lent: 'Money given', borrowed: 'Money taken', got_back: 'Got back', paid_back: 'Paid back' };

  /** CSV that opens directly in Excel / Google Sheets. */
  function toCSV(from, to, txns) {
    const rows = [['Date', 'Type', 'Category', 'Budget head', 'Person', 'Description', 'Amount (INR)', 'In/Out', 'Payment mode', 'Added by']];
    const src = txns ? txns.filter((t) => !t.deleted) : active();
    const list = src.filter((t) => (!from || inRange(t, from, to))).sort((a, b) => a.date.localeCompare(b.date));
    for (const t of list) {
      const inflow = ['income', 'borrowed', 'got_back'].includes(t.type);
      const h = headOf(t);
      rows.push([t.date, TYPE_LABEL[t.type] || t.type, t.category, h ? { need: 'Need', want: 'Want', saving: 'Saving' }[h] : '', t.person, t.note, t.amount.toFixed(2), inflow ? 'In' : 'Out', t.mode, t.source || '']);
    }
    const esc = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n'); // ﻿ = Excel reads ₹ and Tamil correctly
  }

  const api = {
    load, save, onChange, get, active, add, addMany, update, remove, restore, learn, forget, setSetting,
    budgetPlan, carryInto, headOf, categoryHead, HEADS, SPLIT_PRESETS, NEED_CATEGORIES,
    rules, addRule, updateRule, removeRule, linkToRule, applyRecurring, nextRun, ruleDate,
    merge, replaceAll, totals, byCategory, byDay, byMonth, people, owesMe, toCSV, emptyData, TYPE_LABEL,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Store = api;
})(typeof self !== 'undefined' ? self : this);
