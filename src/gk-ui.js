// The GK part of the app: Today, Add, Practice (with a topic picker) and Topics (coverage map) screens,
// question cards, flashcards, practice quiz, editor and backups. main.js owns the shell and passes `ctx`.
import * as gk from "./lib/gk-store.js";
import { GK_KINDS, makeGkQuestion } from "./lib/gk-quiz.js";
import { gkFromFiles, gkFromText, completeItem } from "./lib/gk-ai.js";
import { isBankId, loadBank } from "./lib/gkbank.js";
import { ALL_TOPICS, CA, CA_TOPICS, SEP, TAXONOMY, topicKey } from "./lib/gk-taxonomy.js";
import { findDuplicate, isFact, itemsToCSV, makeItem, textToItems } from "./lib/gk.js";
import { buildTree, labelOf, nodeState, toggle } from "./lib/gk-topics.js";
import { coverage, pickSession, recordAnswer, requeue, weakWords } from "./lib/practice.js";
import { review, stage, stats, streak } from "./lib/srs.js";
import { todayISO } from "./lib/words.js";
import { AllProvidersFailed, hasAI } from "./lib/engine.js";
import { filesToSources, filesToText } from "./lib/extract.js";

const STAGE_LABEL = { new: "New", learning: "Learning", mastered: "Mastered" };
const ICON = (cat) => (cat === CA ? "📰" : TAXONOMY[cat]?.icon || "📁");
const LIST_SHOWN = 120;

export function createGkUI(ctx) {
  const { $, esc, toast, plural, render, go, openOverlay, closeOverlay, settings, download, keyPicker, aiBanner } = ctx;

  const gui = {
    busy: null,
    candidates: null,
    typedDraft: "",
    quiz: null,
    session: null,
    search: "",
    browse: "", // Topics screen: the open node ("" = all subjects)
    tab: "all", // Topics screen: "all" | "mine" | "bank"
    pickerOpen: new Set(), // expanded nodes in the practice topic picker
    qotdShown: false,
  };
  const prefs = () => gk.get().prefs;
  const view = () => ctx.view();
  const setBusy = (text) => {
    gui.busy = text;
    if (view() === "k-add") render();
  };
  const sourceSelect = (key, value) =>
    `<select data-kpref="${key}">${Object.entries(gk.SOURCES)
      .map(([k, l]) => `<option value="${k}" ${value === k ? "selected" : ""}>${l} (${gk.itemsFor(k).length})</option>`)
      .join("")}</select>`;
  const topicBadge = (it) =>
    `<span class="badge topic">${ICON(it.category)} ${esc(it.category === CA ? `CA ${it.year} · ${it.sub}` : `${it.category} · ${it.sub}`)}</span>`;
  const infoBtn = (id) => `<button class="icon-btn info-btn" type="button" data-action="k-info" data-id="${esc(id)}" aria-label="Full question" title="Full question">ⓘ</button>`;

  // ---------- the question card ----------
  function cardBody(it, { reveal = true } = {}) {
    if (isFact(it)) return `<p class="gk-q">${esc(it.q)}</p>${it.trick ? `<div class="tip"><strong>💡 Trick</strong>${esc(it.trick)}</div>` : ""}`;
    return `
      <p class="gk-q">${esc(it.q)}</p>
      ${
        reveal
          ? `<p class="gk-a">✓ ${esc(it.a)}${it.aiAnswered ? ` <span class="badge learning" title="Answer filled in by AI — worth a quick check">AI answer · check</span>` : ""}</p>
             ${it.options.length ? `<p class="muted small">Not: ${esc(it.options.join(" · "))}</p>` : ""}
             ${it.explain ? `<p class="small">${esc(it.explain)}</p>` : ""}
             ${it.trick ? `<div class="tip"><strong>💡 Memory trick</strong>${esc(it.trick)}</div>` : ""}`
          : ""
      }`;
  }
  const cardHead = (it) => `<div class="rule-head">${topicBadge(it)}${it.bank ? ` <span class="badge bank">Question Bank</span>` : ""}${it.starred ? ' <span class="star">★</span>' : ""}</div>`;

  // ---------- Today ----------
  function staleTopics(n = 3) {
    const pool = gk.itemsFor(prefs().dailySource);
    const seen = gk.get().topicSeen;
    const keys = [...new Set(pool.map(topicKey))];
    return keys.sort((a, b) => String(seen[a] || "").localeCompare(String(seen[b] || "")) || a.localeCompare(b)).slice(0, n);
  }

  function viewToday() {
    const st = gk.get();
    const source = prefs().dailySource;
    const pool = gk.itemsFor(source, { forToday: true });
    if (!pool.length) {
      return `
        <section class="hero">
          <h1>GK that stays with you.</h1>
          <p>Add questions from a quiz book, a current-affairs PDF or your notes. Each one is filed under the right subject and
          chapter (current affairs by year), gets a memory trick, and keeps coming back until you know it.</p>
          <div class="stack">
            <button class="btn primary" type="button" data-action="k-set-source" data-src="mixed">🌍 Start with the built-in Question Bank (${gk.bankItems().length} questions)</button>
            <button class="btn" type="button" data-nav="k-add">➕ Add your own questions</button>
          </div>
        </section>`;
    }
    const plan = gk.todaysPlan();
    const qotd = gk.byId(plan.wotd);
    const list = plan.ids.map(gk.byId).filter(Boolean);
    const done = list.filter((i) => plan.done[i.id]).length;
    const pct = list.length ? Math.round((done / list.length) * 100) : 0;
    const s = stats(pool);
    const stale = staleTopics();
    const date = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
    return `
      <section class="today-head">
        <div><p class="eyebrow">${esc(date)}</p><h1>Today’s GK</h1></div>
        <div class="streak" title="Days in a row with GK revision">🔥 ${streak(st.activity)}</div>
      </section>
      <div class="source-line"><label>Questions from ${sourceSelect("dailySource", source)}</label></div>
      <section class="stats">
        <div><b>${s.total}</b><span>questions</span></div>
        <div><b>${s.due}</b><span>due</span></div>
        <div><b>${s.learning}</b><span>learning</span></div>
        <div><b>${s.mastered}</b><span>mastered</span></div>
      </section>
      ${
        qotd
          ? `<article class="card wotd rule-card">
              <p class="eyebrow">✨ Question of the Day ${infoBtn(qotd.id)}</p>
              ${cardHead(qotd)}
              ${cardBody(qotd, { reveal: gui.qotdShown || isFact(qotd) })}
              ${!gui.qotdShown && !isFact(qotd) ? `<button class="btn block" type="button" data-action="k-qotd">Show answer & trick</button>` : ""}
            </article>`
          : ""
      }
      <article class="card">
        <div class="row between"><h3>Questions to revise today</h3><span class="muted">${done}/${list.length}</span></div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <p class="muted small">Spread across ${new Set(list.map(topicKey)).size} topics.</p>
        <ul class="plan-list">${list
          .map((it) => {
            const g = plan.done[it.id];
            return `<li data-action="k-open" data-id="${esc(it.id)}">
              <span class="tick ${g ? (g === "again" ? "again" : "ok") : ""}">${g ? (g === "again" ? "↻" : "✓") : ""}</span>
              <span class="pw">${esc(it.q.length > 70 ? `${it.q.slice(0, 68)}…` : it.q)}<span class="muted small block">${ICON(it.category)} ${esc(it.sub)}</span></span>
              <span class="badge ${stage(it)}">${STAGE_LABEL[stage(it)]}</span>
            </li>`;
          })
          .join("")}</ul>
        <button class="btn primary block" type="button" data-action="k-start-session">${done === 0 ? "▶ Start revision" : done < list.length ? "▶ Continue" : "↻ Revise again"}</button>
        ${done && done === list.length ? `<p class="done-msg">🎉 Done for today! Try a quick <a href="#" data-nav="k-practice">practice</a>.</p>` : ""}
      </article>
      ${
        stale.length
          ? `<article class="card">
              <h3>🕒 Not revised for a while</h3>
              <p class="muted small">${stale.map((k) => esc(k)).join("<br />")}</p>
              <button class="btn small" type="button" data-action="k-practise-topics" data-topics="${esc(stale.join("|"))}">Practise these topics</button>
            </article>`
          : ""
      }`;
  }

  // ---------- Add ----------
  function viewAdd() {
    if (gui.busy) return `<section class="card center busy"><div class="spinner" aria-hidden="true"></div><p>${esc(gui.busy)}</p></section>`;
    if (gui.candidates) return viewCandidates();
    const ai = hasAI(settings());
    return `
      <h1>Add GK questions</h1>
      <p class="mode ${ai ? "on" : "off"}">${
        ai
          ? "🤖 <b>AI mode</b> — every question is filed under the right subject and chapter (current affairs by year and topic), gets 3 believable wrong options, a short explanation and a memory trick. Facts and news are turned into questions; missing answers are filled in and marked for checking."
          : `🆓 <b>Free mode</b> — questions are read from common formats and filed by keywords. (<a href="#" data-nav="settings">Add a free Gemini key</a> for tricks, explanations and options.)`
      }</p>
      ${ai ? keyPicker() : ""}
      <div class="add-grid">
        <label class="add-tile">
          <input type="file" accept="image/*" capture="environment" data-input="k-files" hidden />
          <span class="big-ico">📷</span><b>Scan a page</b><span>Quiz book, newspaper, notes</span>
        </label>
        <label class="add-tile">
          <input type="file" accept="image/*,application/pdf,.pdf" multiple data-input="k-files" hidden />
          <span class="big-ico">🖼️</span><b>Upload screenshot / PDF</b><span>Monthly current affairs PDFs work too</span>
        </label>
      </div>
      <article class="card">
        <h3>✍️ Type or paste questions</h3>
        <p class="muted small">Any of these formats: <code>Q: … A: …</code> · <code>Capital of Japan - Tokyo</code> ·
        <code>Who wrote Godan? Premchand</code> · numbered MCQs with <code>(a) … (b) …</code> and <code>Ans: (b)</code> ·
        or plain facts and news${ai ? " (AI turns them into questions)" : ""}.</p>
        <textarea id="kTyped" rows="7" placeholder="1. Who founded the Indian National Congress?&#10;(a) Dadabhai Naoroji (b) A. O. Hume (c) W. C. Bonnerjee (d) Tilak&#10;Ans: (b)&#10;&#10;Capital of Australia - Canberra&#10;&#10;In 2026, India hosted …">${esc(gui.typedDraft)}</textarea>
        <button class="btn primary block" type="button" data-action="k-typed">Check & prepare questions</button>
      </article>
      <p class="muted small">Questions you already have are recognised even when worded differently, and never added twice.</p>`;
  }

  const topicOptions = (it) => {
    const cur = it.category === CA ? `${CA}|${it.sub}` : `${it.category}|${it.sub}`;
    const opts = [
      ...ALL_TOPICS.map((t) => [`${t.category}|${t.sub}`, `${t.category} › ${t.sub}`]),
      ...Object.keys(CA_TOPICS).map((sub) => [`${CA}|${sub}`, `Current Affairs › ${sub}`]),
    ];
    return opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("");
  };

  function viewCandidates() {
    const c = gui.candidates;
    const n = c.items.filter((i) => i.selected).length;
    return `
      <div class="row between"><h1>Review questions</h1><button class="btn small ghost" type="button" data-action="k-cancel">Cancel</button></div>
      <p class="muted">${plural(c.items.length, "question")} found. Untick any you don't want; change a topic if needed.</p>
      ${aiBanner(c.ai)}
      ${c.skipped.length ? `<p class="muted small">Already saved (skipped): ${plural(c.skipped.length, "question")}.</p>` : ""}
      <ul class="cand-list gk-cands">
        ${c.items
          .map(
            (row, i) => `<li class="cand new">
              <label>
                <input type="checkbox" data-kcand="${i}" ${row.selected ? "checked" : ""} />
                <span class="cand-body cand-main">
                  <b>${esc(row.item.q)}</b>
                  <span>${row.item.a ? `✓ ${esc(row.item.a)}` : `<span class="muted">Fact (no answer)</span>`}${
                    row.item.aiAnswered ? ` <span class="badge learning">AI answer · check</span>` : ""
                  }</span>
                  ${row.item.trick ? `<span class="small muted">💡 ${esc(row.item.trick)}</span>` : ""}
                </span>
              </label>
              <div class="cand-topic">
                <select data-ktopic="${i}" aria-label="Topic">${topicOptions(row.item)}</select>
                ${row.item.category === CA ? `<input type="number" data-kyear="${i}" value="${row.item.year}" min="2000" max="2100" aria-label="Year" />` : ""}
              </div>
            </li>`,
          )
          .join("")}
      </ul>
      <div class="sticky-actions"><button class="btn primary block" type="button" data-action="k-add-selected" ${n ? "" : "disabled"}>Add ${plural(n, "question")}</button></div>`;
  }

  function showCandidates(items, ai) {
    const saved = gk.liveItems();
    const rows = [];
    const skipped = [];
    for (const raw of items) {
      const it = makeItem(raw);
      if (findDuplicate(it, saved)) {
        skipped.push(it.q);
        continue;
      }
      if (findDuplicate(it, rows.map((r) => r.item))) continue;
      rows.push({ item: it, selected: true });
    }
    if (!rows.length) {
      gui.candidates = null;
      toast(skipped.length ? (skipped.length === 1 ? "That question is already saved ✓" : `All ${skipped.length} questions are already saved ✓`) : "No questions found. Try a clearer photo, or type them.", 6000);
      return;
    }
    gui.candidates = { items: rows, skipped, ai };
  }

  async function freeItems(text, source) {
    return textToItems(text).map((x) => ({ ...x, source }));
  }

  async function handleFiles(files) {
    if (!files.length) return;
    const s = settings();
    const source = files.map((f) => f.name).join(", ").slice(0, 120);
    setBusy("Preparing your files…");
    let ai = null;
    try {
      let items = null;
      if (hasAI(s)) {
        try {
          const res = await gkFromFiles(s, await filesToSources(files), source, setBusy);
          ai = res;
          items = res.items;
        } catch (e) {
          if (!(e instanceof AllProvidersFailed)) throw e;
          ai = { usedBy: [], notes: [e.message], failed: 0 };
        }
      }
      if (!items) {
        const text = await filesToText(files, setBusy);
        setBusy("Finding the questions…");
        items = await freeItems(text, source);
      }
      gui.busy = null;
      showCandidates(items, ai);
    } catch (e) {
      gui.busy = null;
      toast(e.message || String(e), 6000);
    }
    if (view() === "k-add") render();
  }

  async function handleTyped() {
    const text = $("#kTyped")?.value ?? "";
    gui.typedDraft = text;
    if (!text.trim()) return toast("Type or paste a question first.");
    const s = settings();
    setBusy("Preparing your questions…");
    let ai = null;
    try {
      let items = null;
      if (hasAI(s)) {
        try {
          const res = await gkFromText(s, text, setBusy);
          ai = res;
          items = res.items;
        } catch (e) {
          if (!(e instanceof AllProvidersFailed)) throw e;
          ai = { usedBy: [], notes: [e.message], failed: 0 };
        }
      }
      items ??= await freeItems(text, "Typed");
      gui.busy = null;
      showCandidates(items, ai);
    } catch (e) {
      gui.busy = null;
      toast(e.message || String(e), 6000);
    }
    if (view() === "k-add") render();
  }

  // ---------- Practice ----------
  function pickerNode(key, tree, counts, depth) {
    const ex = prefs().excluded;
    const state = nodeState(key, ex);
    const kids = tree.get(key) || [];
    const open = gui.pickerOpen.has(key);
    const n = counts.get(key)?.total || 0;
    const label = depth === 0 ? `${ICON(key)} ${key}` : labelOf(key);
    return `<li class="pick ${state}">
      <div class="pick-row">
        <button type="button" class="pick-box ${state}" data-action="k-toggle-topic" data-key="${esc(key)}" aria-label="${state === "off" ? "Include" : "Leave out"} ${esc(label)}">${
          state === "on" ? "☑" : state === "some" ? "◩" : "☐"
        }</button>
        <span class="pick-label">${esc(label)} <span class="muted small">(${n})</span></span>
        ${kids.length ? `<button type="button" class="icon-btn small" data-action="k-expand" data-key="${esc(key)}" aria-label="Show topics">${open ? "▾" : "▸"}</button>` : ""}
      </div>
      ${open && kids.length ? `<ul>${kids.map((k) => pickerNode(k, tree, counts, depth + 1)).join("")}</ul>` : ""}
    </li>`;
  }

  function viewPractice() {
    if (gui.quiz) return viewQuiz();
    const p = prefs();
    const source = p.practiceSource;
    const all = gk.itemsFor(source);
    const pool = gk.itemsFor(source, { forPractice: true });
    const tree = buildTree(all);
    const counts = gk.topicTree(all);
    const cov = coverage(pool, gk.get().practice, source);
    const weak = weakWords(pool, gk.get().practice);
    const pct = cov.total ? Math.round((cov.covered / cov.total) * 100) : 0;
    return `
      <h1>GK practice</h1>
      <p class="muted">Every selected question is asked once per round, topics take turns, and wrong answers come back until you
      get them right twice in a row.</p>
      <article class="card">
        <label class="field">Practise questions from ${sourceSelect("practiceSource", source)}</label>
        <p class="small">Round ${cov.round}: <b>${cov.covered}</b> of ${cov.total} questions covered${weak.length ? ` · ⚠️ ${plural(weak.length, "weak question")}` : ""}</p>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <label class="field">Questions per session
          <select data-kpref="practiceSize">${[10, 20, 30, 50].map((n) => `<option value="${n}" ${Number(p.practiceSize) === n ? "selected" : ""}>${n}</option>`).join("")}</select>
        </label>
      </article>
      <article class="card">
        <div class="row between"><h3>Topics</h3><span class="muted small">${pool.length} of ${all.length} selected</span></div>
        <p class="muted small">Untick anything you don't want now — a whole subject, one chapter, or a Current Affairs year.</p>
        <div class="row wrap">
          <button class="btn small" type="button" data-action="k-topics-all">Select all</button>
          <button class="btn small" type="button" data-action="k-topics-none">Clear all</button>
        </div>
        <ul class="picker">${(tree.get("") || []).map((k) => pickerNode(k, tree, counts, 0)).join("")}</ul>
        <label class="toggle"><input type="checkbox" data-kpref="excludeToday" ${p.excludeToday ? "checked" : ""} /> Use the same topics for Today's revision</label>
      </article>
      ${
        pool.length >= 2
          ? `<div class="quiz-grid">${GK_KINDS.map(
              ([k, ico, t, d]) => `<button class="quiz-tile" type="button" data-action="k-start-quiz" data-kind="${k}"><span class="big-ico">${ico}</span><b>${t}</b><span>${d}</span></button>`,
            ).join("")}</div>
            ${weak.length ? `<button class="btn block" type="button" data-action="k-start-quiz" data-kind="mixed" data-weak="1">🎯 Fix my ${plural(weak.length, "weak question")}</button>` : ""}`
          : `<p class="muted center">Select at least two questions' worth of topics to practise.</p>`
      }`;
  }

  function startQuiz(kind, { weakOnly = false, topics = null } = {}) {
    const p = prefs();
    const source = p.practiceSource;
    let pool = topics ? gk.itemsFor(source).filter((i) => topics.some((t) => topicKey(i) === t || topicKey(i).startsWith(t + SEP))) : gk.itemsFor(source, { forPractice: true });
    let ids;
    let roundOf = {};
    if (weakOnly) ids = weakWords(pool, gk.get().practice).map((i) => i.id).slice(0, Number(p.practiceSize));
    else {
      const byId = new Map(pool.map((i) => [i.id, i]));
      const picked = pickSession(pool, gk.get().practice, source, Number(p.practiceSize) || 20, Math.random, (id) => topicKey(byId.get(id)));
      ids = picked.ids;
      roundOf = picked.roundOf;
      gk.update((s) => (s.practice = picked.practice), { touchesData: false });
    }
    if (!ids.length) return toast("Nothing to practise in these topics.");
    gui.quiz = { kind, source, queue: ids, roundOf, i: 0, picked: null, revealed: false, score: 0, answered: 0, wrong: [], requeued: new Set(), pool };
    gui.quiz.current = questionFor(gui.quiz, false);
    if (view() !== "k-practice") go("k-practice");
    else render();
    window.scrollTo(0, 0);
  }

  function questionFor(q, retry) {
    const it = gk.byId(q.queue[q.i]) || q.pool.find((x) => x.id === q.queue[q.i]);
    return it ? { ...makeGkQuestion(it, q.kind, q.pool), retry } : null;
  }

  function viewQuiz() {
    const q = gui.quiz;
    if (q.i >= q.queue.length || !q.current) {
      const wrong = [...new Set(q.wrong)].map(gk.byId).filter(Boolean);
      const cov = coverage(q.pool, gk.get().practice, q.source);
      return `
        <article class="card center">
          <p class="eyebrow">Session complete</p>
          <p class="score">${q.score}/${q.answered}</p>
          <p>${q.answered && q.score === q.answered ? "Perfect! 🏆" : q.score >= q.answered * 0.7 ? "Great work 💪" : "Keep going — the weak questions will come back 📈"}</p>
          <p class="small muted">Round ${cov.round}: ${cov.covered} of ${cov.total} questions covered</p>
          ${wrong.length ? `<p class="muted">Will come back: ${wrong.map((i) => `<a href="#" data-action="k-info" data-id="${esc(i.id)}">${esc(i.q.slice(0, 50))} ⓘ</a>`).join("; ")}</p>` : ""}
          <div class="row center">
            <button class="btn primary" type="button" data-action="k-start-quiz" data-kind="${q.kind}">Next session</button>
            <button class="btn" type="button" data-action="k-end-quiz">Done</button>
          </div>
        </article>`;
    }
    const cur = q.current;
    const it = gk.byId(cur.itemId);
    const answered = q.picked != null;
    const hidden = cur.selfGraded && !q.revealed;
    return `
      <div class="row between">
        <span class="muted">Question ${q.i + 1} of ${q.queue.length}</span>
        <button class="btn small ghost" type="button" data-action="k-end-quiz">Finish</button>
      </div>
      <div class="progress"><span style="width:${(q.i / q.queue.length) * 100}%"></span></div>
      <article class="card quiz-card">
        <p class="eyebrow">${esc(cur.label)}${cur.retry ? ` <span class="badge learning">again</span>` : ""}</p>
        ${it ? `<p class="small muted">${ICON(it.category)} ${esc(it.category === CA ? `Current Affairs ${it.year} · ${it.sub}` : `${it.category} · ${it.sub}`)}</p>` : ""}
        <div class="quiz-prompt gk-prompt">${esc(cur.prompt)}</div>
        ${cur.kind === "tf" ? `<p class="claim">Answer: <b>${esc(cur.claim)}</b></p>` : ""}
        ${
          hidden
            ? `<p class="muted center">Answer in your head, then check.</p>
               <button class="btn primary block" type="button" data-action="k-reveal">Show the answer</button>`
            : `${cur.selfGraded ? `<p class="gk-a center">✓ ${esc(cur.reveal)}</p>` : ""}
               <div class="options ${cur.options.length === 2 ? "two" : ""}">
                ${cur.options
                  .map((o, i) => {
                    let cls = "";
                    if (answered) cls = cur.selfGraded ? (i === q.picked ? (i === 0 ? "correct" : "wrong") : "dim") : i === cur.answer ? "correct" : i === q.picked ? "wrong" : "dim";
                    return `<button class="option ${cls}" type="button" data-action="k-pick" data-i="${i}" ${answered ? "disabled" : ""}>${esc(o)}</button>`;
                  })
                  .join("")}
              </div>`
        }
        ${
          answered && it
            ? `<div class="explain g-explain ${q.lastCorrect ? "ok" : "bad"}">
                 <div class="explain-text">
                   ${!isFact(it) && !cur.selfGraded ? `<p class="small"><b>${q.lastCorrect ? "✓ Right" : `✗ The answer is ${esc(it.a)}`}</b></p>` : ""}
                   ${it.explain ? `<p class="small">${esc(it.explain)}</p>` : ""}
                   ${it.trick ? `<p class="small">💡 <b>Trick:</b> ${esc(it.trick)}</p>` : ""}
                 </div>
                 ${infoBtn(it.id)}
               </div>
               <button class="btn primary block" type="button" data-action="k-next">${q.i + 1 < q.queue.length ? "Next →" : "See score"}</button>`
            : ""
        }
      </article>`;
  }

  // ---------- Topics: coverage map and browsing ----------
  function nodeStats(n) {
    if (!n) return "";
    const pct = (x) => Math.round((x / n.total) * 100);
    return `<span class="cov">
      <span class="bar"><span class="seen" style="width:${pct(n.covered)}%"></span><span class="mast" style="width:${pct(n.mastered)}%"></span></span>
      <span class="muted small">${n.total} · ${pct(n.covered)}% this round · ${n.mastered} mastered${n.weak ? ` · ⚠️ ${n.weak}` : ""}${n.due ? ` · ${n.due} due` : ""}${n.fresh === n.total ? " · not started" : ""}</span>
    </span>`;
  }

  function viewTopics() {
    const src = gui.tab === "mine" ? "mine" : gui.tab === "bank" ? "bank" : "mixed";
    const all = gk.itemsFor(src);
    const term = gui.search.trim().toLowerCase();
    const tabs = `<div class="seg" role="tablist">
      ${[
        ["all", `All (${gk.itemsFor("mixed").length})`],
        ["mine", `Mine (${gk.liveItems().length})`],
        ["bank", `Bank (${gk.bankItems().length})`],
      ]
        .map(([k, l]) => `<button type="button" class="${gui.tab === k ? "active" : ""}" data-action="k-tab" data-tab="${k}">${l}</button>`)
        .join("")}
    </div>`;
    const search = `<input type="search" id="kSearch" placeholder="Search all questions and answers" value="${esc(gui.search)}" autocomplete="off" />`;
    const listOf = (items) =>
      items.length
        ? `<ul class="word-list rule-list">${items
            .slice(0, LIST_SHOWN)
            .map(
              (it) => `<li data-action="k-open" data-id="${esc(it.id)}">
                <div><b>${esc(it.q)}</b><span class="muted small block">${it.a ? `✓ ${esc(it.a)}` : "fact"}</span></div>
                <span class="badge ${stage(it)}">${STAGE_LABEL[stage(it)]}</span>
              </li>`,
            )
            .join("")}</ul>${items.length > LIST_SHOWN ? `<p class="muted small center">Showing ${LIST_SHOWN} of ${items.length}. Search to narrow down.</p>` : ""}`
        : `<p class="muted center">No questions here yet.</p>`;

    if (term) {
      const hits = all.filter((i) => `${i.q} ${i.a} ${i.explain} ${i.sub}`.toLowerCase().includes(term));
      return `${tabs}<h1>Topics</h1>${search}<p class="muted small">${`${hits.length} match${hits.length === 1 ? "" : "es"}`}</p>${listOf(hits)}`;
    }
    const tree = buildTree(all);
    const counts = gk.topicTree(all);
    const node = gui.browse;
    const kids = tree.get(node) || [];
    const crumbs = node
      ? `<p class="crumbs"><a href="#" data-action="k-browse" data-key="">All subjects</a>${node
          .split(SEP)
          .map((_, i, a) => ` › <a href="#" data-action="k-browse" data-key="${esc(a.slice(0, i + 1).join(SEP))}">${esc(a[i])}</a>`)
          .join("")}</p>`
      : "";
    const here = node ? all.filter((i) => topicKey(i) === node || topicKey(i).startsWith(node + SEP)) : all;
    return `
      ${tabs}
      <div class="row between"><h1>${node ? esc(labelOf(node)) : "Topics"}</h1><button class="btn small" type="button" data-action="k-new">＋ New</button></div>
      ${search}
      ${crumbs}
      ${!node ? `<p class="muted small">Coverage map — the bar shows questions asked in this practice round (light) and mastered (dark).</p>` : ""}
      ${
        kids.length
          ? `<ul class="topic-list">${kids
              .map(
                (k) => `<li data-action="k-browse" data-key="${esc(k)}">
                  <span class="t-name">${node ? "" : ICON(k) + " "}${esc(labelOf(k))}</span>
                  ${nodeStats(counts.get(k))}
                  <span class="home-go" aria-hidden="true">›</span>
                </li>`,
              )
              .join("")}</ul>`
          : listOf(here)
      }
      ${
        node && kids.length
          ? `<button class="btn small block" type="button" data-action="k-practise-topics" data-topics="${esc(node)}">🎯 Practise ${esc(labelOf(node))}</button>`
          : node
            ? `<button class="btn small block" type="button" data-action="k-practise-topics" data-topics="${esc(node)}">🎯 Practise this topic</button>`
            : ""
      }
      ${gk.liveItems().length ? `<div class="row wrap center"><button class="btn small" type="button" data-action="k-export-csv">⬇ My questions as CSV (Excel)</button></div>` : ""}`;
  }

  // ---------- detail, info layer, editor ----------
  function progressLine(it) {
    const next = stage(it) === "new" ? "not started" : new Date(`${it.due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const weak = gk.get().practice.weak[it.id];
    return `<p class="muted small">Next revision: ${esc(next)} · Revised ${plural(it.reviews, "time")}${
      weak ? ` · Practice: ${weak.right} right, ${weak.wrong} wrong${weak.need ? " (still weak)" : ""}` : ""
    }${it.source ? ` · ${esc(it.source)}` : ""}</p>`;
  }

  function showItem(id) {
    const it = gk.byId(id);
    if (!it) return toast("That question is no longer saved.");
    openOverlay(`
      <div class="sheet-bar"><span class="badge ${stage(it)}">${STAGE_LABEL[stage(it)]}</span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      ${cardHead(it)}
      ${cardBody(it)}
      ${progressLine(it)}
      <div class="row wrap">
        <button class="btn small" type="button" data-action="k-star" data-id="${esc(it.id)}">${it.starred ? "★ Unstar" : "☆ Star"}</button>
        ${
          it.bank
            ? `<button class="btn small primary" type="button" data-action="k-add-bank" data-id="${esc(it.id)}">＋ Add to my questions</button>`
            : `<button class="btn small" type="button" data-action="k-edit" data-id="${esc(it.id)}">✎ Edit</button>
               ${hasAI(settings()) ? `<button class="btn small" type="button" data-action="k-complete" data-id="${esc(it.id)}">🤖 ${it.trick && it.options.length >= 3 ? "Refresh" : "Complete"} with AI</button>` : ""}
               <button class="btn small danger" type="button" data-action="k-delete" data-id="${esc(it.id)}">Delete</button>`
        }
      </div>`);
  }

  function showInfo(id) {
    const it = gk.byId(id);
    if (!it) return toast("That question is no longer saved.");
    const layer = $("#info");
    layer.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-bar"><span class="badge ${stage(it)}">${STAGE_LABEL[stage(it)]}</span>
        <button class="icon-btn" type="button" data-action="close-info" aria-label="Close">✕</button></div>
      ${cardHead(it)}${cardBody(it)}${progressLine(it)}
      <div class="row wrap"><button class="btn small" type="button" data-action="close-info">Back</button></div>
    </div>`;
    layer.classList.add("open");
  }

  function showEditor(id) {
    const it = id ? gk.byId(id) : null;
    const v = (k) => esc(it?.[k] ?? "");
    openOverlay(`
      <div class="sheet-bar"><h3>${it ? "Edit question" : "New question"}</h3><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      <form id="kEditForm" data-id="${esc(it?.id ?? "")}">
        <label class="field">Question (or a fact)<textarea name="q" rows="2" required>${v("q")}</textarea></label>
        <label class="field">Answer (leave empty for a fact)<input name="a" value="${v("a")}" /></label>
        <label class="field">Wrong options (one per line)<textarea name="options" rows="3">${esc((it?.options ?? []).join("\n"))}</textarea></label>
        <label class="field">Topic<select name="topic">${topicOptions(it || { category: "Static GK", sub: "Books & Authors" })}</select></label>
        <div class="two">
          <label class="field">Year (current affairs)<input name="year" type="number" min="2000" max="2100" value="${it?.year || ""}" /></label>
          <label class="field">Month (1–12)<input name="month" type="number" min="0" max="12" value="${it?.month || ""}" /></label>
        </div>
        <label class="field">Explanation<textarea name="explain" rows="2">${v("explain")}</textarea></label>
        <label class="field">Memory trick<textarea name="trick" rows="2">${v("trick")}</textarea></label>
        <button class="btn primary block" type="submit">Save</button>
      </form>`);
  }

  function saveEditor(form) {
    const f = new FormData(form);
    const id = form.dataset.id;
    const cur = id ? gk.byId(id) : null;
    const [category, sub] = String(f.get("topic")).split("|");
    const input = {
      ...(cur || {}),
      q: f.get("q"),
      a: f.get("a"),
      options: String(f.get("options") || "").split("\n").map((x) => x.trim()).filter(Boolean),
      category,
      sub,
      year: category === CA ? Number(f.get("year")) || new Date().getFullYear() : 0,
      month: Number(f.get("month")) || 0,
      explain: f.get("explain"),
      trick: f.get("trick"),
      aiAnswered: cur?.aiAnswered && f.get("a") === cur.a,
      source: cur?.source || "Typed",
    };
    if (!cur) {
      const { added, skipped } = gk.addItems([input]);
      if (!added.length) return toast(`Already saved: “${skipped[0]?.existing}”.`, 5000);
    } else gk.saveItem(input);
    closeOverlay();
    toast("Saved ✓");
    ctx.afterChange();
    render();
  }

  // ---------- flashcard revision ----------
  function renderSession() {
    const ss = gui.session;
    if (!ss) return;
    if (ss.i >= ss.ids.length) {
      const vals = Object.values(ss.results);
      const known = vals.filter((g) => g !== "again").length;
      openOverlay(`
        <div class="sheet-bar"><span></span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
        <div class="center session-done"><p class="big-ico">🎉</p><h2>Revision complete</h2>
          <p>You remembered <b>${known}</b> of ${vals.length}. Questions you missed come back tomorrow.</p>
          <button class="btn primary" type="button" data-action="close">Back to Today</button></div>`);
      return;
    }
    const it = gk.byId(ss.ids[ss.i]);
    if (!it) {
      ss.i += 1;
      return renderSession();
    }
    openOverlay(
      `<div class="sheet-bar"><span class="muted">Question ${ss.i + 1} of ${ss.ids.length}</span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      <div class="progress"><span style="width:${(ss.i / ss.ids.length) * 100}%"></span></div>
      <div class="flashcard rule-card ${ss.revealed ? "revealed" : ""}">
        ${cardHead(it)}
        ${cardBody(it, { reveal: ss.revealed })}
        ${ss.revealed ? "" : `<p class="muted center recall">Answer in your head, then check.</p><button class="btn primary block" type="button" data-action="k-flip">Show answer & trick</button>`}
      </div>
      ${
        ss.revealed
          ? `<div class="grades">
              <button class="grade again" type="button" data-action="k-grade" data-g="again">Forgot<small>tomorrow</small></button>
              <button class="grade hard" type="button" data-action="k-grade" data-g="hard">Hard</button>
              <button class="grade good" type="button" data-action="k-grade" data-g="good">Knew it</button>
              <button class="grade easy" type="button" data-action="k-grade" data-g="easy">Easy</button>
            </div>`
          : ""
      }`,
      { tall: true },
    );
  }

  // ---------- backups ----------
  function exportBackup() {
    const data = gk.exportData();
    download(`vocabvault-gk-backup-${todayISO()}.json`, JSON.stringify(data, null, 1), "application/json");
    toast(
      `GK backup saved: ${plural(gk.liveItems().length, "of your own question")}${
        Object.keys(data.bank).length ? ` + progress on ${plural(Object.keys(data.bank).length, "Question Bank question")}` : ""
      }. The Question Bank itself is built in.`,
      7000,
    );
  }

  async function importBackup(file) {
    try {
      const r = gk.importData(JSON.parse(await file.text()), { markDirty: true, applyPrefs: true });
      toast(
        `✓ GK restored. Backup had ${plural(r.inBackup, "of your own question")}${r.inBackup ? `: ${r.added} new, ${r.updated} updated, ${r.inBackup - r.added - r.updated} already here` : ""}.`,
        8000,
      );
      ctx.afterChange();
      render();
    } catch (e) {
      toast(e instanceof SyntaxError ? "That file isn't a backup (couldn't read it)." : e.message, 7000);
    }
  }

  // ---------- actions ----------
  const actions = {
    "k-open": (el) => showItem(el.dataset.id),
    "k-info": (el) => showInfo(el.dataset.id),
    "k-new": () => showEditor(null),
    "k-edit": (el) => showEditor(el.dataset.id),
    "k-qotd": () => {
      gui.qotdShown = true;
      render();
    },
    "k-star": (el) => {
      gk.updateItem(el.dataset.id, (i) => ({ ...i, starred: !i.starred }));
      showItem(el.dataset.id);
      ctx.afterChange();
    },
    "k-delete": (el) => {
      if (!confirm("Delete this question?")) return;
      gk.deleteItem(el.dataset.id);
      closeOverlay();
      toast("Question deleted.");
      ctx.afterChange();
      render();
    },
    "k-add-bank": (el) => {
      const r = gk.addBankItemToMine(el.dataset.id);
      toast(r ? "Added to your questions ✓" : "Already in your questions.");
      ctx.afterChange();
    },
    "k-complete": async (el) => {
      const it = gk.byId(el.dataset.id);
      if (!it) return;
      toast("AI is completing the question…", 60000);
      try {
        const res = await completeItem(settings(), it);
        if (!res) return toast("The AI couldn't complete this right now. Try again later.", 6000);
        const c = res.card;
        gk.saveItem({ ...it, q: c.q || it.q, a: c.a || it.a, options: c.options, explain: c.explain, trick: c.trick, category: c.category, sub: c.sub, year: c.year, month: c.month, aiAnswered: !it.a && Boolean(c.a) });
        toast(`Completed by ${res.provider} ✓`);
        showItem(it.id);
        ctx.afterChange();
      } catch (e) {
        toast(e.message, 7000);
      }
    },
    "k-typed": () => handleTyped(),
    "k-cancel": () => {
      gui.candidates = null;
      render();
    },
    "k-add-selected": () => {
      const chosen = gui.candidates.items.filter((r) => r.selected).map((r) => r.item);
      const { added, skipped } = gk.addItems(chosen);
      gui.candidates = null;
      gui.typedDraft = "";
      toast(`Added ${plural(added.length, "question")} ✓${skipped.length ? ` (${skipped.length} already saved)` : ""}`);
      ctx.afterChange();
      gui.tab = "mine";
      gui.browse = "";
      go("k-topics");
    },
    "k-set-source": (el) => {
      gk.update((s) => (s.prefs.dailySource = el.dataset.src), { touchesData: false });
      render();
    },
    "k-start-session": () => {
      const plan = gk.todaysPlan();
      const pending = plan.ids.filter((id) => !plan.done[id]);
      gui.session = { ids: pending.length ? pending : [...plan.ids], i: 0, revealed: false, results: {} };
      renderSession();
    },
    "k-flip": () => {
      gui.session.revealed = true;
      renderSession();
    },
    "k-grade": (el) => {
      const ss = gui.session;
      const id = ss.ids[ss.i];
      const g = el.dataset.g;
      const it = gk.byId(id);
      gk.updateItem(id, (i) => review(i, g));
      if (it) gk.markTopic(it);
      ss.results[id] = g;
      gk.update((s) => {
        if (s.daily?.ids.includes(id)) s.daily.done[id] = g;
      }, { touchesData: false });
      ss.i += 1;
      ss.revealed = false;
      renderSession();
      ctx.afterChange();
    },
    "k-start-quiz": (el) => startQuiz(el.dataset.kind, { weakOnly: el.dataset.weak === "1" }),
    "k-practise-topics": (el) => startQuiz("mixed", { topics: el.dataset.topics.split("|") }),
    "k-reveal": () => {
      gui.quiz.revealed = true;
      render();
    },
    "k-pick": (el) => {
      const q = gui.quiz;
      const cur = q.current;
      q.picked = Number(el.dataset.i);
      q.answered += 1;
      const correct = q.picked === cur.answer;
      q.lastCorrect = correct;
      const it = gk.byId(cur.itemId);
      if (correct) q.score += 1;
      else {
        q.wrong.push(cur.itemId);
        q.queue = requeue(q.queue, q.i, cur.itemId, q.requeued);
        gk.updateItem(cur.itemId, (i) => review(i, "again"));
      }
      gk.update((s) => (s.practice = recordAnswer(s.practice, q.source, cur.itemId, correct, { round: q.roundOf[cur.itemId] })), { touchesData: false });
      if (it) gk.markTopic(it);
      render();
    },
    "k-next": () => {
      const q = gui.quiz;
      q.i += 1;
      q.picked = null;
      q.revealed = false;
      q.current = q.i < q.queue.length ? questionFor(q, q.queue.slice(0, q.i).includes(q.queue[q.i])) : null;
      render();
      window.scrollTo(0, 0);
    },
    "k-end-quiz": () => {
      const q = gui.quiz;
      if (q && q.answered && q.i < q.queue.length) {
        q.queue = q.queue.slice(0, q.picked != null ? q.i + 1 : q.i);
        q.i = q.queue.length;
        q.current = null;
        return render();
      }
      gui.quiz = null;
      render();
    },
    "k-toggle-topic": (el) => {
      const tree = buildTree(gk.itemsFor(prefs().practiceSource));
      gk.update((s) => (s.prefs.excluded = toggle(el.dataset.key, s.prefs.excluded, tree)), { touchesData: false });
      render();
    },
    "k-expand": (el) => {
      const k = el.dataset.key;
      if (gui.pickerOpen.has(k)) gui.pickerOpen.delete(k);
      else gui.pickerOpen.add(k);
      render();
    },
    "k-topics-all": () => {
      gk.update((s) => (s.prefs.excluded = []), { touchesData: false });
      render();
    },
    "k-topics-none": () => {
      const tree = buildTree(gk.itemsFor(prefs().practiceSource));
      gk.update((s) => (s.prefs.excluded = [...(tree.get("") || [])]), { touchesData: false });
      render();
    },
    "k-tab": (el) => {
      gui.tab = el.dataset.tab;
      gui.browse = "";
      render();
    },
    "k-browse": (el) => {
      gui.browse = el.dataset.key;
      render();
      window.scrollTo(0, 0);
    },
    "k-export-csv": () => download(`gk-questions-${todayISO()}.csv`, itemsToCSV(gk.liveItems()), "text/csv"),
    "k-export-json": () => exportBackup(),
    "k-reset": () => {
      if (!confirm("Erase all YOUR GK questions and GK progress on this device? (Vocabulary and grammar are not touched; the Question Bank stays.)")) return;
      gk.resetAll();
      toast("GK data erased on this device.");
      render();
    },
  };

  async function onChange(e) {
    const t = e.target;
    if (t.dataset.input === "k-files") {
      const files = [...t.files];
      t.value = "";
      handleFiles(files);
      return true;
    }
    if (t.dataset.input === "k-import") {
      const f = t.files[0];
      t.value = "";
      if (f) await importBackup(f);
      return true;
    }
    if (t.dataset.kpref) {
      const k = t.dataset.kpref;
      const v = t.type === "checkbox" ? t.checked : ["practiceSize", "dailyCount"].includes(k) ? Number(t.value) : t.value;
      gk.update((s) => (s.prefs[k] = v), { touchesData: false });
      render();
      return true;
    }
    if (t.dataset.kcand != null) {
      gui.candidates.items[Number(t.dataset.kcand)].selected = t.checked;
      render();
      return true;
    }
    if (t.dataset.ktopic != null) {
      const row = gui.candidates.items[Number(t.dataset.ktopic)];
      const [category, sub] = t.value.split("|");
      row.item = { ...row.item, category, sub, year: category === CA ? row.item.year || new Date().getFullYear() : 0 };
      render();
      return true;
    }
    if (t.dataset.kyear != null) {
      const row = gui.candidates.items[Number(t.dataset.kyear)];
      row.item = { ...row.item, year: Number(t.value) || row.item.year };
      return true;
    }
    return false;
  }

  function onInput(e) {
    if (e.target.id === "kSearch") {
      gui.search = e.target.value;
      render();
      const input = $("#kSearch");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return true;
    }
    return false;
  }

  function onSubmit(e) {
    if (e.target.id === "kEditForm") {
      e.preventDefault();
      saveEditor(e.target);
      return true;
    }
    return false;
  }

  function prefsCard() {
    const p = prefs();
    return `
      <article class="card">
        <h3>🌍 GK</h3>
        <label class="field">Questions to revise each day
          <select data-kpref="dailyCount">${[5, 10, 15, 20, 30].map((n) => `<option value="${n}" ${Number(p.dailyCount) === n ? "selected" : ""}>${n}</option>`).join("")}</select>
        </label>
        <p class="muted small">The built-in Question Bank has ${gk.bankItems().length} static GK and subject questions, each with a memory trick.
        Current affairs are not built in (they change too fast) — add them from your monthly PDFs and they are filed by year.</p>
      </article>`;
  }

  function dataCard() {
    return `
      <article class="card">
        <h3>🗂️ GK data <span class="badge">separate backup</span></h3>
        <p class="muted small">Your questions, Question Bank progress and GK practice. Separate from the vocabulary and grammar backups.</p>
        <div class="row wrap">
          <button class="btn small" type="button" data-action="k-export-json">⬇ Download GK backup</button>
          <label class="btn small">⬆ Restore GK backup<input type="file" accept="application/json,.json" data-input="k-import" hidden /></label>
          <button class="btn small danger" type="button" data-action="k-reset">Erase GK data</button>
        </div>
      </article>`;
  }

  return {
    gui,
    views: { "k-today": viewToday, "k-add": viewAdd, "k-practice": viewPractice, "k-topics": viewTopics },
    actions,
    onChange,
    onInput,
    onSubmit,
    prefsCard,
    dataCard,
    busy: () => Boolean(gui.busy || gui.quiz || gui.session || gui.candidates),
    onCloseOverlay: () => (gui.session = null),
    questionOfTheDay: () => {
      const pool = gk.itemsFor(prefs().dailySource, { forToday: true });
      return pool.length ? gk.byId(gk.todaysPlan().wotd) : null;
    },
    loadBank,
    isBankId,
  };
}
