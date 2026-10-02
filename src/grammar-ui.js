// The Grammar Rules part of the app: Today, Add, Practice and Rules screens, the rule card, flashcards,
// practice quiz, editor and backups. main.js owns the app shell and passes shared helpers in `ctx`.
import * as gs from "./lib/grammar-store.js";
import { GRAMMAR_KINDS, makeGrammarQuestion } from "./lib/grammar-quiz.js";
import { rulesFromFiles, rulesFromText, completeRule } from "./lib/grammar-ai.js";
import { isAdvanced, isBookId, loadRuleBook } from "./lib/rulebook.js";
import { TOPICS, borrowFromBook, findSimilarRule, makeRule, needsDetails, ruleKey, rulesToCSV, textToRules, SAME_RULE } from "./lib/rules.js";
import { coverage, pickSession, recordAnswer, requeue, weakWords } from "./lib/practice.js";
import { review, stage, stats, streak } from "./lib/srs.js";
import { todayISO } from "./lib/words.js";
import { AllProvidersFailed, hasAI } from "./lib/engine.js";
import { filesToSources, filesToText } from "./lib/extract.js";

const STAGE_LABEL = { new: "New", learning: "Learning", mastered: "Mastered" };
const LIST_SHOWN = 120;

export function createGrammarUI(ctx) {
  const { $, esc, toast, plural, render, go, openOverlay, closeOverlay, settings, download, keyPicker, aiBanner } = ctx;

  /** Grammar screen state (separate from the vocabulary screens). */
  const gui = {
    busy: null,
    candidates: null,
    typedDraft: "",
    quiz: null,
    session: null,
    search: "",
    topic: "all",
    tab: "book", // Rules screen: "mine" | "book"
    filter: "all",
    level: "all", // Rules list filter: "all" | "basic" | "advanced"
  };

  const prefs = () => gs.get().prefs;
  const view = () => ctx.view();
  const setBusy = (text) => {
    gui.busy = text;
    if (view() === "g-add") render();
  };
  const levelSelect = () =>
    `<select data-gpref="bookLevel" aria-label="Rule Book level">${Object.entries(gs.LEVELS)
      .map(([k, l]) => `<option value="${k}" ${prefs().bookLevel === k ? "selected" : ""}>${l}</option>`)
      .join("")}</select>`;
  const sourceSelect = (key, value, extra = "") =>
    `<select data-gpref="${key}" ${extra}>${Object.entries(gs.SOURCES)
      .map(([k, l]) => `<option value="${k}" ${value === k ? "selected" : ""}>${l} (${gs.rulesFor(k).length})</option>`)
      .join("")}</select>`;

  // ---------- the rule card ----------
  function ruleBody(r, { compact = false } = {}) {
    return `
      <p class="rule-text">${esc(r.rule)}</p>
      ${r.hindi ? `<p class="rule-hindi" lang="hi">${esc(r.hindi)}</p>` : ""}
      ${
        r.examples.length
          ? `<div class="rule-block ok"><b>✓ Correct</b><ul>${r.examples.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`
          : ""
      }
      ${
        r.mistakes.length
          ? `<div class="rule-block bad"><b>✗ Common mistake${r.mistakes.length > 1 ? "s" : ""}</b>${r.mistakes
              .map(
                (m) => `<div class="mistake"><span class="wrong">${esc(m.wrong)}</span><span class="right">${esc(m.right)}</span>${
                  m.why && !compact ? `<small>${esc(m.why)}</small>` : ""
                }</div>`,
              )
              .join("")}</div>`
          : ""
      }
      ${r.note ? `<div class="tip"><strong>Exception / note</strong>${esc(r.note)}</div>` : ""}
      ${r.tip && !compact ? `<div class="tip"><strong>🎯 Exam tip</strong>${esc(r.tip)}</div>` : ""}`;
  }

  const ruleHead = (r, { big = false } = {}) => `
    <div class="rule-head">
      <span class="badge topic">${esc(r.topic)}</span>${r.book ? ` <span class="badge bank">Rule Book</span>` : ""}${
        isAdvanced(r) ? ` <span class="badge adv" title="Advanced — RBI Grade B level">⭐ Advanced</span>` : ""
      }${r.starred ? ' <span class="star">★</span>' : ""}
      <h2 class="${big ? "big" : ""}">${esc(r.title)}</h2>
    </div>`;

  const infoBtn = (id) => `<button class="icon-btn info-btn" type="button" data-action="g-info" data-id="${esc(id)}" aria-label="Full rule" title="Full rule">ⓘ</button>`;

  // ---------- Today ----------
  function viewToday() {
    const st = gs.get();
    const source = prefs().dailySource;
    const pool = gs.rulesFor(source);
    if (!pool.length) {
      return `
        <section class="hero">
          <h1>Learn grammar rules the way you learn words.</h1>
          <p>Scan a grammar book page, upload notes or type a rule. Each rule becomes a card with a simple explanation,
          correct examples, common mistakes and practice questions — then it comes back for revision until you've mastered it.</p>
          <div class="stack">
            <button class="btn primary" type="button" data-action="g-set-source" data-src="mixed">📗 Start with the built-in Rule Book (${gs.rulesFor("book").length} rules)</button>
            <button class="btn" type="button" data-nav="g-add">➕ Add your own rules</button>
          </div>
        </section>`;
    }
    const plan = gs.todaysPlan();
    const rotd = gs.byId(plan.wotd);
    const list = plan.ids.map(gs.byId).filter(Boolean);
    const done = list.filter((r) => plan.done[r.id]).length;
    const pct = list.length ? Math.round((done / list.length) * 100) : 0;
    const s = stats(pool);
    const date = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
    return `
      <section class="today-head">
        <div><p class="eyebrow">${esc(date)}</p><h1>Today’s grammar</h1></div>
        <div class="streak" title="Days in a row with grammar revision">🔥 ${streak(st.activity)}</div>
      </section>
      <div class="source-line">
        <label>Rules from ${sourceSelect("dailySource", source)}</label>
        ${source !== "mine" ? `<label>Level ${levelSelect()}</label>` : ""}
      </div>
      <section class="stats">
        <div><b>${s.total}</b><span>rules</span></div>
        <div><b>${s.due}</b><span>due</span></div>
        <div><b>${s.learning}</b><span>learning</span></div>
        <div><b>${s.mastered}</b><span>mastered</span></div>
      </section>
      ${
        rotd
          ? `<article class="card wotd rule-card">
              <p class="eyebrow">✨ Rule of the Day ${infoBtn(rotd.id)}</p>
              ${ruleHead(rotd, { big: true })}
              ${ruleBody(rotd)}
              <div class="row"><button class="btn small" type="button" data-action="g-share" data-id="${esc(rotd.id)}">📤 Share</button></div>
            </article>`
          : ""
      }
      <article class="card">
        <div class="row between"><h3>Rules to revise today</h3><span class="muted">${done}/${list.length}</span></div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        ${
          list.length
            ? `<ul class="plan-list">${list
                .map((r) => {
                  const g = plan.done[r.id];
                  return `<li data-action="g-open" data-id="${esc(r.id)}">
                    <span class="tick ${g ? (g === "again" ? "again" : "ok") : ""}">${g ? (g === "again" ? "↻" : "✓") : ""}</span>
                    <span class="pw">${esc(r.title)}</span>
                    <span class="badge ${stage(r)}">${STAGE_LABEL[stage(r)]}</span>
                  </li>`;
                })
                .join("")}</ul>
              <button class="btn primary block" type="button" data-action="g-start-session">
                ${done === 0 ? "▶ Start revision" : done < list.length ? "▶ Continue" : "↻ Revise again"}
              </button>`
            : `<p class="muted">Only ${plural(pool.length, "rule")} here — it's the Rule of the Day. Add more, or take rules from
               <a href="#" data-action="g-set-source" data-src="mixed">Mixed</a>.</p>`
        }
        ${done && done === list.length ? `<p class="done-msg">🎉 Done for today! Lock it in with <a href="#" data-nav="g-practice">practice</a>.</p>` : ""}
      </article>`;
  }

  // ---------- Add ----------
  function viewAdd() {
    if (gui.busy) return `<section class="card center busy"><div class="spinner" aria-hidden="true"></div><p>${esc(gui.busy)}</p></section>`;
    if (gui.candidates) return viewCandidates();
    const s = settings();
    const ai = hasAI(s);
    return `
      <h1>Add grammar rules</h1>
      <p class="mode ${ai ? "on" : "off"}">${
        ai
          ? "🤖 <b>AI mode</b> — AI reads every rule in your page or notes and writes a full card: simple explanation, Hindi summary, correct examples, common mistakes and practice questions."
          : `🆓 <b>Free mode</b> — your text is split into rules and matched with the built-in Rule Book, which adds examples and questions where it has the same rule. (<a href="#" data-nav="settings">Add a free Gemini key</a> for full AI cards.)`
      }</p>
      ${ai ? keyPicker() : ""}
      <div class="add-grid">
        <label class="add-tile">
          <input type="file" accept="image/*" capture="environment" data-input="g-files" hidden />
          <span class="big-ico">📷</span><b>Scan a page</b><span>Grammar book, notes, worksheet</span>
        </label>
        <label class="add-tile">
          <input type="file" accept="image/*,application/pdf,.pdf" multiple data-input="g-files" hidden />
          <span class="big-ico">🖼️</span><b>Upload screenshot / PDF</b><span>Several files at once is fine</span>
        </label>
      </div>
      <article class="card">
        <h3>✍️ Type or paste rules</h3>
        <p class="muted">One rule, or many separated by blank lines or numbers. Write <code>wrong => right</code> to add a mistake,
        and <code>e.g. …</code> for an example.</p>
        <textarea id="gTyped" rows="6" placeholder="Use 'since' with a point of time and 'for' with a period of time.&#10;e.g. I have lived here since 2015.&#10;I am here since two days => I have been here for two days">${esc(gui.typedDraft)}</textarea>
        <button class="btn primary block" type="button" data-action="g-typed">Check & prepare rules</button>
      </article>
      <p class="muted small">Rules you already have are recognised even when worded differently, and never added twice.
      Browse the <a href="#" data-action="g-rules-tab" data-tab="book">built-in Rule Book</a> anytime.</p>`;
  }

  function viewCandidates() {
    const c = gui.candidates;
    const n = c.items.filter((i) => i.selected).length;
    return `
      <div class="row between"><h1>Review rules</h1><button class="btn small ghost" type="button" data-action="g-cancel">Cancel</button></div>
      <p class="muted">${plural(c.items.length, "rule")} found. Untick any you don't want.</p>
      ${aiBanner(c.ai)}
      ${c.skipped.length ? `<p class="muted small">Already in your rules (skipped): ${esc(c.skipped.map((x) => x.title).slice(0, 8).join("; "))}${c.skipped.length > 8 ? "…" : ""}</p>` : ""}
      <ul class="cand-list rules">
        ${c.items
          .map(
            (it, i) => `<li class="cand ${it.similar ? "similar" : "new"}">
              <label>
                <input type="checkbox" data-gcand="${i}" ${it.selected ? "checked" : ""} />
                <span class="cand-body cand-main">
                  <b>${esc(it.rule.title)}</b> <span class="badge topic">${esc(it.rule.topic)}</span>
                  ${it.similar ? `<span class="badge learning" title="Close to: ${esc(it.similar)}">similar to a saved rule</span>` : ""}
                  <span class="small">${esc(it.rule.rule.slice(0, 220))}${it.rule.rule.length > 220 ? "…" : ""}</span>
                  <span class="muted small">${[
                    plural(it.rule.examples.length, "example"),
                    plural(it.rule.mistakes.length, "mistake"),
                    plural(it.rule.questions.length, "question"),
                  ].join(" · ")}${it.rule.bookId ? " · matched with the Rule Book" : ""}</span>
                </span>
              </label>
            </li>`,
          )
          .join("")}
      </ul>
      <div class="sticky-actions"><button class="btn primary block" type="button" data-action="g-add-selected" ${n ? "" : "disabled"}>Add ${plural(n, "rule")}</button></div>`;
  }

  /** Prepare the review list: duplicates of saved rules are skipped; near-duplicates shown unticked. */
  function showCandidates(rules, ai) {
    const saved = gs.liveRules();
    const items = [];
    const skipped = [];
    for (const raw of rules) {
      const rule = makeRule(raw);
      const dup = findSimilarRule(rule, saved);
      if (dup && (dup.exact || dup.score >= SAME_RULE + 0.15)) {
        skipped.push({ title: rule.title, existing: dup.rule.title });
        continue;
      }
      // Repeats within the same batch.
      if (items.some((x) => ruleKey(x.rule.title) === ruleKey(rule.title))) continue;
      const similar = dup && dup.score >= SAME_RULE ? dup.rule.title : "";
      items.push({ rule, selected: !similar, similar });
    }
    if (!items.length) {
      gui.candidates = null;
      toast(skipped.length ? (skipped.length === 1 ? `“${skipped[0].existing}” is already in your rules ✓` : `All ${skipped.length} rules are already in your rules ✓`) : "No grammar rules found. Try a clearer photo, or type the rule.", 6000);
      return;
    }
    gui.candidates = { items, skipped, ai };
  }

  /** Free mode: split text into rules and borrow examples/questions from matching Rule Book rules. */
  async function freeRules(text, source) {
    const book = (await loadRuleBook(), gs.rulesFor("book"));
    return textToRules(text).map((r) => borrowFromBook(makeRule({ ...r, source }), book));
  }

  async function handleFiles(files) {
    if (!files.length) return;
    const s = settings();
    const source = files.map((f) => f.name).join(", ").slice(0, 120);
    setBusy("Preparing your files…");
    let ai = null;
    try {
      let rules = null;
      if (hasAI(s)) {
        try {
          const sources = await filesToSources(files);
          const res = await rulesFromFiles(s, sources, source, setBusy);
          ai = res;
          rules = res.rules;
        } catch (e) {
          if (!(e instanceof AllProvidersFailed)) throw e;
          ai = { usedBy: [], notes: [e.message], failed: 0 };
        }
      }
      if (!rules) {
        const text = await filesToText(files, setBusy);
        setBusy("Finding the rules…");
        rules = await freeRules(text, source);
      }
      gui.busy = null;
      showCandidates(rules, ai);
    } catch (e) {
      gui.busy = null;
      toast(e.message || String(e), 6000);
    }
    if (view() === "g-add") render();
  }

  async function handleTyped() {
    const text = $("#gTyped")?.value ?? "";
    gui.typedDraft = text;
    if (!text.trim()) return toast("Type a rule first.");
    const s = settings();
    setBusy("Preparing your rules…");
    let ai = null;
    try {
      let rules = null;
      if (hasAI(s)) {
        try {
          const res = await rulesFromText(s, text, setBusy);
          ai = res;
          rules = res.rules.map((r) => ({ ...r, source: "Typed" }));
        } catch (e) {
          if (!(e instanceof AllProvidersFailed)) throw e;
          ai = { usedBy: [], notes: [e.message], failed: 0 };
        }
      }
      rules ??= await freeRules(text, "Typed");
      gui.busy = null;
      showCandidates(rules, ai);
    } catch (e) {
      gui.busy = null;
      toast(e.message || String(e), 6000);
    }
    if (view() === "g-add") render();
  }

  // ---------- Practice ----------
  function practicePool(source) {
    return gs.rulesFor(source);
  }

  function viewPractice() {
    if (gui.quiz) return viewQuiz();
    const p = prefs();
    const source = p.practiceSource;
    const pool = practicePool(source);
    const cov = coverage(pool, gs.get().practice, source);
    const weak = weakWords(pool, gs.get().practice);
    const pct = cov.total ? Math.round((cov.covered / cov.total) * 100) : 0;
    return `
      <h1>Grammar practice</h1>
      <p class="muted">Questions cover <b>every</b> rule before any repeats. Rules you get wrong come back a few questions later — and
      in later sessions until you get them right twice in a row.</p>
      <article class="card">
        <label class="field">Practise rules from ${sourceSelect("practiceSource", source)}</label>
        ${source !== "mine" ? `<label class="field">Rule Book level ${levelSelect()}</label>` : ""}
        ${
          pool.length >= 4
            ? `<p class="small">Round ${cov.round}: <b>${cov.covered}</b> of ${cov.total} rules covered</p>
               <div class="progress"><span style="width:${pct}%"></span></div>
               <p class="small">${
                 weak.length
                   ? `⚠️ <b>${plural(weak.length, "weak rule")}</b>: ${esc(weak.slice(0, 5).map((r) => r.title).join("; "))}${weak.length > 5 ? "…" : ""}`
                   : "✅ No weak rules right now."
               }</p>`
            : `<p>You need at least 4 rules here (found ${pool.length}). Choose the <b>Rule Book</b> or <b>Mixed</b>.</p>`
        }
        <label class="field">Questions per session
          <select data-gpref="practiceSize">${[10, 15, 20, 30]
            .map((n) => `<option value="${n}" ${Number(p.practiceSize) === n ? "selected" : ""}>${n}</option>`)
            .join("")}</select>
        </label>
      </article>
      ${
        pool.length >= 4
          ? `<div class="quiz-grid">${GRAMMAR_KINDS.map(
              ([k, ico, t, d]) =>
                `<button class="quiz-tile" type="button" data-action="g-start-quiz" data-kind="${k}"><span class="big-ico">${ico}</span><b>${t}</b><span>${d}</span></button>`,
            ).join("")}</div>
            ${weak.length ? `<button class="btn block" type="button" data-action="g-start-quiz" data-kind="mixed" data-weak="1">🎯 Fix my ${plural(weak.length, "weak rule")}</button>` : ""}`
          : ""
      }`;
  }

  function startQuiz(kind, { weakOnly = false } = {}) {
    const p = prefs();
    const source = p.practiceSource;
    const pool = practicePool(source);
    let ids;
    let roundOf = {};
    if (weakOnly) {
      ids = weakWords(pool, gs.get().practice).map((r) => r.id).slice(0, Number(p.practiceSize));
    } else {
      const picked = pickSession(pool, gs.get().practice, source, Number(p.practiceSize) || 15);
      ids = picked.ids;
      roundOf = picked.roundOf;
      gs.update((s) => (s.practice = picked.practice), { touchesData: false });
    }
    if (!ids.length) return toast("Nothing to practise here yet.");
    gui.quiz = { kind, source, queue: ids, roundOf, i: 0, picked: null, revealed: false, score: 0, answered: 0, wrong: [], requeued: new Set(), pool };
    gui.quiz.current = questionFor(gui.quiz, false);
    render();
    window.scrollTo(0, 0);
  }

  function questionFor(q, retry) {
    const rule = gs.byId(q.queue[q.i]) || q.pool.find((r) => r.id === q.queue[q.i]);
    if (!rule) return null;
    return { ...makeGrammarQuestion(rule, q.kind, q.pool), retry };
  }

  function viewQuiz() {
    const q = gui.quiz;
    if (q.i >= q.queue.length || !q.current) {
      const wrong = [...new Set(q.wrong)].map(gs.byId).filter(Boolean);
      const cov = coverage(q.pool, gs.get().practice, q.source);
      return `
        <article class="card center">
          <p class="eyebrow">Session complete</p>
          <p class="score">${q.score}/${q.answered}</p>
          <p>${q.answered && q.score === q.answered ? "Perfect! 🏆" : q.score >= q.answered * 0.7 ? "Great work 💪" : "Keep going — the weak rules will come back 📈"}</p>
          <p class="small muted">Round ${cov.round}: ${cov.covered} of ${cov.total} rules covered</p>
          ${wrong.length ? `<p class="muted">Will come back (tap to read): ${wrong.map((r) => `<a href="#" data-action="g-info" data-id="${esc(r.id)}">${esc(r.title)} ⓘ</a>`).join("; ")}</p>` : ""}
          <div class="row center">
            <button class="btn primary" type="button" data-action="g-start-quiz" data-kind="${q.kind}">Next session</button>
            <button class="btn" type="button" data-action="g-end-quiz">Done</button>
          </div>
        </article>`;
    }
    const cur = q.current;
    const answered = q.picked != null;
    const rule = gs.byId(cur.ruleId);
    const recallHidden = cur.selfGraded && !q.revealed;
    return `
      <div class="row between">
        <span class="muted">Question ${q.i + 1} of ${q.queue.length} · ${esc(gs.SOURCES[q.source])}</span>
        <button class="btn small ghost" type="button" data-action="g-end-quiz">Finish</button>
      </div>
      <div class="progress"><span style="width:${(q.i / q.queue.length) * 100}%"></span></div>
      <article class="card quiz-card">
        <p class="eyebrow">${esc(cur.label)}${cur.retry ? ` <span class="badge learning">again</span>` : ""}</p>
        <div class="quiz-prompt ${cur.kind === "spot" || cur.kind === "rule" ? "sentence" : ""}">${esc(cur.prompt)}</div>
        ${
          recallHidden
            ? `<p class="muted center">Say the rule to yourself — with an example — then check.</p>
               <button class="btn primary block" type="button" data-action="g-reveal">Show the rule</button>`
            : `${cur.selfGraded && rule ? `<div class="recall-rule">${ruleBody(rule, { compact: true })}</div>` : ""}
               <div class="options ${cur.options.length === 2 ? "two" : ""}">
                ${cur.options
                  .map((o, i) => {
                    let cls = "";
                    if (answered) cls = cur.selfGraded ? (i === q.picked ? (i === 0 ? "correct" : "wrong") : "dim") : i === cur.answer ? "correct" : i === q.picked ? "wrong" : "dim";
                    return `<button class="option ${cls}" type="button" data-action="g-pick" data-i="${i}" ${answered ? "disabled" : ""}>${esc(o)}</button>`;
                  })
                  .join("")}
              </div>`
        }
        ${
          answered
            ? `<div class="explain g-explain ${q.lastCorrect ? "ok" : "bad"}">
                 <div class="explain-text">
                   ${cur.right ? `<p class="small"><b>Correct:</b> ${esc(cur.right)}</p>` : ""}
                   ${cur.why ? `<p class="small">${esc(cur.why)}</p>` : ""}
                   <p class="small"><b>${q.lastCorrect ? "✓" : "✗"} ${esc(cur.title)}</b>${rule && !cur.selfGraded ? ` — ${esc(rule.rule.slice(0, 200))}${rule.rule.length > 200 ? "…" : ""}` : ""}</p>
                 </div>
                 ${infoBtn(cur.ruleId)}
               </div>
               <button class="btn primary block" type="button" data-action="g-next">${q.i + 1 < q.queue.length ? "Next →" : "See score"}</button>`
            : ""
        }
      </article>`;
  }

  // ---------- Rules list ----------
  function viewRules() {
    const bookTab = gui.tab === "book";
    const all = bookTab ? gs.bookRules() : gs.liveRules();
    const term = gui.search.trim().toLowerCase();
    const topics = [...new Set(all.map((r) => r.topic))].sort((a, b) => TOPICS.indexOf(a) - TOPICS.indexOf(b));
    const list = all.filter((r) => {
      if (gui.topic !== "all" && r.topic !== gui.topic) return false;
      if (gui.level !== "all" && !gs.levelOk(r, gui.level)) return false;
      if (gui.filter === "starred" && !r.starred) return false;
      if (["new", "learning", "mastered"].includes(gui.filter) && stage(r) !== gui.filter) return false;
      if (gui.filter === "weak" && !gs.get().practice.weak[r.id]?.need) return false;
      if (term && !`${r.title} ${r.rule} ${r.topic} ${r.examples.join(" ")}`.toLowerCase().includes(term)) return false;
      return true;
    });
    return `
      <div class="seg" role="tablist">
        <button type="button" class="${bookTab ? "" : "active"}" data-action="g-rules-tab" data-tab="mine">My rules (${gs.liveRules().length})</button>
        <button type="button" class="${bookTab ? "active" : ""}" data-action="g-rules-tab" data-tab="book">📗 Rule Book (${gs.bookRules().length})</button>
      </div>
      <div class="row between">
        <h1>${bookTab ? "Rule Book" : "My rules"}</h1>
        ${bookTab ? "" : `<button class="btn small" type="button" data-action="g-new">＋ New</button>`}
      </div>
      <input type="search" id="gSearch" placeholder="Search rules, e.g. since, articles, either" value="${esc(gui.search)}" autocomplete="off" />
      <div class="two">
        <label class="field">Topic
          <select data-gfilter="topic"><option value="all">All topics</option>${topics
            .map((t) => `<option value="${esc(t)}" ${gui.topic === t ? "selected" : ""}>${esc(t)}</option>`)
            .join("")}</select>
        </label>
        <label class="field">Show
          <select data-gfilter="filter">${[
            ["all", "All"],
            ["new", "New"],
            ["learning", "Learning"],
            ["mastered", "Mastered"],
            ["weak", "Weak in practice"],
            ["starred", "★ Starred"],
          ]
            .map(([k, l]) => `<option value="${k}" ${gui.filter === k ? "selected" : ""}>${l}</option>`)
            .join("")}</select>
        </label>
      </div>
      <label class="field">Level
        <select data-gfilter="level">${Object.entries(gs.LEVELS)
          .map(([k, l]) => `<option value="${k}" ${gui.level === k ? "selected" : ""}>${l} (${all.filter((r) => gs.levelOk(r, k)).length})</option>`)
          .join("")}</select>
      </label>
      ${
        list.length
          ? `<ul class="word-list rule-list">${list
              .slice(0, LIST_SHOWN)
              .map(
                (r) => `<li data-action="g-open" data-id="${esc(r.id)}">
                  <div><b>${esc(r.title)}</b>${isAdvanced(r) ? ' <span class="adv-mark" title="Advanced">⭐</span>' : ""}${r.starred ? ' <span class="star">★</span>' : ""}<span class="muted small block">${esc(r.topic)}${needsDetails(r) ? " · needs details" : ""}</span></div>
                  <span class="badge ${stage(r)}">${STAGE_LABEL[stage(r)]}</span>
                </li>`,
              )
              .join("")}</ul>
            ${list.length > LIST_SHOWN ? `<p class="muted small center">Showing ${LIST_SHOWN} of ${list.length}. Search or pick a topic to narrow down.</p>` : ""}`
          : `<p class="muted center">${
              bookTab
                ? "No rules match."
                : gs.liveRules().length
                  ? "No rules match."
                  : `No rules of your own yet. <a href="#" data-nav="g-add">Add some</a>, or copy any rule from the <a href="#" data-action="g-rules-tab" data-tab="book">Rule Book</a>.`
            }</p>`
      }
      ${
        !bookTab && gs.liveRules().length
          ? `<div class="row wrap center"><button class="btn small" type="button" data-action="g-export-csv">⬇ Rules as CSV (Excel)</button></div>`
          : ""
      }`;
  }

  // ---------- rule detail, info layer, editor ----------
  function progressLine(r) {
    const next = stage(r) === "new" ? "not started" : new Date(`${r.due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const weak = gs.get().practice.weak[r.id];
    return `<p class="muted small">Next revision: ${esc(next)} · Revised ${plural(r.reviews, "time")}${
      weak ? ` · Practice: ${weak.right} right, ${weak.wrong} wrong${weak.need ? " (still weak)" : ""}` : ""
    }</p>`;
  }

  function showRule(id) {
    const r = gs.byId(id);
    if (!r) return toast("That rule is no longer saved.");
    const mine = isBookId(id) && gs.liveRules().some((x) => x.bookId === id || ruleKey(x.title) === ruleKey(r.title));
    openOverlay(`
      <div class="sheet-bar"><span class="badge ${stage(r)}">${STAGE_LABEL[stage(r)]}</span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      ${ruleHead(r, { big: true })}
      ${ruleBody(r)}
      ${r.questions.length ? `<p class="muted small">${plural(r.questions.length, "practice question")} · ${esc(r.source || "")}</p>` : ""}
      ${progressLine(r)}
      <div class="row wrap">
        <button class="btn small" type="button" data-action="g-star" data-id="${esc(r.id)}">${r.starred ? "★ Unstar" : "☆ Star"}</button>
        ${
          r.book
            ? mine
              ? `<span class="badge mastered">In your rules</span>`
              : `<button class="btn small primary" type="button" data-action="g-add-book" data-id="${esc(r.id)}">＋ Add to my rules</button>`
            : `<button class="btn small" type="button" data-action="g-edit" data-id="${esc(r.id)}">✎ Edit</button>
               ${hasAI(settings()) ? `<button class="btn small" type="button" data-action="g-complete" data-id="${esc(r.id)}">🤖 ${needsDetails(r) ? "Complete" : "Refresh"} with AI</button>` : ""}
               <button class="btn small danger" type="button" data-action="g-delete" data-id="${esc(r.id)}">Delete</button>`
        }
      </div>`);
  }

  function showInfo(id) {
    const r = gs.byId(id);
    if (!r) return toast("That rule is no longer saved.");
    const layer = $("#info");
    layer.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(r.title)}">
      <div class="sheet-bar"><span class="badge ${stage(r)}">${STAGE_LABEL[stage(r)]}</span>
        <button class="icon-btn" type="button" data-action="close-info" aria-label="Close">✕</button></div>
      ${ruleHead(r, { big: true })}
      ${ruleBody(r)}
      ${progressLine(r)}
      <div class="row wrap"><button class="btn small" type="button" data-action="close-info">Back</button></div>
    </div>`;
    layer.classList.add("open");
  }

  function showEditor(id) {
    const r = id ? gs.byId(id) : null;
    const v = (k) => esc(r?.[k] ?? "");
    openOverlay(`
      <div class="sheet-bar"><h3>${r ? "Edit rule" : "New rule"}</h3><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      <form id="gEditForm" data-id="${esc(r?.id ?? "")}">
        <label class="field">Rule name<input name="title" required value="${v("title")}" placeholder="'Since' and 'for'" /></label>
        <label class="field">Topic<select name="topic">${TOPICS.map((t) => `<option ${((r?.topic ?? "Other") === t && "selected") || ""}>${esc(t)}</option>`).join("")}</select></label>
        <label class="field">The rule (simple words)<textarea name="rule" rows="3" required>${v("rule")}</textarea></label>
        <label class="field">Hindi summary<input name="hindi" lang="hi" value="${v("hindi")}" /></label>
        <label class="field">Correct examples (one per line)<textarea name="examples" rows="3">${esc((r?.examples ?? []).join("\n"))}</textarea></label>
        <label class="field">Common mistakes (one per line: wrong => right)<textarea name="mistakes" rows="3" placeholder="I am here since two days => I have been here for two days">${esc(
          (r?.mistakes ?? []).map((m) => `${m.wrong} => ${m.right}`).join("\n"),
        )}</textarea></label>
        <label class="field">Exception / note<textarea name="note" rows="2">${v("note")}</textarea></label>
        <label class="field">Exam tip<textarea name="tip" rows="2">${v("tip")}</textarea></label>
        <button class="btn primary block" type="submit">Save</button>
        ${r?.questions?.length ? `<p class="muted small center">Its ${plural(r.questions.length, "practice question")} are kept.</p>` : ""}
      </form>`);
  }

  function saveEditor(form) {
    const f = new FormData(form);
    const id = form.dataset.id;
    const cur = id ? gs.byId(id) : null;
    const lines = (k) => String(f.get(k) || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const whyOf = (wrong) => cur?.mistakes.find((m) => m.wrong === wrong)?.why || "";
    const mistakes = lines("mistakes")
      .map((l) => l.split(/\s*(?:=>|→|->)\s*/))
      .filter((p) => p.length === 2)
      .map(([wrong, right]) => ({ wrong, right, why: whyOf(wrong) }));
    const input = {
      ...(cur || {}),
      title: f.get("title"),
      topic: f.get("topic"),
      rule: f.get("rule"),
      hindi: f.get("hindi"),
      examples: lines("examples"),
      mistakes,
      note: f.get("note"),
      tip: f.get("tip"),
      source: cur?.source || "Typed",
    };
    if (!cur) {
      const { added, skipped } = gs.addRules([input]);
      if (!added.length) return toast(`You already have this rule: “${skipped[0]?.existing}”.`, 5000);
    } else gs.saveRule(input);
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
          <p>You remembered <b>${known}</b> of ${vals.length}. Rules you missed come back tomorrow.</p>
          <button class="btn primary" type="button" data-action="close">Back to Today</button></div>`);
      return;
    }
    const r = gs.byId(ss.ids[ss.i]);
    if (!r) {
      ss.i += 1;
      return renderSession();
    }
    const m = r.mistakes[0];
    openOverlay(
      `
      <div class="sheet-bar"><span class="muted">Rule ${ss.i + 1} of ${ss.ids.length}</span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      <div class="progress"><span style="width:${(ss.i / ss.ids.length) * 100}%"></span></div>
      <div class="flashcard rule-card ${ss.revealed ? "revealed" : ""}">
        ${ruleHead(r, { big: true })}
        ${
          ss.revealed
            ? ruleBody(r)
            : `${m ? `<p class="spot">Spot the mistake:<br /><span class="sentence">${esc(m.wrong)}</span></p>` : ""}
               <p class="muted center recall">Recall the rule${m ? " and the correction" : ""}, then check.</p>
               <button class="btn primary block" type="button" data-action="g-flip">Show the rule</button>`
        }
      </div>
      ${
        ss.revealed
          ? `<div class="grades">
              <button class="grade again" type="button" data-action="g-grade" data-g="again">Forgot<small>tomorrow</small></button>
              <button class="grade hard" type="button" data-action="g-grade" data-g="hard">Hard</button>
              <button class="grade good" type="button" data-action="g-grade" data-g="good">Knew it</button>
              <button class="grade easy" type="button" data-action="g-grade" data-g="easy">Easy</button>
            </div>`
          : ""
      }`,
      { tall: true },
    );
  }

  // ---------- backups ----------
  function exportBackup() {
    const data = gs.exportData();
    download(`vocabvault-grammar-backup-${todayISO()}.json`, JSON.stringify(data, null, 1), "application/json");
    toast(
      `Grammar backup saved: ${plural(gs.liveRules().length, "of your own rule")}${
        Object.keys(data.book).length ? ` + progress on ${plural(Object.keys(data.book).length, "Rule Book rule")}` : ""
      }. The Rule Book itself is built in.`,
      7000,
    );
  }

  async function importBackup(file) {
    try {
      const r = gs.importData(JSON.parse(await file.text()), { markDirty: true, applyPrefs: true });
      toast(
        `✓ Grammar restored. Backup had ${plural(r.inBackup, "of your own rule")}${r.inBackup ? `: ${r.added} new, ${r.updated} updated, ${r.inBackup - r.added - r.updated} already here` : ""}.${
          r.bookProgress ? ` Rule Book progress for ${plural(r.bookProgress, "rule")}.` : ""
        }`,
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
    "g-open": (el) => showRule(el.dataset.id),
    "g-info": (el) => showInfo(el.dataset.id),
    "g-new": () => showEditor(null),
    "g-edit": (el) => showEditor(el.dataset.id),
    "g-star": (el) => {
      gs.updateRule(el.dataset.id, (r) => ({ ...r, starred: !r.starred }));
      showRule(el.dataset.id);
      ctx.afterChange();
    },
    "g-delete": (el) => {
      if (!confirm("Delete this rule?")) return;
      gs.deleteRule(el.dataset.id);
      closeOverlay();
      toast("Rule deleted.");
      ctx.afterChange();
      render();
    },
    "g-add-book": (el) => {
      const r = gs.addBookRuleToMine(el.dataset.id);
      toast(r ? "Added to your rules ✓" : "Already in your rules.");
      showRule(el.dataset.id);
      ctx.afterChange();
    },
    "g-complete": async (el) => {
      const r = gs.byId(el.dataset.id);
      if (!r) return;
      toast("AI is writing the full rule card…", 60000);
      try {
        const res = await completeRule(settings(), r, null);
        if (!res) return toast("The AI couldn't complete this rule right now. Try again later.", 6000);
        gs.saveRule({ ...r, ...makeRule({ ...res.card, id: r.id }), id: r.id, addedAt: r.addedAt, box: r.box, due: r.due, reviews: r.reviews, lapses: r.lapses, starred: r.starred, source: r.source });
        toast(`Completed by ${res.provider} ✓`);
        showRule(r.id);
        ctx.afterChange();
      } catch (e) {
        toast(e.message, 7000);
      }
    },
    "g-typed": () => handleTyped(),
    "g-cancel": () => {
      gui.candidates = null;
      render();
    },
    "g-add-selected": () => {
      const chosen = gui.candidates.items.filter((i) => i.selected).map((i) => i.rule);
      const { added, skipped } = gs.addRules(chosen);
      gui.candidates = null;
      gui.typedDraft = "";
      toast(`Added ${plural(added.length, "rule")} ✓${skipped.length ? ` (${skipped.length} already saved)` : ""}`);
      ctx.afterChange();
      gui.tab = "mine";
      go("g-rules");
    },
    "g-rules-tab": (el) => {
      gui.tab = el.dataset.tab;
      gui.topic = "all";
      gui.level = el.dataset.level || "all";
      if (view() !== "g-rules") go("g-rules");
      else render();
    },
    "g-set-source": (el) => {
      gs.update((s) => (s.prefs.dailySource = el.dataset.src), { touchesData: false });
      render();
    },
    "g-start-session": () => {
      const plan = gs.todaysPlan();
      const pending = plan.ids.filter((id) => !plan.done[id]);
      gui.session = { ids: pending.length ? pending : [...plan.ids], i: 0, revealed: false, results: {} };
      renderSession();
    },
    "g-flip": () => {
      gui.session.revealed = true;
      renderSession();
    },
    "g-grade": (el) => {
      const ss = gui.session;
      const id = ss.ids[ss.i];
      const g = el.dataset.g;
      gs.updateRule(id, (r) => review(r, g));
      ss.results[id] = g;
      gs.update((s) => {
        if (s.daily?.ids.includes(id)) s.daily.done[id] = g;
      }, { touchesData: false });
      gs.markActive();
      ss.i += 1;
      ss.revealed = false;
      renderSession();
      ctx.afterChange();
    },
    "g-start-quiz": (el) => startQuiz(el.dataset.kind, { weakOnly: el.dataset.weak === "1" }),
    "g-reveal": () => {
      gui.quiz.revealed = true;
      render();
    },
    "g-pick": (el) => {
      const q = gui.quiz;
      const cur = q.current;
      q.picked = Number(el.dataset.i);
      q.answered += 1;
      const correct = q.picked === cur.answer;
      q.lastCorrect = correct;
      if (correct) q.score += 1;
      else {
        q.wrong.push(cur.ruleId);
        q.queue = requeue(q.queue, q.i, cur.ruleId, q.requeued);
        gs.updateRule(cur.ruleId, (r) => review(r, "again"));
      }
      gs.update((s) => (s.practice = recordAnswer(s.practice, q.source, cur.ruleId, correct, { round: q.roundOf[cur.ruleId] })), { touchesData: false });
      gs.markActive();
      render();
    },
    "g-next": () => {
      const q = gui.quiz;
      q.i += 1;
      q.picked = null;
      q.revealed = false;
      q.current = q.i < q.queue.length ? questionFor(q, q.queue.slice(0, q.i).includes(q.queue[q.i])) : null;
      render();
      window.scrollTo(0, 0);
    },
    "g-end-quiz": () => {
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
    "g-share": async (el) => {
      const r = gs.byId(el.dataset.id);
      if (!r) return;
      const m = r.mistakes[0];
      const text = `📗 Grammar rule of the day: ${r.title}\n\n${r.rule}${m ? `\n\n✗ ${m.wrong}\n✓ ${m.right}` : ""}${r.examples[0] ? `\n\nExample: ${r.examples[0]}` : ""}`;
      try {
        if (navigator.share) await navigator.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          toast("Copied — paste it anywhere.");
        }
      } catch {
        /* share cancelled */
      }
    },
    "g-export-csv": () => download(`grammar-rules-${todayISO()}.csv`, rulesToCSV(gs.liveRules()), "text/csv"),
    "g-export-json": () => exportBackup(),
    "g-reset": () => {
      if (!confirm("Erase all YOUR grammar rules and grammar progress on this device? (Vocabulary is not touched, and the Rule Book stays.)")) return;
      gs.resetAll();
      toast("Grammar data erased on this device.");
      render();
    },
  };

  /** change events for grammar inputs. Returns true when handled. */
  async function onChange(e) {
    const t = e.target;
    if (t.dataset.input === "g-files") {
      const files = [...t.files];
      t.value = "";
      handleFiles(files);
      return true;
    }
    if (t.dataset.input === "g-import") {
      const f = t.files[0];
      t.value = "";
      if (f) await importBackup(f);
      return true;
    }
    if (t.dataset.gpref) {
      const k = t.dataset.gpref;
      const v = ["practiceSize", "dailyCount"].includes(k) ? Number(t.value) : t.value;
      gs.update((s) => (s.prefs[k] = v), { touchesData: false });
      render();
      return true;
    }
    if (t.dataset.gfilter) {
      gui[t.dataset.gfilter] = t.value;
      render();
      return true;
    }
    if (t.dataset.gcand != null) {
      gui.candidates.items[Number(t.dataset.gcand)].selected = t.checked;
      render();
      return true;
    }
    return false;
  }

  function onInput(e) {
    if (e.target.id === "gSearch") {
      gui.search = e.target.value;
      render();
      const input = $("#gSearch");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return true;
    }
    return false;
  }

  function onSubmit(e) {
    if (e.target.id === "gEditForm") {
      e.preventDefault();
      saveEditor(e.target);
      return true;
    }
    return false;
  }

  /** Settings card: grammar preferences. */
  function prefsCard() {
    const p = prefs();
    return `
      <article class="card">
        <h3>📗 Grammar Rules</h3>
        <label class="field">Rules to revise each day
          <select data-gpref="dailyCount">${[3, 5, 7, 10, 15]
            .map((n) => `<option value="${n}" ${Number(p.dailyCount) === n ? "selected" : ""}>${n}</option>`)
            .join("")}</select>
        </label>
        <label class="field">Rule Book level for Today and Practice ${levelSelect()}</label>
        <p class="muted small">The built-in Rule Book has ${gs.bookRules().length} exam rules — ${
          gs.bookRules().filter(isAdvanced).length
        } of them advanced (RBI Grade B level), most with an exception note. Your own rules are always included.</p>
      </article>`;
  }

  /** Settings card: grammar backups (separate from vocabulary). */
  function dataCard() {
    return `
      <article class="card">
        <h3>🗂️ Grammar data <span class="badge">separate backup</span></h3>
        <p class="muted small">Your rules, Rule Book progress and grammar practice. This backup is separate from the vocabulary backup.</p>
        <div class="row wrap">
          <button class="btn small" type="button" data-action="g-export-json">⬇ Download grammar backup</button>
          <label class="btn small">⬆ Restore grammar backup<input type="file" accept="application/json,.json" data-input="g-import" hidden /></label>
          <button class="btn small danger" type="button" data-action="g-reset">Erase grammar data</button>
        </div>
      </article>`;
  }

  return {
    gui,
    views: { "g-today": viewToday, "g-add": viewAdd, "g-practice": viewPractice, "g-rules": viewRules },
    actions,
    onChange,
    onInput,
    onSubmit,
    prefsCard,
    dataCard,
    busy: () => Boolean(gui.busy || gui.quiz || gui.session || gui.candidates),
    onCloseOverlay: () => (gui.session = null),
    exportBackup,
    ruleOfTheDay: () => {
      const pool = gs.rulesFor(prefs().dailySource);
      return pool.length ? gs.byId(gs.todaysPlan().wotd) : null;
    },
  };
}
