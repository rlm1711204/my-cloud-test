/* =====================================================================
 * app.js — the screens. Connects typing, scanning, lists, reports,
 * people balances, settings and Google Drive sync together.
 * ===================================================================== */
(function () {
  'use strict';

  const APP_VERSION = '1.0.0';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const inr = (n) => (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayIso = () => iso(new Date());
  const monthStart = (y, m) => iso(new Date(y, m, 1));
  const monthEnd = (y, m) => iso(new Date(y, m + 1, 0));
  const monthName = (y, m, short) => new Date(y, m, 1).toLocaleString('en-IN', { month: short ? 'short' : 'long', year: 'numeric' });
  const niceDate = (s) => {
    const d = new Date(s + 'T00:00:00');
    const t = todayIso();
    if (s === t) return 'Today';
    if (s === iso(new Date(Date.now() - 864e5))) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  };
  const INFLOW = new Set(['income', 'borrowed', 'got_back']);

  /* ---------- Toast (small message at the bottom) ---------------------- */
  let toastTimer;
  function toast(msg, actionLabel, action) {
    const t = $('#toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (actionLabel ? '<button>' + esc(actionLabel) + '</button>' : '');
    t.hidden = false;
    if (actionLabel) $('button', t).onclick = () => { t.hidden = true; action(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, actionLabel ? 6000 : 3000);
  }

  function download(name, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- Theme ---------------------------------------------------- */
  const THEME_KEY = 'expense-tracker.theme';
  function applyTheme(v) {
    if (v) document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
  }
  applyTheme(localStorage.getItem(THEME_KEY) || '');

  /* ---------- Navigation (uses #hash so the phone's Back button works) - */
  const VIEWS = ['home', 'history', 'people', 'reports', 'settings'];
  let current = 'home';
  function show(view) {
    if (!VIEWS.includes(view)) view = 'home';
    current = view;
    VIEWS.forEach((v) => { $('#view-' + v).hidden = v !== view; });
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.go === view));
    $('#view-title').textContent = $('#view-' + view).dataset.title;
    render();
    window.scrollTo(0, 0);
  }
  function go(view) { if (location.hash !== '#' + view) location.hash = view === 'home' ? '' : view; else show(view); }
  window.addEventListener('hashchange', () => show(location.hash.slice(1) || 'home'));
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) go(b.dataset.go);
    const c = e.target.closest('[data-close]');
    if (c) c.closest('dialog').close();
  });

  /* ---------- Rows (one record in a list) ------------------------------ */
  function describe(t) {
    const who = esc(t.person);
    switch (t.type) {
      case 'lent': return { title: 'Gave ' + who, sub: t.note ? esc(t.note) : 'They owe you' };
      case 'borrowed': return { title: 'Took from ' + who, sub: t.note ? esc(t.note) : 'You owe them' };
      case 'got_back': return { title: who + ' paid back', sub: t.note ? esc(t.note) : 'Money returned to you' };
      case 'paid_back': return { title: 'Paid back ' + who, sub: t.note ? esc(t.note) : 'You returned money' };
      default: return { title: esc(t.note || t.category), sub: esc(t.category) };
    }
  }
  function rowHTML(t, opts) {
    const d = describe(t);
    const sub = [d.sub, t.mode ? esc(t.mode) : '', opts && opts.showDate ? niceDate(t.date) : ''].filter(Boolean).join(' · ');
    const inflow = INFLOW.has(t.type);
    return `<button class="row" data-id="${t.id}">
      <span class="ico">${Parser.iconFor(t.type, t.category)}</span>
      <span class="what"><b>${d.title}</b><span>${sub}</span></span>
      <span class="amt ${inflow ? 'in' : ''}">${inflow ? '+' : '−'}${inr(t.amount)}${t.type === 'saving' ? '<small>saved</small>' : ''}</span>
    </button>`;
  }
  document.addEventListener('click', (e) => {
    const r = e.target.closest('.row[data-id]');
    if (r) {
      const t = Store.get().txns.find((x) => x.id === r.dataset.id);
      if (t) openSheet({ mode: 'edit', rec: t });
    }
  });

  /* =====================================================================
   * QUICK ADD — type a few words
   * ===================================================================== */
  const quick = $('#quick');
  let parsed = [];

  function ctx() {
    const people = Store.people();
    return { learned: Store.get().learned, owesMe: (n) => people.some((p) => p.key === n.toLowerCase() && p.balance > 0) };
  }

  function autoGrow() { quick.style.height = 'auto'; quick.style.height = Math.min(140, quick.scrollHeight) + 'px'; }

  function renderPreview() {
    const text = quick.value.trim();
    parsed = text ? Parser.parseMany(text, ctx()) : [];
    const good = parsed.filter((p) => p.ok);
    $('#btn-add').disabled = !good.length;
    $('#btn-add').textContent = good.length > 1 ? 'Add ' + good.length + ' entries' : 'Add';
    $('#examples').hidden = !!text;
    $('#preview').innerHTML = parsed.map((p, i) => {
      if (!p.ok) return `<div class="pv err"><span class="ico">⚠️</span><span class="what"><b>${esc(p.raw)}</b><span>${esc(p.error)}</span></span></div>`;
      const d = describe(p);
      const typeLabel = Parser.TYPES[p.type].label;
      const bits = [p.type === 'expense' ? d.sub : typeLabel + (p.person ? '' : ' · ' + esc(p.category)), niceDate(p.date), p.mode].filter(Boolean).join(' · ');
      return `<button class="pv" data-i="${i}"><span class="ico">${Parser.iconFor(p.type, p.category)}</span>
        <span class="what"><b>${d.title}</b><span>${bits}</span></span>
        <span class="amt">${inr(p.amount)}</span><span class="edit">Edit</span></button>`;
    }).join('');
  }
  let pvTimer;
  quick.addEventListener('input', () => { autoGrow(); clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 150); });
  quick.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); renderPreview(); addParsed(); } });

  // Tap a preview line to adjust it before saving.
  $('#preview').addEventListener('click', (e) => {
    const b = e.target.closest('.pv[data-i]');
    if (!b) return;
    const i = +b.dataset.i;
    openSheet({ mode: 'draft', rec: Object.assign({ source: 'text' }, parsed[i]), draftIndex: i });
  });

  function removeDraftPiece(i) {
    quick.value = parsed.filter((_, j) => j !== i).map((p) => p.raw).join(', ');
    autoGrow(); renderPreview();
  }

  function addParsed() {
    const good = parsed.filter((p) => p.ok);
    if (!good.length) return;
    const bad = parsed.filter((p) => !p.ok);
    const added = Store.addMany(good.map((p) => ({ type: p.type, amount: p.amount, category: p.category, person: p.person, note: p.note, date: p.date, mode: p.mode, raw: p.raw, source: p.source || 'text' })));
    quick.value = bad.map((p) => p.raw).join(', ');
    autoGrow(); renderPreview();
    const total = added.reduce((s, t) => s + t.amount, 0);
    toast(added.length === 1 ? 'Added ' + inr(total) + ' · ' + (added[0].person || added[0].category) : 'Added ' + added.length + ' entries (' + inr(total) + ')', 'Undo', () => {
      added.forEach((t) => Store.remove(t.id));
      toast('Removed');
    });
  }
  $('#btn-add').addEventListener('click', addParsed);
  $('#examples').addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    quick.value = e.target.textContent;
    autoGrow(); renderPreview(); quick.focus();
  });

  /* ---------- Voice input --------------------------------------------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  $('#btn-mic').addEventListener('click', () => {
    if (!SR) { toast('Voice typing is not available in this browser. Use the mic on your keyboard.'); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    const before = quick.value.trim();
    rec.onresult = (e) => {
      const said = [...e.results].map((r) => r[0].transcript).join(' ');
      quick.value = (before ? before + ', ' : '') + said.replace(/\brupees?\b/gi, '').trim();
      autoGrow(); renderPreview();
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed') toast('Please allow microphone access.'); };
    rec.onend = () => { rec = null; $('#btn-mic').classList.remove('rec'); };
    rec.start();
    $('#btn-mic').classList.add('rec');
    toast('Listening… say e.g. "lunch 150, auto 40"');
  });

  /* =====================================================================
   * BILL SCANNING
   * ===================================================================== */
  const scanSheet = $('#scan-sheet');
  $('#btn-scan').addEventListener('click', () => {
    $('#scan-choose').hidden = false; $('#scan-tip').hidden = false; $('#scan-progress').hidden = true;
    scanSheet.showModal();
  });
  $('#scan-camera').addEventListener('click', () => $('#file-camera').click());
  $('#scan-gallery').addEventListener('click', () => $('#file-gallery').click());
  ['#file-camera', '#file-gallery'].forEach((id) => $(id).addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!scanSheet.open) scanSheet.showModal();
    $('#scan-choose').hidden = true; $('#scan-tip').hidden = true; $('#scan-progress').hidden = false;
    const url = URL.createObjectURL(file);
    $('#scan-preview').src = url;
    const fill = $('#scan-fill'), msg = $('#scan-msg');
    try {
      const text = await OCR.readBill(file, (p, m) => { fill.style.width = Math.round(p * 100) + '%'; msg.textContent = m; });
      const bill = Parser.parseBill(text, { learned: Store.get().learned });
      scanSheet.close();
      openSheet({
        mode: 'new',
        rec: { type: 'expense', amount: bill.amount, category: bill.category, note: bill.merchant || 'Bill', date: bill.date, mode: '', source: 'bill' },
        bill: Object.assign(bill, { text }),
      });
    } catch (err) {
      msg.textContent = err.message || 'Could not read this bill. Try again with better light.';
      $('#scan-choose').hidden = false;
    } finally { URL.revokeObjectURL(url); }
  }));

  /* =====================================================================
   * EDIT / ADD SHEET
   * ===================================================================== */
  const sheet = $('#sheet');
  const PEOPLE_TYPES = new Set(['lent', 'borrowed', 'got_back', 'paid_back']);
  let sheetState = null;

  function fillCategories(type, selected) {
    const cats = Parser.categoriesFor(type);
    const names = Object.keys(cats);
    if (selected && !names.includes(selected)) names.push(selected);
    $('#f-category').innerHTML = names.map((n) => `<option ${n === selected ? 'selected' : ''}>${esc(n)}</option>`).join('');
    if (!selected) $('#f-category').value = names[0];
  }
  function syncTypeFields() {
    const type = $('#f-type').value;
    const isPeople = PEOPLE_TYPES.has(type);
    $('#f-cat-wrap').hidden = isPeople;
    $('#f-person-wrap').hidden = !isPeople;
    fillCategories(type, isPeople ? 'Personal loan' : (sheetState.rec.type === type ? sheetState.rec.category : ''));
  }
  $('#f-type').addEventListener('change', syncTypeFields);

  /** opts: { mode: 'edit'|'new'|'draft', rec, bill?, draftIndex?, onSaved? } */
  function openSheet(opts) {
    sheetState = opts;
    const r = opts.rec;
    $('#sheet-title').textContent = opts.mode === 'edit' ? 'Edit entry' : opts.bill ? 'Check the bill' : 'New entry';
    $('#f-type').value = r.type || 'expense';
    $('#f-amount').value = r.amount != null ? r.amount : '';
    $('#f-person').value = r.person || '';
    $('#f-note').value = r.note || '';
    $('#f-date').value = r.date || todayIso();
    $('#f-mode').value = r.mode || '';
    $('#people-list').innerHTML = Store.people().map((p) => `<option value="${esc(p.name)}">`).join('');
    syncTypeFields();
    $('#f-category').value = r.category || $('#f-category').value;
    $('#f-delete').hidden = opts.mode !== 'edit';
    // Bill details
    const b = opts.bill;
    $('#bill-info').hidden = !b;
    $('#ocr-text-wrap').hidden = !b;
    if (b) {
      const bits = [];
      bits.push(b.amount != null ? '✅ Found total <b>' + inr(b.amount) + '</b>' : '⚠️ Couldn\'t find the total — please type the amount.');
      if (b.gst) bits.push('GST in this bill: <b>' + inr(b.gst) + '</b>');
      if (b.gstin) bits.push('GSTIN: ' + esc(b.gstin));
      $('#bill-info').innerHTML = bits.join('<br>');
      $('#ocr-text').textContent = b.text || '';
      if (b.gst && !r.note.includes('GST')) $('#f-note').value = (r.note || 'Bill');
    }
    sheet.showModal();
    if (opts.mode === 'new' && r.amount == null) setTimeout(() => $('#f-amount').focus(), 200);
  }

  $('#edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const s = sheetState;
    const type = $('#f-type').value;
    const amount = parseFloat($('#f-amount').value);
    if (!(amount > 0)) { toast('Please enter an amount.'); $('#f-amount').focus(); return; }
    const person = $('#f-person').value.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (PEOPLE_TYPES.has(type) && !person) { toast('Whose money? Please add a name.'); $('#f-person').focus(); return; }
    const rec = {
      type, amount,
      category: PEOPLE_TYPES.has(type) ? 'Personal loan' : $('#f-category').value,
      person: PEOPLE_TYPES.has(type) ? person : '',
      note: $('#f-note').value.trim(),
      date: $('#f-date').value || todayIso(),
      mode: $('#f-mode').value,
    };
    // Teach the app: if you changed the category, remember it for this description/shop.
    const orig = s.rec;
    const catChanged = !PEOPLE_TYPES.has(type) && (orig.category !== rec.category || orig.type !== type);
    if (catChanged && rec.note) {
      const phrase = s.bill ? (s.bill.merchant || rec.note) : rec.note;
      Store.learn(phrase, type, rec.category);
    }
    if (s.mode === 'edit') {
      Store.update(orig.id, rec);
      toast('Saved');
    } else {
      Store.add(Object.assign(rec, { source: orig.source || 'manual', raw: orig.raw || '' }));
      if (s.mode === 'draft') removeDraftPiece(s.draftIndex);
      toast('Added ' + inr(amount));
    }
    sheet.close();
    if (s.onSaved) s.onSaved();
  });

  $('#f-delete').addEventListener('click', () => {
    const id = sheetState.rec.id;
    Store.remove(id);
    sheet.close();
    toast('Deleted', 'Undo', () => Store.restore(id));
  });

  /* =====================================================================
   * HOME
   * ===================================================================== */
  function renderHome() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const t = Store.totals(monthStart(y, m), monthEnd(y, m));
    const day = now.getDate(), days = new Date(y, m + 1, 0).getDate();
    $('#hero-month').textContent = monthName(y, m);
    $('#hero-sub').textContent = t.expense ? 'avg ' + inr(Math.round(t.expense / day)) + '/day' : '';
    $('#hero-left').textContent = inr(Math.round(t.left));
    $('#hero-left').classList.toggle('neg', t.left < 0);
    $('#t-spent').textContent = inr(Math.round(t.expense));
    $('#t-income').textContent = inr(Math.round(t.income));
    $('#t-saved').textContent = inr(Math.round(t.saving));

    const budget = +Store.get().settings.budget || 0;
    $('#budget-box').hidden = !budget;
    $('#set-budget').textContent = budget ? 'Change budget' : 'Set a monthly budget';
    if (budget) {
      const used = t.expense / budget;
      const left = budget - t.expense;
      $('#budget-text').textContent = inr(Math.round(t.expense)) + ' of ' + inr(budget) + (left >= 0 ? ' · ' + inr(Math.round(left / Math.max(1, days - day + 1))) + '/day left' : ' · over by ' + inr(Math.round(-left)));
      const f = $('#budget-fill');
      f.style.width = Math.min(100, used * 100) + '%';
      f.className = used > 1 ? 'danger' : used > day / days + 0.1 ? 'warn' : '';
    }

    const ppl = Store.people();
    const oweMe = ppl.reduce((s, p) => s + Math.max(0, p.balance), 0);
    const iOwe = ppl.reduce((s, p) => s + Math.max(0, -p.balance), 0);
    $('#people-card').hidden = !(oweMe || iOwe);
    $('#pc-owe-me').textContent = inr(oweMe);
    $('#pc-i-owe').textContent = inr(iOwe);

    const recent = Store.active().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8);
    $('#recent').innerHTML = recent.length ? recent.map((t) => rowHTML(t, { showDate: true })).join('')
      : '<p class="empty">Nothing yet. Type <b>chai 20</b> above and tap Add — that\'s it!</p>';
  }
  $('#people-card').addEventListener('click', () => go('people'));
  $('#set-budget').addEventListener('click', () => {
    const cur = Store.get().settings.budget || '';
    const v = prompt('Monthly spending budget in ₹ (0 to remove):', cur);
    if (v === null) return;
    Store.setSetting('budget', Math.max(0, parseFloat(String(v).replace(/[^\d.]/g, '')) || 0));
  });

  /* =====================================================================
   * HISTORY
   * ===================================================================== */
  const hist = { y: new Date().getFullYear(), m: new Date().getMonth(), f: 'all', q: '' };
  function renderHistory() {
    $('#h-month').textContent = monthName(hist.y, hist.m);
    const q = hist.q.trim().toLowerCase();
    let list = Store.active();
    if (!q) list = list.filter((t) => t.date >= monthStart(hist.y, hist.m) && t.date <= monthEnd(hist.y, hist.m));
    if (hist.f === 'people') list = list.filter((t) => PEOPLE_TYPES.has(t.type));
    else if (hist.f !== 'all') list = list.filter((t) => t.type === hist.f);
    if (q) list = list.filter((t) => [t.note, t.category, t.person, t.mode, String(t.amount), Parser.TYPES[t.type].label, t.date].join(' ').toLowerCase().includes(q));
    list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

    const spent = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const inc = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    $('#h-summary').textContent = list.length ? list.length + ' entries' + (spent ? ' · spent ' + inr(Math.round(spent)) : '') + (inc ? ' · income ' + inr(Math.round(inc)) : '') + (q ? ' · all months' : '') : '';
    $('.month-nav', $('#view-history')).style.visibility = q ? 'hidden' : '';

    let html = '', lastDate = '';
    const dayTotals = {};
    list.forEach((t) => { if (t.type === 'expense') dayTotals[t.date] = (dayTotals[t.date] || 0) + t.amount; });
    for (const t of list) {
      if (t.date !== lastDate) {
        html += `<div class="day-head"><span>${niceDate(t.date)}</span><span>${dayTotals[t.date] ? 'spent ' + inr(Math.round(dayTotals[t.date])) : ''}</span></div>`;
        lastDate = t.date;
      }
      html += rowHTML(t);
    }
    $('#history').innerHTML = html || '<p class="empty">No entries ' + (q ? 'match "' + esc(hist.q) + '"' : 'in ' + monthName(hist.y, hist.m)) + '.</p>';
  }
  $('#h-prev').addEventListener('click', () => { hist.m--; if (hist.m < 0) { hist.m = 11; hist.y--; } renderHistory(); });
  $('#h-next').addEventListener('click', () => { hist.m++; if (hist.m > 11) { hist.m = 0; hist.y++; } renderHistory(); });
  $('#search').addEventListener('input', (e) => { hist.q = e.target.value; renderHistory(); });
  $('#h-filters').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    hist.f = c.dataset.f;
    $$('#h-filters .chip').forEach((x) => x.classList.toggle('on', x === c));
    renderHistory();
  });

  /* =====================================================================
   * PEOPLE (money given / taken)
   * ===================================================================== */
  function renderPeople() {
    const ppl = Store.people();
    $('#p-owe-me').textContent = inr(ppl.reduce((s, p) => s + Math.max(0, p.balance), 0));
    $('#p-i-owe').textContent = inr(ppl.reduce((s, p) => s + Math.max(0, -p.balance), 0));
    const open = ppl.filter((p) => Math.abs(p.balance) >= 0.5);
    const settled = ppl.filter((p) => Math.abs(p.balance) < 0.5);
    const row = (p) => {
      const status = p.balance > 0 ? 'Owes you' : p.balance < 0 ? 'You owe' : 'Settled';
      return `<button class="row" data-person="${esc(p.key)}">
        <span class="ico">${esc(p.name.charAt(0).toUpperCase())}</span>
        <span class="what"><b>${esc(p.name)}</b><span>${status} · last ${niceDate(p.last)}</span></span>
        <span class="amt ${p.balance > 0 ? 'in' : ''}">${p.balance ? inr(Math.abs(Math.round(p.balance * 100) / 100)) : '✓'}</span>
      </button>`;
    };
    $('#people').innerHTML = (open.length ? open.map(row).join('') : '<p class="empty">No pending money with anyone. 🎉</p>') +
      (settled.length ? '<div class="day-head"><span>Settled</span></div>' + settled.map(row).join('') : '');
  }
  let personKey = null;
  function openPerson(key) {
    personKey = key;
    const p = Store.people().find((x) => x.key === key);
    if (!p) { $('#person-sheet').close(); return; }
    $('#ps-name').textContent = p.name;
    $('#ps-balance').innerHTML = p.balance > 0 ? `${esc(p.name)} owes you <span class="pos">${inr(p.balance)}</span>` : p.balance < 0 ? `You owe ${esc(p.name)} ${inr(-p.balance)}` : 'All settled ✓';
    $('#ps-settle').hidden = Math.abs(p.balance) < 0.5;
    $('#ps-settle').textContent = p.balance > 0 ? 'Got money back' : 'I paid back';
    $('#ps-list').innerHTML = p.txns.slice().sort((a, b) => b.date.localeCompare(a.date)).map((t) => rowHTML(t, { showDate: true })).join('');
    if (!$('#person-sheet').open) $('#person-sheet').showModal();
  }
  $('#people').addEventListener('click', (e) => { const b = e.target.closest('[data-person]'); if (b) openPerson(b.dataset.person); });
  $('#ps-list').addEventListener('click', () => $('#person-sheet').close());
  $('#ps-settle').addEventListener('click', () => {
    const p = Store.people().find((x) => x.key === personKey);
    $('#person-sheet').close();
    openSheet({ mode: 'new', rec: { type: p.balance > 0 ? 'got_back' : 'paid_back', amount: Math.abs(p.balance), person: p.name, note: '', date: todayIso(), source: 'manual' } });
  });
  $('#ps-add').addEventListener('click', () => {
    const p = Store.people().find((x) => x.key === personKey);
    $('#person-sheet').close();
    openSheet({ mode: 'new', rec: { type: 'lent', amount: null, person: p.name, note: '', date: todayIso(), source: 'manual' } });
  });

  /* =====================================================================
   * REPORTS
   * ===================================================================== */
  const rep = { range: 'month', y: new Date().getFullYear(), m: new Date().getMonth() };

  /** Work out the dates for the chosen period (financial year runs April–March). */
  function reportRange() {
    const { y, m } = rep;
    if (rep.range === 'month') return { from: monthStart(y, m), to: monthEnd(y, m), label: monthName(y, m), prev: { from: monthStart(y, m - 1), to: monthEnd(y, m - 1), label: new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long' }) } };
    if (rep.range === '3m') return { from: monthStart(y, m - 2), to: monthEnd(y, m), label: monthName(y, m - 2, true) + ' – ' + monthName(y, m, true), prev: { from: monthStart(y, m - 5), to: monthEnd(y, m - 3), label: 'the 3 months before' } };
    if (rep.range === 'year') {
      const fy = m >= 3 ? y : y - 1; // FY starts in April
      return { from: fy + '-04-01', to: (fy + 1) + '-03-31', label: 'FY ' + fy + '–' + String(fy + 1).slice(2), fy, prev: { from: (fy - 1) + '-04-01', to: fy + '-03-31', label: 'last year' } };
    }
    const all = Store.active().map((t) => t.date).sort();
    return { from: all[0] || todayIso(), to: all[all.length - 1] || todayIso(), label: 'All time', prev: null };
  }

  function step(dir) {
    if (rep.range === 'month') rep.m += dir;
    else if (rep.range === '3m') rep.m += 3 * dir;
    else if (rep.range === 'year') rep.y += dir;
    const d = new Date(rep.y, rep.m, 1); rep.y = d.getFullYear(); rep.m = d.getMonth();
    renderReports();
  }
  $('#r-prev').addEventListener('click', () => step(-1));
  $('#r-next').addEventListener('click', () => step(1));
  $('#r-range').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    rep.range = c.dataset.r; rep.y = new Date().getFullYear(); rep.m = new Date().getMonth();
    $$('#r-range .chip').forEach((x) => x.classList.toggle('on', x === c));
    renderReports();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-table]');
    if (!b) return;
    const t = $('#' + b.dataset.table);
    t.hidden = !t.hidden;
    b.textContent = t.hidden ? 'Table' : 'Hide table';
  });

  function pctChange(a, b) { return b ? Math.round(((a - b) / b) * 100) : null; }

  function renderReports() {
    const r = reportRange();
    $('#r-label').textContent = r.label;
    $$('#r-prev, #r-next').forEach((b) => { b.style.visibility = rep.range === 'all' ? 'hidden' : ''; });
    const t = Store.totals(r.from, r.to);
    const p = r.prev ? Store.totals(r.prev.from, r.prev.to) : null;

    // Tiles
    const delta = (a, b, upIsGood) => {
      const c = p ? pctChange(a, b) : null;
      if (c == null || !isFinite(c)) return '';
      return `<span class="tile-delta">${c > 0 ? '▲' : c < 0 ? '▼' : '='} ${Math.abs(c)}% vs ${esc(r.prev.label)}</span>`;
    };
    $('#r-tiles').innerHTML = `
      <div class="tile big"><span class="dot" style="background:var(--c-spend)"></span><span class="tile-label">Spent</span><span class="tile-value">${inr(Math.round(t.expense))}</span>${delta(t.expense, p && p.expense)}</div>
      <div class="tile big"><span class="dot" style="background:var(--c-income)"></span><span class="tile-label">Income</span><span class="tile-value">${inr(Math.round(t.income))}</span>${delta(t.income, p && p.income)}</div>
      <div class="tile big"><span class="dot" style="background:var(--c-save)"></span><span class="tile-label">Saved</span><span class="tile-value">${inr(Math.round(t.saving))}</span><span class="tile-delta">${t.income ? t.savingsRate + '% of income' : '&nbsp;'}</span></div>
      <div class="tile big"><span class="tile-label">Money left</span><span class="tile-value ${t.left < 0 ? '' : 'pos'}">${inr(Math.round(t.left))}</span><span class="tile-delta">${t.count} entries</span></div>`;

    // Categories
    const cats = Store.byCategory(r.from, r.to);
    Charts.barList($('#r-cats'), cats.map((c) => ({ label: c.category, icon: Parser.iconFor('expense', c.category), amount: c.amount })), { empty: 'No spending in this period.' });
    const catTotal = cats.reduce((s, c) => s + c.amount, 0);
    $('#r-cat-table').innerHTML = `<table><thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Share</th></tr></thead><tbody>${cats.map((c) => `<tr><td>${esc(c.category)}</td><td class="num">${inr(Math.round(c.amount))}</td><td class="num">${catTotal ? Math.round((c.amount / catTotal) * 100) : 0}%</td></tr>`).join('')}<tr><th>Total</th><th class="num">${inr(Math.round(catTotal))}</th><th></th></tr></tbody></table>`;

    // Daily (month) or monthly (longer periods) spending
    if (rep.range === 'month') {
      $('#r-daily-title').textContent = 'Spending each day';
      const days = Store.byDay(rep.y, rep.m);
      Charts.columns($('#r-daily'), {
        labels: days.map((d) => String(d.day)),
        titles: days.map((d) => new Date(rep.y, rep.m, d.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })),
        series: [{ name: 'Spent', color: 'var(--c-spend)', values: days.map((d) => d.amount) }],
        labelEvery: 5, height: 180, aria: 'Spending each day',
      });
    } else {
      $('#r-daily-title').textContent = 'Spending each month';
      const a = new Date(r.from + 'T00:00:00'), b = new Date(r.to + 'T00:00:00');
      let n = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
      n = Math.max(1, Math.min(24, n));
      const months = Store.byMonth(b.getFullYear(), b.getMonth(), n);
      Charts.columns($('#r-daily'), {
        labels: months.map((x) => x.label),
        titles: months.map((x) => x.label + ' ' + x.year),
        series: [{ name: 'Spent', color: 'var(--c-spend)', values: months.map((x) => x.expense) }],
        height: 180, aria: 'Spending each month',
      });
    }

    // 6-month trend ending at the selected month
    const endY = rep.range === 'year' ? Math.min(new Date(r.to).getFullYear(), new Date().getFullYear()) : rep.y;
    const endM = rep.range === 'year' ? (new Date(r.to) > new Date() ? new Date().getMonth() : 2) : rep.m;
    const trend = Store.byMonth(endY, endM, 6);
    Charts.columns($('#r-trend'), {
      labels: trend.map((x) => x.label),
      titles: trend.map((x) => x.label + ' ' + x.year),
      series: [
        { name: 'Income', color: 'var(--c-income)', values: trend.map((x) => x.income) },
        { name: 'Spent', color: 'var(--c-spend)', values: trend.map((x) => x.expense) },
        { name: 'Saved', color: 'var(--c-save)', values: trend.map((x) => x.saving) },
      ],
      height: 200, aria: 'Income, spent and saved for the last 6 months',
    });
    $('#r-trend-table').innerHTML = `<table><thead><tr><th>Month</th><th class="num">Income</th><th class="num">Spent</th><th class="num">Saved</th></tr></thead><tbody>${trend.map((x) => `<tr><td>${x.label} ${x.year}</td><td class="num">${inr(Math.round(x.income))}</td><td class="num">${inr(Math.round(x.expense))}</td><td class="num">${inr(Math.round(x.saving))}</td></tr>`).join('')}</tbody></table>`;

    // Payment modes
    const modes = new Map();
    Store.active().filter((x) => x.type === 'expense' && x.date >= r.from && x.date <= r.to).forEach((x) => modes.set(x.mode || 'Not set', (modes.get(x.mode || 'Not set') || 0) + x.amount));
    const modeIcons = { UPI: '📱', Cash: '💵', Card: '💳', Bank: '🏦', 'Not set': '❔' };
    Charts.barList($('#r-modes'), [...modes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, icon: modeIcons[k] || '', amount: v })), { color: 'var(--accent)', empty: 'No spending in this period.' });

    // Insights
    $('#r-insights').innerHTML = insights(r, t, p, cats).map((s) => '<li>' + s + '</li>').join('');
  }

  function insights(r, t, p, cats) {
    const out = [];
    const list = Store.active().filter((x) => x.date >= r.from && x.date <= r.to);
    if (!list.length) return ['No entries in this period yet.'];
    if (cats.length) {
      const total = cats.reduce((s, c) => s + c.amount, 0);
      out.push(`Your biggest spend was <b>${esc(cats[0].category)}</b>: ${inr(Math.round(cats[0].amount))} (${Math.round((cats[0].amount / total) * 100)}% of spending).`);
    }
    if (p && p.expense && t.expense) {
      const c = pctChange(t.expense, p.expense);
      out.push(c > 0 ? `You spent <b>${c}% more</b> than ${esc(r.prev.label)} (${inr(Math.round(t.expense - p.expense))} extra).` : c < 0 ? `You spent <b>${-c}% less</b> than ${esc(r.prev.label)} — well done! 👏` : `Same spending as ${esc(r.prev.label)}.`);
      const prevCats = new Map(Store.byCategory(r.prev.from, r.prev.to).map((c) => [c.category, c.amount]));
      const jump = cats.map((c) => ({ c: c.category, d: c.amount - (prevCats.get(c.category) || 0) })).sort((a, b) => b.d - a.d)[0];
      if (jump && jump.d > 0 && jump.d >= t.expense * 0.05) out.push(`<b>${esc(jump.c)}</b> went up the most: +${inr(Math.round(jump.d))}.`);
    }
    const big = list.filter((x) => x.type === 'expense').sort((a, b) => b.amount - a.amount)[0];
    if (big) out.push(`Biggest single spend: ${inr(big.amount)} on ${esc(big.note || big.category)} (${niceDate(big.date)}).`);
    const days = Math.max(1, Math.round((Math.min(new Date(r.to + 'T00:00:00'), new Date()) - new Date(r.from + 'T00:00:00')) / 864e5) + 1);
    if (t.expense) out.push(`Average spending: ${inr(Math.round(t.expense / days))} per day.`);
    if (t.income) out.push(t.saving ? `You saved <b>${t.savingsRate}%</b> of your income.${t.savingsRate < 20 ? ' Try for 20%+ — e.g. set up a SIP on salary day.' : ' 💪'}` : 'Nothing marked as saved yet — type e.g. <b>sip 5000</b> when you invest.');
    else out.push('Add your income (e.g. <b>salary 55000</b>) to see how much you save.');
    const ppl = Store.people().filter((x) => x.balance > 0).slice(0, 2);
    ppl.forEach((x) => out.push(`${esc(x.name)} still owes you ${inr(x.balance)}.`));
    return out;
  }

  /* ---------- Downloads -------------------------------------------------- */
  const fileLabel = () => reportRange().label.replace(/[^\w]+/g, '-').replace(/-+$/, '');
  $('#dl-csv').addEventListener('click', () => {
    const r = reportRange();
    download('Kaasu-' + fileLabel() + '.csv', Store.toCSV(r.from, r.to), 'text/csv');
    toast('Downloaded — open it with Excel or Google Sheets.');
  });
  $('#dl-json').addEventListener('click', backupDownload);
  $('#dl-pdf').addEventListener('click', () => {
    buildPrintReport();
    toast('Choose "Save as PDF" as the printer.');
    setTimeout(() => window.print(), 300);
  });
  $('#dl-drive').addEventListener('click', async () => {
    const r = reportRange();
    try {
      if (!Drive.isConfigured()) { toast('Set up Google Drive in Settings first.'); go('settings'); return; }
      if (!Drive.hasToken()) await Drive.connect();
      await Drive.saveReport('Kaasu ' + r.label + '.csv', Store.toCSV(r.from, r.to), 'text/csv');
      toast('Saved in Drive → Expense Tracker → Reports');
    } catch (e) { toast(e.message); }
  });

  function buildPrintReport() {
    const r = reportRange();
    const t = Store.totals(r.from, r.to);
    const cats = Store.byCategory(r.from, r.to);
    const catTotal = cats.reduce((s, c) => s + c.amount, 0);
    const list = Store.active().filter((x) => x.date >= r.from && x.date <= r.to).sort((a, b) => a.date.localeCompare(b.date));
    const ppl = Store.people().filter((p) => Math.abs(p.balance) >= 0.5);
    const html = `
      <h1>Kaasu — Money report</h1>
      <div>${esc(r.label)} (${r.from} to ${r.to}) · generated ${new Date().toLocaleString('en-IN')}</div>
      <div class="ptiles">
        <div>Spent<b>${inr(Math.round(t.expense))}</b></div><div>Income<b>${inr(Math.round(t.income))}</b></div>
        <div>Saved<b>${inr(Math.round(t.saving))}</b></div><div>Money left<b>${inr(Math.round(t.left))}</b></div>
      </div>
      <h2>Quick insights</h2><ul>${insights(r, t, r.prev ? Store.totals(r.prev.from, r.prev.to) : null, cats).map((s) => '<li>' + s + '</li>').join('')}</ul>
      <h2>Where the money went</h2>
      <div id="print-bars"></div>
      <table><thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Share</th></tr></thead><tbody>
      ${cats.map((c) => `<tr><td>${esc(c.category)}</td><td class="num">${inr(Math.round(c.amount))}</td><td class="num">${catTotal ? Math.round((c.amount / catTotal) * 100) : 0}%</td></tr>`).join('')}</tbody></table>
      ${ppl.length ? `<h2>Money given & taken (pending)</h2><table><thead><tr><th>Person</th><th>Status</th><th class="num">Amount</th></tr></thead><tbody>${ppl.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.balance > 0 ? 'Owes you' : 'You owe'}</td><td class="num">${inr(Math.abs(p.balance))}</td></tr>`).join('')}</tbody></table>` : ''}
      <h2>All entries (${list.length})</h2>
      <table><thead><tr><th>Date</th><th>Type</th><th>Category / person</th><th>Description</th><th>Paid by</th><th class="num">Amount</th></tr></thead><tbody>
      ${list.map((x) => `<tr><td>${x.date}</td><td>${Store.TYPE_LABEL[x.type]}</td><td>${esc(x.person || x.category)}</td><td>${esc(x.note)}</td><td>${esc(x.mode)}</td><td class="num">${INFLOW.has(x.type) ? '+' : '−'}${inr(x.amount)}</td></tr>`).join('')}</tbody></table>`;
    $('#print-report').innerHTML = html;
    Charts.barList($('#print-bars'), cats.map((c) => ({ label: c.category, icon: Parser.iconFor('expense', c.category), amount: c.amount })));
  }

  /* =====================================================================
   * SETTINGS
   * ===================================================================== */
  function renderSettings() {
    $('#origin-hint').textContent = location.origin;
    $('#client-id').value = Drive.clientId();
    const connected = Drive.wasConnected();
    $('#drive-setup').hidden = connected;
    $('#drive-connect').hidden = connected;
    $('#drive-connect').disabled = !Drive.isConfigured();
    $('#drive-sync').hidden = !connected;
    $('#drive-disconnect').hidden = !connected;
    $('#drive-status').innerHTML = !Drive.isConfigured() ? 'Not set up yet. Your records are saved on this phone only.'
      : !connected ? 'Client ID saved. Tap <b>Connect Google Drive</b> and choose your Google account.'
      : '✅ Connected. Your records are saved in <b>My Drive → Expense Tracker</b>.' + (Drive.lastSync() ? '<br>Last saved: ' + new Date(Drive.lastSync()).toLocaleString('en-IN') : '');
    $('#budget').value = Store.get().settings.budget || '';
    $('#theme').value = localStorage.getItem(THEME_KEY) || '';
    const learned = Object.entries(Store.get().learned);
    $('#learned').innerHTML = learned.length ? learned.map(([k, v]) => `<button data-forget="${esc(k)}" title="Tap to forget">${esc(k)} → ${esc(v.category)} ✕</button>`).join('') : '<span class="muted small">Nothing yet.</span>';
    $('#version').textContent = 'Kaasu v' + APP_VERSION + ' · ' + Store.active().length + ' entries on this phone';
  }
  $('#save-client').addEventListener('click', () => {
    const v = $('#client-id').value.trim();
    if (v && !/\.apps\.googleusercontent\.com$/.test(v)) { toast('That doesn\'t look right — it should end with .apps.googleusercontent.com'); return; }
    Drive.setClientId(v);
    toast(v ? 'Client ID saved. Now tap Connect.' : 'Client ID removed.');
    renderSettings();
  });
  $('#drive-connect').addEventListener('click', () => doSync(true));
  $('#drive-sync').addEventListener('click', () => doSync(true));
  $('#drive-disconnect').addEventListener('click', () => {
    if (!confirm('Stop saving to Google Drive? Your data stays on this phone and in Drive.')) return;
    Drive.disconnect(); setPill(); renderSettings();
  });
  $('#budget').addEventListener('change', (e) => Store.setSetting('budget', Math.max(0, +e.target.value || 0)));
  $('#theme').addEventListener('change', (e) => { localStorage.setItem(THEME_KEY, e.target.value); applyTheme(e.target.value); render(); });
  $('#learned').addEventListener('click', (e) => { const b = e.target.closest('[data-forget]'); if (b) Store.forget(b.dataset.forget); });

  function backupDownload() {
    download('Kaasu-backup-' + todayIso() + '.json', JSON.stringify(Store.get(), null, 1), 'application/json');
    toast('Backup downloaded. Keep it somewhere safe.');
  }
  $('#backup-dl').addEventListener('click', backupDownload);
  $('#backup-restore').addEventListener('click', () => $('#file-restore').click());
  $('#file-restore').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const incoming = JSON.parse(await f.text());
      if (!incoming || !Array.isArray(incoming.txns)) throw new Error('bad');
      Store.replaceAll(Store.merge(Store.get(), incoming));
      toast('Restored ' + incoming.txns.filter((t) => !t.deleted).length + ' entries.');
    } catch (err) { toast('That file is not a Kaasu backup.'); }
  });
  $('#erase').addEventListener('click', () => {
    if (!confirm('Erase ALL entries on this phone? (Google Drive copy is not touched.)')) return;
    if (prompt('Type ERASE to confirm') !== 'ERASE') return;
    Store.replaceAll(Store.emptyData(), { silent: true });
    render(); toast('Erased.');
  });

  /* ---------- Install as an app ----------------------------------------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#btn-install').hidden = false; });
  $('#btn-install').addEventListener('click', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    installEvt = null; $('#btn-install').hidden = true;
  });
  if (window.matchMedia('(display-mode: standalone)').matches) {
    $('#install-text').textContent = '✅ Installed. Open Kaasu from your home screen.';
  }

  /* =====================================================================
   * GOOGLE DRIVE SYNC
   * ===================================================================== */
  let syncTimer = null, syncing = false, dirty = false;

  function setPill(state, text) {
    const p = $('#sync-pill');
    if (!Drive.isConfigured() || !Drive.wasConnected()) { p.hidden = true; return; }
    p.hidden = false;
    state = state || (Drive.hasToken() ? (dirty ? 'busy' : 'ok') : 'warn');
    p.className = 'pill ' + state;
    $('span', p).textContent = text || (state === 'ok' ? 'Saved' : state === 'busy' ? 'Saving…' : 'Tap to sync');
  }
  $('#sync-pill').addEventListener('click', () => doSync(true));

  function scheduleSync() {
    if (!Drive.isConfigured() || !Drive.wasConnected()) return;
    dirty = true;
    if (!Drive.hasToken()) { setPill('warn'); return; }
    setPill('busy');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => doSync(false), 2500);
  }

  /** interactive = true when the user tapped a button (allowed to show Google sign-in). */
  async function doSync(interactive) {
    if (syncing) return;
    try {
      if (!Drive.isConfigured()) { go('settings'); toast('Add your Google Client ID first.'); return; }
      if (!Drive.hasToken()) {
        if (!interactive) { setPill('warn'); return; }
        await Drive.connect();
      }
      syncing = true; dirty = false;
      setPill('busy', 'Syncing…');
      const merged = await Drive.sync(Store.get(), Store.merge, (d) => Store.toCSV(null, null, d.txns));
      // Merge again in case something was added while we were uploading.
      Store.replaceAll(Store.merge(Store.get(), merged), { silent: true });
      setPill('ok');
      if (interactive) toast('Saved to Google Drive ✓');
      render();
    } catch (e) {
      setPill('warn', e.needsTap ? 'Tap to sync' : 'Sync failed');
      if (interactive || !e.needsTap) toast(e.message);
    } finally {
      syncing = false;
      if (dirty) scheduleSync();
      if (current === 'settings') renderSettings();
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty && Drive.hasToken()) { clearTimeout(syncTimer); doSync(false); }
  });

  /* =====================================================================
   * START
   * ===================================================================== */
  function render() {
    if (current === 'home') renderHome();
    else if (current === 'history') renderHistory();
    else if (current === 'people') renderPeople();
    else if (current === 'reports') renderReports();
    else if (current === 'settings') renderSettings();
  }

  Store.load();
  Store.onChange(() => { render(); scheduleSync(); if ($('#person-sheet').open) openPerson(personKey); });
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (current === 'reports') renderReports(); }, 200); });

  show(location.hash.slice(1) || 'home');
  setPill();
  if (Drive.wasConnected() && Drive.hasToken()) doSync(false);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // Handy for testing in the browser console.
  window.Kaasu = { Store, Parser, version: APP_VERSION };
})();
