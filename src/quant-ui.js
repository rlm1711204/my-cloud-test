// One of the two parts, 🔢 Maths or 🧩 Reasoning (createQuantUI is called once for each): Today, Add, Practice (incl. "practise one question type"), Topics (subject → topic →
// formula sheet + question types). main.js owns the shell and passes `ctx`; this mirrors gk-ui.js.
import { SOURCES } from "./lib/quant-store.js";
import { QUANT_KINDS, kindAccepts, makeQuantQuestion } from "./lib/quant-quiz.js";
import { figureFor, isQTopicLike, practiceFor, quantFromFiles, quantFromText, quantFromTopic, readNotes, readPastedQ } from "./lib/quant-ai.js";
import { buildQuantMaterialPrompt, buildQuantTopicPrompt, buildSimilarPrompt, looksQuantStructured } from "./lib/quant-prompt.js";
import { isBookId, loadQBook } from "./lib/qbook.js";
import { ALL_QTOPICS, QTAXONOMY, SEP, qPatternKey, qTopicKey } from "./lib/quant-taxonomy.js";
import { makeQItem, qItemsToCSV } from "./lib/quant.js";
import { cleanImage, sanitizeSvg } from "./lib/svgsafe.js";
import { buildFigurePrompt } from "./lib/quant-prompt.js";
import { labelOf, nodeState, toggle } from "./lib/gk-topics.js";
import { coverage, pickSession, recordAnswer, requeue, weakWords } from "./lib/practice.js";
import { practiceReview, review, stage, stats, streak } from "./lib/srs.js";
import { todayISO } from "./lib/words.js";
import { AllProvidersFailed, hasAI } from "./lib/engine.js";
import { filesToSources, filesToText } from "./lib/extract.js";

const STAGE_LABEL = { new: "New", learning: "Learning", mastered: "Mastered" };
const SUBJECT_ICON = (s) => QTAXONOMY[s]?.icon || "📁";
const LIST_SHOWN = 120;
const COUNT_CHOICES = [
  ["auto", "Auto — every formula and question type"],
  ["10", "About 10 questions"],
  ["20", "About 20 questions"],
  ["30", "About 30 questions"],
];

export function createQuantUI(ctx, part) {
  // part: {store, prefix ("m" | "r"), subject, title ("Maths"), icon, slug, examples}
  const qs = part.store;
  const P = part.prefix;
  const { $, esc, toast, plural, render, go, openOverlay, closeOverlay, settings, download, keyPicker, aiBanner } = ctx;

  const gui = {
    busy: null,
    candidates: null,
    typedDraft: "",
    topicDraft: "",
    topicCount: "auto",
    copied: false, // false | "topic" | "files" | "similar"
    chatFiles: null,
    chatThumbs: null,
    lastFiles: null,
    quiz: null,
    session: null,
    search: "",
    browse: "",
    tab: "all",
    pickerOpen: new Set(),
    qotdShown: false,
  };
  const prefs = () => qs.get().prefs;
  const view = () => ctx.view();
  const setBusy = (text) => {
    gui.busy = text;
    if (view() === `${P}-add`) render();
  };
  const lines = (t) => esc(t).replace(/\n/g, "<br />");
  const sourceSelect = (key, value) =>
    `<select data-${P}pref="${key}">${Object.entries(SOURCES)
      .map(([k, l]) => `<option value="${k}" ${value === k ? "selected" : ""}>${l} (${qs.itemsFor(k).length})</option>`)
      .join("")}</select>`;
  const infoBtn = (id) => `<button class="icon-btn info-btn" type="button" data-action="${P}-info" data-id="${esc(id)}" aria-label="Full card" title="Full card">ⓘ</button>`;

  // ---------- the card ----------
  function itemHead(it) {
    return `<div class="rule-head q-head">
      <span class="badge topic">${SUBJECT_ICON(it.subject)} ${esc(it.topic)}</span>
      ${it.pattern ? `<span class="badge type">${esc(it.pattern)}</span>` : ""}
      ${it.kind === "formula" ? `<span class="badge formula">📐 Formula</span>` : it.variantOf ? `<span class="badge learning">🔁 Practice</span>` : ""}
      ${it.book ? `<span class="badge bank">Formula Book</span>` : ""}${it.starred ? ' <span class="star">★</span>' : ""}
    </div>`;
  }

  /** The figure: a labelled drawing (always re-cleaned before it is shown) and/or the attached photo. */
  const figureBlock = (it, { small = false } = {}) => {
    const svg = sanitizeSvg(it.figure);
    const img = cleanImage(it.image);
    if (!svg && !img) return "";
    return `<figure class="fig ${small ? "small" : ""}">${svg}${img ? `<img src="${esc(img)}" alt="Figure" />` : ""}</figure>`;
  };

  function itemBody(it, { reveal = true } = {}) {
    // The figure is part of the question (and the cue for a formula), so it shows before the answer is revealed.
    if (it.kind === "formula") {
      return `<h3 class="q-title">${esc(it.q)}</h3>
        ${figureBlock(it)}
        ${reveal ? formulaBlock(it) : ""}`;
    }
    return `<p class="q-text">${lines(it.q)}</p>
      ${figureBlock(it)}
      ${
        reveal
          ? `<p class="gk-a">✓ ${esc(it.a || "—")}${it.aiAnswered ? ` <span class="badge learning" title="Answer worked out by AI — worth a quick check">AI answer · check</span>` : ""}${
              it.aiMade ? ` <span class="badge" title="Practice question written by AI">AI-made</span>` : ""
            }</p>
            ${it.options.length ? `<p class="muted small">Not: ${esc(it.options.join(" · "))}</p>` : ""}
            ${it.solution ? `<div class="rule-block ok"><b>Solution</b>${lines(it.solution)}</div>` : ""}
            ${it.formula ? `<div class="formula-box"><b>📐 Formula</b>${lines(it.formula)}</div>` : ""}
            ${it.trick ? `<div class="tip"><strong>💡 Trick</strong>${lines(it.trick)}</div>` : ""}`
          : ""
      }`;
  }
  const formulaBlock = (it) =>
    `${it.formula ? `<div class="formula-box">${lines(it.formula)}</div>` : ""}
     ${it.trick ? `<div class="tip"><strong>💡 Trick</strong>${lines(it.trick)}</div>` : ""}
     ${it.solution ? `<p class="small"><b>Example:</b> ${lines(it.solution)}</p>` : ""}`;

  // ---------- Today ----------
  function staleTopics(n = 3) {
    const pool = qs.itemsFor(prefs().dailySource);
    const seen = qs.get().topicSeen;
    const keys = [...new Set(pool.map(qTopicKey))];
    return keys.sort((a, b) => String(seen[a] || "").localeCompare(String(seen[b] || "")) || a.localeCompare(b)).slice(0, n);
  }

  function viewToday() {
    const st = qs.get();
    const source = prefs().dailySource;
    const pool = qs.itemsFor(source, { forToday: true });
    if (!pool.length) {
      return `
        <section class="hero">
          <h1>${part.title}, revised daily.</h1>
          <p>Scan your notes (handwritten PDFs too), paste questions, or ask Gemini about a topic. Every question is filed under its topic
          and question type, with the solution, formula and a short trick — plus 2 practice questions of the same type.</p>
          <div class="stack">
            <button class="btn primary" type="button" data-action="${P}-set-source" data-src="mixed">📐 Start with the built-in Formula Book (${qs.bookItems().length} cards)</button>
            <button class="btn" type="button" data-nav="${P}-add">➕ Add your own notes</button>
          </div>
        </section>`;
    }
    const plan = qs.todaysPlan();
    const qotd = qs.byId(plan.wotd);
    const list = plan.ids.map(qs.byId).filter(Boolean);
    const done = list.filter((i) => plan.done[i.id]).length;
    const pct = list.length ? Math.round((done / list.length) * 100) : 0;
    const s = stats(pool);
    const stale = staleTopics();
    const date = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
    return `
      <section class="today-head">
        <div><p class="eyebrow">${esc(date)}</p><h1>Today’s ${part.title}</h1></div>
        <div class="streak" title="Days in a row">🔥 ${streak(st.activity)}</div>
      </section>
      <div class="source-line"><label>Cards from ${sourceSelect("dailySource", source)}</label></div>
      <section class="stats">
        <div><b>${s.total}</b><span>cards</span></div>
        <div><b>${s.due}</b><span>due</span></div>
        <div><b>${s.learning}</b><span>learning</span></div>
        <div><b>${s.mastered}</b><span>mastered</span></div>
      </section>
      ${
        qotd
          ? `<article class="card wotd rule-card">
              <p class="eyebrow">✨ ${qotd.kind === "formula" ? "Formula" : "Question"} of the Day ${infoBtn(qotd.id)}</p>
              ${itemHead(qotd)}
              ${itemBody(qotd, { reveal: gui.qotdShown })}
              ${gui.qotdShown ? "" : `<button class="btn block" type="button" data-action="${P}-qotd">${qotd.kind === "formula" ? "Show the formula & trick" : "Show answer & solution"}</button>`}
            </article>`
          : ""
      }
      <article class="card">
        <div class="row between"><h3>To revise today</h3><span class="muted">${done}/${list.length}</span></div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <p class="muted small">Spread across ${new Set(list.map(qTopicKey)).size} topics.</p>
        <ul class="plan-list">${list
          .map((it) => {
            const g = plan.done[it.id];
            return `<li data-action="${P}-open" data-id="${esc(it.id)}">
              <span class="tick ${g ? (g === "again" ? "again" : "ok") : ""}">${g ? (g === "again" ? "↻" : "✓") : ""}</span>
              <span class="pw">${it.kind === "formula" ? "📐 " : ""}${esc(it.q.length > 70 ? `${it.q.slice(0, 68)}…` : it.q)}<span class="muted small block">${SUBJECT_ICON(it.subject)} ${esc(it.topic)}</span></span>
              <span class="badge ${stage(it)}">${STAGE_LABEL[stage(it)]}</span>
            </li>`;
          })
          .join("")}</ul>
        <button class="btn primary block" type="button" data-action="${P}-start-session">${done === 0 ? "▶ Start revision" : done < list.length ? "▶ Continue" : "↻ Revise again"}</button>
        ${done && done === list.length ? `<p class="done-msg">🎉 Done for today! Try a quick <a href="#" data-nav="${P}-practice">practice</a>.</p>` : ""}
      </article>
      ${
        stale.length
          ? `<article class="card">
              <h3>🕒 Not revised for a while</h3>
              <p class="muted small">${stale.map((k) => esc(k)).join("<br />")}</p>
              <button class="btn small" type="button" data-action="${P}-practise-keys" data-keys="${esc(stale.join("|"))}">Practise these topics</button>
            </article>`
          : ""
      }`;
  }

  // ---------- Add ----------
  const variantsToggle = () =>
    `<label class="toggle"><input type="checkbox" data-${P}pref="variants" ${prefs().variants ? "checked" : ""} /> Add 2 practice questions of the same type to every question</label>`;

  function viewAdd() {
    if (gui.busy) return `<section class="card center busy"><div class="spinner" aria-hidden="true"></div><p>${esc(gui.busy)}</p></section>`;
    if (gui.candidates) return viewCandidates();
    const ai = hasAI(settings());
    return `
      <h1>Add ${part.title.toLowerCase()} notes</h1>
      <p class="mode ${ai ? "on" : "off"}">${
        ai
          ? "🤖 <b>AI mode</b> — questions and formulas are read from your photos and handwritten PDFs, solved step by step, filed by topic and question type, and given a short trick."
          : `🆓 <b>Free mode</b> — typed questions and formula lines are read and filed by keywords. For photos and handwritten notes use <b>💬 Gemini app</b> below, or <a href="#" data-nav="settings">add a free Gemini key</a>.`
      }</p>
      ${ai ? keyPicker() : ""}
      ${variantsToggle()}
      <div class="add-grid">
        <label class="add-tile">
          <input type="file" accept="image/*" capture="environment" data-input="${P}-files" hidden />
          <span class="big-ico">📷</span><b>Scan a page</b><span>Notes, book, class board</span>
        </label>
        <label class="add-tile">
          <input type="file" accept="image/*,application/pdf,.pdf" multiple data-input="${P}-files" hidden />
          <span class="big-ico">🗒️</span><b>Upload photo / PDF</b><span>Handwritten scanned PDFs work too</span>
        </label>
        <label class="add-tile wide">
          <input type="file" accept="image/*,application/pdf,.pdf" multiple data-input="${P}-chat-files" hidden />
          <span class="big-ico">💬</span><b>Photo / PDF → Gemini or ChatGPT app</b><span>Get a ready prompt, ask the app, paste its answer here</span>
        </label>
      </div>
      ${chatPanel()}
      ${topicCard(ai)}
      <article class="card" id="${P}PasteCard">
        <h3>✍️ Type or paste${gui.copied ? " — paste the AI's answer here" : ""}</h3>
        ${
          gui.copied
            ? `<p class="tip"><strong>Next step</strong>${
                gui.copied === "files" ? "In Gemini or ChatGPT, attach the same photo / PDF, paste the prompt and send." : "Paste the prompt in Gemini or ChatGPT and send."
              } Then copy its <b>whole</b> answer, paste it below and tap the button. Questions, practice questions and formulas are read with their topic, type, solution and trick.</p>`
            : ""
        }
        <p class="muted small">Formats: <code>Q: … A: …</code> (an AI's answer from the copied prompt, with <code>TYPE:</code>, <code>S:</code>, <code>F:</code>,
        <code>T:</code>, <code>PQ:</code> and <code>FORMULA:</code> lines) · numbered MCQs with <code>Ans:</code> · formula lines like
        <code>Speed = Distance / Time</code>${ai ? " · plain notes (AI finds the questions and formulas) · or one topic name for a full set" : ""}.</p>
        <textarea id="${P}Typed" rows="7" placeholder="Q: A can do a work in 10 days and B in 15 days. Together?&#10;A: 6 days&#10;&#10;Average speed = 2xy/(x + y)">${esc(gui.typedDraft)}</textarea>
        <button class="btn primary block" type="button" data-action="${P}-typed">Check & prepare</button>
      </article>
      <p class="muted small">Anything you already have is recognised and never added twice. Practice questions stay linked to their question.</p>`;
  }

  function topicCard(ai) {
    return `
      <article class="card">
        <h3>💡 Formulas & questions on a topic</h3>
        <p class="muted small">Write a topic — every important formula and shortcut gets a card, and every common question type gets solved questions.</p>
        <input id="${P}Topic" type="text" placeholder="${esc(part.examples)}" value="${esc(gui.topicDraft)}" />
        <label class="field">How many
          <select id="${P}Count">${COUNT_CHOICES.map(([v, l]) => `<option value="${v}" ${gui.topicCount === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        </label>
        <div class="stack">
          ${ai ? `<button class="btn primary block" type="button" data-action="${P}-topic-make">🤖 Make them here</button>` : ""}
          <button class="btn block" type="button" data-action="${P}-copy-topic">📋 Copy prompt for Gemini / ChatGPT</button>
        </div>
      </article>`;
  }

  // ---------- the chat-app route (copy a prompt, paste the answer) ----------
  const canShareFiles = (files) => {
    try {
      return Boolean(files?.length && navigator.canShare?.({ files }));
    } catch {
      return false;
    }
  };

  function chatPanel() {
    const files = gui.chatFiles;
    if (!files?.length) return "";
    const share = canShareFiles(files);
    return `
      <article class="card chat-panel" id="${P}ChatPanel">
        <div class="row between"><h3>💬 Ask Gemini about ${files.length > 1 ? `these ${files.length} files` : "this file"}</h3>
          <button class="icon-btn" type="button" data-action="${P}-chat-close" aria-label="Close">✕</button></div>
        <ul class="chat-files">${files
          .map((f, i) => `<li>${f.type.startsWith("image/") ? `<img src="${esc(gui.chatThumbs?.[i] || "")}" alt="" />` : "📄"}<span>${esc(f.name)}</span></li>`)
          .join("")}</ul>
        <p class="muted small">The prompt asks for every question (solved) and every formula or shortcut in your notes${prefs().variants ? ", plus 2 practice questions for each question" : ""} — handwriting too.</p>
        <ol class="steps small">
          <li>${share ? "Tap <b>Share to Gemini</b> and pick the Gemini (or ChatGPT) app — the file and the prompt go together." : "Tap <b>Copy prompt</b>, open Gemini or ChatGPT and attach the same photo / PDF (📎 or ＋)."}</li>
          <li>${share ? "If the prompt didn't come along, paste it (it is also copied)." : "Paste the prompt and send."}</li>
          <li>Copy the app's <b>whole</b> answer and paste it in the box below, then tap <b>Check & prepare</b>.</li>
        </ol>
        <div class="stack">
          ${share ? `<button class="btn primary block" type="button" data-action="${P}-chat-share">📤 Share file + prompt to Gemini</button>` : ""}
          <button class="btn ${share ? "" : "primary "}block" type="button" data-action="${P}-chat-copy">📋 Copy prompt</button>
        </div>
        <p class="muted small">Open <a href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a> ·
          <a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a></p>
      </article>`;
  }

  function openChatPanel(files) {
    for (const u of gui.chatThumbs || []) URL.revokeObjectURL(u);
    gui.chatFiles = files;
    gui.chatThumbs = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
    gui.candidates = null;
    gui.copied = false;
    if (view() !== `${P}-add`) go(`${P}-add`);
    else render();
    $(`#${P}ChatPanel`)?.scrollIntoView({ block: "start" });
  }

  function closeChatPanel() {
    for (const u of gui.chatThumbs || []) URL.revokeObjectURL(u);
    gui.chatFiles = null;
    gui.chatThumbs = null;
    render();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function showPromptToCopy(text) {
    openOverlay(`
      <div class="sheet-bar"><h3>Copy this prompt</h3><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      <p class="muted small">Press and hold in the box → Select all → Copy. Then paste it in Gemini or ChatGPT.</p>
      <textarea id="${P}PromptText" rows="14" readonly>${esc(text)}</textarea>`);
    $(`#${P}PromptText`)?.select();
  }

  async function copyAndGuide(text, what, message) {
    gui.copied = what;
    if (await copyText(text)) {
      toast(message, 6000);
      if (view() !== `${P}-add`) go(`${P}-add`);
      else render();
      $(`#${P}PasteCard`)?.scrollIntoView({ block: "start" });
    } else showPromptToCopy(text);
  }

  const promptOpts = () => ({ variants: prefs().variants, patterns: qs.patternsByTopic() });

  async function chatShare() {
    const text = buildQuantMaterialPrompt({ files: gui.chatFiles || [], ...promptOpts() });
    await copyText(text);
    gui.copied = "files";
    try {
      await navigator.share({ files: gui.chatFiles || [], text, title: "Maths & reasoning notes" });
      toast("Now copy Gemini's whole answer and paste it here", 6000);
    } catch (e) {
      if (e?.name !== "AbortError") toast("Sharing didn't work here — use Copy prompt and attach the file yourself.", 6000);
    }
    render();
    $(`#${P}PasteCard`)?.scrollIntoView({ block: "start" });
  }

  // ---------- review before saving ----------
  const topicOptions = (it) => {
    const cur = `${it.subject}|${it.topic}`;
    return ALL_QTOPICS.map((t) => `<option value="${esc(`${t.subject}|${t.topic}`)}" ${`${t.subject}|${t.topic}` === cur ? "selected" : ""}>${esc(`${t.subject} › ${t.topic}`)}</option>`).join("");
  };
  const patternList = () =>
    `<datalist id="${P}Patterns">${[...new Set(Object.values(qs.patternsByTopic()).flat())].map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist>`;

  const subjectOf = (it) => makeQItem(it).subject;

  function viewCandidates() {
    const c = gui.candidates;
    const n = c.items.filter((r) => r.selected).length;
    const counts = { formula: 0, question: 0, practice: 0 };
    for (const r of c.items) counts[r.item.kind === "formula" ? "formula" : r.item.variantOf ? "practice" : "question"] += 1;
    return `
      <div class="row between"><h1>Review</h1><button class="btn small ghost" type="button" data-action="${P}-cancel">Cancel</button></div>
      <p class="muted">${plural(counts.question, "question")}, ${plural(counts.practice, "practice question")} and ${plural(counts.formula, "formula card")} found.
      Untick any you don't want; change a topic or type if needed.</p>
      ${aiBanner(c.ai)}
      ${c.skipped.length ? `<p class="muted small">Already saved (skipped): ${plural(c.skipped.length, "item")}.</p>` : ""}
      ${
        c.fromFiles && gui.lastFiles?.length
          ? `<p class="small"><button class="btn small" type="button" data-action="${P}-chat-last">💬 Missed something? Ask the Gemini app about this file instead</button></p>`
          : ""
      }
      ${patternList()}
      <ul class="cand-list gk-cands q-cands">
        ${c.items
          .map((row, i) => {
            const it = row.item;
            return `<li class="cand new ${it.variantOf ? "variant" : ""}">
              <label>
                <input type="checkbox" data-${P}cand="${i}" ${row.selected ? "checked" : ""} />
                <span class="cand-body cand-main">
                  <span>${it.kind === "formula" ? `<span class="badge formula">📐 Formula</span>` : it.variantOf ? `<span class="badge learning">🔁 Practice</span>` : ""}${
                    subjectOf(it) !== part.subject ? ` <span class="badge bank" title="This belongs to the other part and will be saved there">→ ${esc(part.otherTitle)}</span>` : ""
                  }</span>
                  <b>${lines(it.q.length > 300 ? `${it.q.slice(0, 298)}…` : it.q)}</b>
                  ${figureBlock(it, { small: true })}
                  ${
                    it.kind === "formula"
                      ? `<span class="small">${lines(it.formula || "(no formula)")}</span>`
                      : `<span>✓ ${esc(it.a || "—")}${it.aiAnswered ? ` <span class="badge learning">AI answer · check</span>` : ""}</span>`
                  }
                  ${it.trick ? `<span class="small muted">💡 ${esc(it.trick.split("\n")[0])}</span>` : ""}
                </span>
              </label>
              ${
                it.variantOf
                  ? ""
                  : `<div class="cand-topic">
                      <select data-${P}topic="${i}" aria-label="Topic">${topicOptions(it)}</select>
                      <input type="text" data-${P}type="${i}" value="${esc(it.pattern)}" placeholder="Question type" list="${P}Patterns" aria-label="Question type" />
                    </div>`
              }
            </li>`;
          })
          .join("")}
      </ul>
      <div class="sticky-actions"><button class="btn primary block" type="button" data-action="${P}-add-selected" ${n ? "" : "disabled"}>Add ${plural(n, "card")}</button></div>`;
  }

  function showCandidates(items, ai, fromFiles = false) {
    const saved = qs.liveItems();
    const rows = [];
    const skipped = [];
    const hidden = []; // already saved; still passed to addItems so new practice questions join the saved question
    for (const it of items) {
      if (findSaved(it, saved)) {
        skipped.push(it.q);
        hidden.push(it);
        continue;
      }
      rows.push({ item: it, selected: true });
    }
    if (!rows.length && hidden.length) {
      // Everything is saved already — but the paste may bring what a saved card lacks (e.g. a figure from "Prompt for a figure").
      const { filled } = qs.addItems(hidden);
      if (filled.length) {
        gui.candidates = null;
        gui.copied = false;
        gui.typedDraft = "";
        const what = filled.some((f) => f.fill.figure) ? "figure" : "details";
        toast(`Added the ${what} to ${plural(filled.length, "saved card")} ✓`, 6000);
        ctx.afterChange();
        if (filled.length === 1) setTimeout(() => showItem(filled[0].id), 50);
        return;
      }
    }
    if (!rows.length) {
      if (!skipped.length && fromFiles && gui.lastFiles?.length) {
        toast("Nothing found in this file here — ask the Gemini app about it instead.", 7000);
        return openChatPanel(gui.lastFiles);
      }
      gui.candidates = null;
      toast(skipped.length ? `All ${plural(skipped.length, "item")} are already saved ✓` : "Nothing found. Try a clearer photo, or type it.", 6000);
      return;
    }
    gui.candidates = { items: rows, skipped, hidden, ai, fromFiles };
  }
  const findSaved = (it, saved) => saved.some((s) => s.kind === it.kind && s.q.trim().toLowerCase() === it.q.trim().toLowerCase() && (it.kind === "formula" || s.a === it.a));

  // ---------- adding ----------
  async function handleFiles(files) {
    if (!files.length) return;
    const s = settings();
    const source = files.map((f) => f.name).join(", ").slice(0, 120);
    gui.lastFiles = files;
    setBusy("Preparing your files…");
    let ai = null;
    try {
      let items = null;
      if (hasAI(s)) {
        try {
          const res = await quantFromFiles(s, await filesToSources(files), source, promptOpts(), setBusy);
          ai = res;
          items = res.items;
        } catch (e) {
          if (!(e instanceof AllProvidersFailed)) throw e;
          ai = { usedBy: [], notes: [e.message], failed: 0 };
        }
      }
      if (!items) {
        const text = await filesToText(files, setBusy);
        items = readNotes(text, source).map((x) => ({ ...x }));
      }
      gui.busy = null;
      showCandidates(items.map((x) => (x.id ? x : { ...x })), ai, true);
    } catch (e) {
      gui.busy = null;
      toast(`${e.message || e} — you can ask the Gemini app about this file instead.`, 7000);
      return openChatPanel(files);
    }
    if (view() === `${P}-add`) render();
  }

  async function handleTyped() {
    const text = $(`#${P}Typed`)?.value ?? "";
    gui.typedDraft = text;
    if (!text.trim()) return toast("Type or paste something first.");
    const s = settings();
    setBusy("Preparing…");
    let ai = null;
    try {
      let items = null;
      if (hasAI(s)) {
        try {
          const res = await quantFromText(s, text, promptOpts(), setBusy);
          ai = res;
          items = res.items;
        } catch (e) {
          if (!(e instanceof AllProvidersFailed)) throw e;
          ai = { usedBy: [], notes: [e.message], failed: 0 };
        }
      }
      if (!items && isQTopicLike(text)) {
        gui.busy = null;
        gui.topicDraft = text.trim();
        toast("That looks like a topic. Tap “📋 Copy prompt” in the topic card and paste it in Gemini or ChatGPT.", 8000);
        if (view() === `${P}-add`) render();
        return;
      }
      items ??= looksQuantStructured(text) ? readPastedQ(text) : readNotes(text, "Typed");
      gui.busy = null;
      if (gui.copied && items.length) {
        gui.copied = false;
        if (gui.chatFiles) closeChatPanel();
      }
      showCandidates(items, ai);
    } catch (e) {
      gui.busy = null;
      toast(e.message || String(e), 6000);
    }
    if (view() === `${P}-add`) render();
  }

  async function handleTopic() {
    const topic = ($(`#${P}Topic`)?.value ?? gui.topicDraft).trim();
    gui.topicDraft = topic;
    if (!topic) return toast("Write a topic first (e.g. Time and Work).");
    setBusy(`Planning “${topic.slice(0, 60)}”…`);
    try {
      const res = await quantFromTopic(settings(), topic, gui.topicCount, promptOpts(), setBusy);
      gui.busy = null;
      showCandidates(res.items, res);
    } catch (e) {
      gui.busy = null;
      toast(e instanceof AllProvidersFailed ? `The AI couldn't do this right now: ${e.message}. Try “Copy prompt” instead.` : e.message || String(e), 8000);
    }
    if (view() === `${P}-add`) render();
  }

  // ---------- Practice ----------
  function pickerNode(key, tree, counts, depth) {
    const ex = prefs().excluded;
    const state = nodeState(key, ex);
    const kids = depth === 0 ? tree.get(key) || [] : [];
    const open = gui.pickerOpen.has(key);
    const n = counts.get(key)?.total || 0;
    const label = depth === 0 ? `${SUBJECT_ICON(key)} ${key}` : labelOf(key);
    return `<li class="pick ${state}">
      <div class="pick-row">
        <button type="button" class="pick-box ${state}" data-action="${P}-toggle-topic" data-key="${esc(key)}" aria-label="${state === "off" ? "Include" : "Leave out"} ${esc(label)}">${
          state === "on" ? "☑" : state === "some" ? "◩" : "☐"
        }</button>
        <span class="pick-label">${esc(label)} <span class="muted small">(${n})</span></span>
        ${kids.length ? `<button type="button" class="icon-btn small" data-action="${P}-expand" data-key="${esc(key)}" aria-label="Show topics">${open ? "▾" : "▸"}</button>` : ""}
      </div>
      ${open && kids.length ? `<ul>${kids.map((k) => pickerNode(k, tree, counts, depth + 1)).join("")}</ul>` : ""}
    </li>`;
  }

  function typesCard(all) {
    const groups = new Map();
    for (const it of all) {
      if (it.kind !== "question" || !it.pattern) continue;
      const k = qPatternKey(it);
      groups.set(k, (groups.get(k) || 0) + 1);
    }
    if (!groups.size) return "";
    const byTopic = new Map();
    for (const [k, n] of groups) {
      const t = k.split(SEP).slice(0, 2).join(SEP);
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t).push([k, n]);
    }
    return `
      <article class="card">
        <h3>🧩 Practise one question type</h3>
        <p class="muted small">Same-type questions together: each question, then its practice questions.</p>
        ${[...byTopic]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([t, list]) => `<p class="small"><b>${esc(t.split(SEP)[1])}</b></p>
              <div class="row wrap">${list
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => `<button class="btn small" type="button" data-action="${P}-practise-type" data-key="${esc(k)}">${esc(labelOf(k))} (${n})</button>`)
                .join("")}</div>`,
          )
          .join("")}
      </article>`;
  }

  function viewPractice() {
    if (gui.quiz) return viewQuiz();
    const p = prefs();
    const source = p.practiceSource;
    const all = qs.itemsFor(source);
    const pool = qs.itemsFor(source, { forPractice: true });
    const tree = qs.qBuildTree(all, { withTypes: false });
    const counts = qs.qTopicTree(all);
    const cov = coverage(pool, qs.get().practice, source);
    const weak = weakWords(pool, qs.get().practice);
    const pct = cov.total ? Math.round((cov.covered / cov.total) * 100) : 0;
    return `
      <h1>${part.title} practice</h1>
      <p class="muted">Every selected card is asked once per round, topics take turns, and wrong answers come back until you get them right twice in a row.</p>
      <article class="card">
        <label class="field">Practise from ${sourceSelect("practiceSource", source)}</label>
        <p class="small">Round ${cov.round}: <b>${cov.covered}</b> of ${cov.total} cards covered${weak.length ? ` · ⚠️ ${plural(weak.length, "weak card")}` : ""}</p>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <label class="field">Questions per session
          <select data-${P}pref="practiceSize">${[10, 15, 20, 30].map((n) => `<option value="${n}" ${Number(p.practiceSize) === n ? "selected" : ""}>${n}</option>`).join("")}</select>
        </label>
      </article>
      <article class="card">
        <div class="row between"><h3>Topics</h3><span class="muted small">${pool.length} of ${all.length} selected</span></div>
        <div class="row wrap">
          <button class="btn small" type="button" data-action="${P}-topics-all">Select all</button>
          <button class="btn small" type="button" data-action="${P}-topics-none">Clear all</button>
        </div>
        <ul class="picker">${(tree.get(part.subject) || []).map((k) => pickerNode(k, tree, counts, 1)).join("")}</ul>
        <label class="toggle"><input type="checkbox" data-${P}pref="excludeToday" ${p.excludeToday ? "checked" : ""} /> Use the same topics for Today's revision</label>
      </article>
      ${
        pool.length
          ? `<div class="quiz-grid">${QUANT_KINDS.map(
              ([k, ico, t, d]) => `<button class="quiz-tile" type="button" data-action="${P}-start-quiz" data-kind="${k}"><span class="big-ico">${ico}</span><b>${t}</b><span>${d}</span></button>`,
            ).join("")}</div>
            ${weak.length ? `<button class="btn block" type="button" data-action="${P}-start-quiz" data-kind="mixed" data-weak="1">🎯 Fix my ${plural(weak.length, "weak card")}</button>` : ""}`
          : `<p class="muted center">Select at least one topic to practise.</p>`
      }
      ${typesCard(all)}`;
  }

  /** Start a session. `keys`: topic keys to practise; `typeKey`: one question type, in order (question, its practice questions…). */
  function startQuiz(kind, { weakOnly = false, keys = null, typeKey = null } = {}) {
    const p = prefs();
    const source = p.practiceSource;
    const under = (it, k) => qPatternKey(it) === k || qPatternKey(it).startsWith(k + SEP);
    let pool = typeKey
      ? qs.itemsOfPattern(typeKey, source)
      : keys
        ? qs.itemsFor(source).filter((i) => keys.some((k) => under(i, k)))
        : qs.itemsFor(source, { forPractice: true });
    pool = pool.filter((i) => kindAccepts(kind, i));
    let ids;
    if (typeKey) ids = pool.filter((i) => i.kind === "question").map((i) => i.id);
    else if (weakOnly) ids = weakWords(pool, qs.get().practice).map((i) => i.id).slice(0, Number(p.practiceSize));
    else {
      const byId = new Map(pool.map((i) => [i.id, i]));
      ids = pickSession(pool, qs.get().practice, source, Number(p.practiceSize) || 15, Math.random, (id) => qTopicKey(byId.get(id))).ids;
    }
    if (!ids.length) return toast(kind === "formula" ? "No formula cards here yet." : "Nothing to practise here yet.");
    const full = typeKey ? qs.itemsFor(source) : pool;
    gui.quiz = { kind, source, queue: ids, i: 0, picked: null, revealed: false, score: 0, answered: 0, wrong: [], requeued: new Set(), pool: full, title: typeKey ? labelOf(typeKey) : "" };
    gui.quiz.current = questionFor(gui.quiz, false);
    if (view() !== `${P}-practice`) go(`${P}-practice`);
    else render();
    window.scrollTo(0, 0);
  }

  function questionFor(q, retry) {
    const it = qs.byId(q.queue[q.i]) || q.pool.find((x) => x.id === q.queue[q.i]);
    return it ? { ...makeQuantQuestion(it, q.kind, q.pool), retry } : null;
  }

  function viewQuiz() {
    const q = gui.quiz;
    if (q.i >= q.queue.length || !q.current) {
      const wrong = [...new Set(q.wrong)].map(qs.byId).filter(Boolean);
      const cov = coverage(q.pool, qs.get().practice, q.source);
      return `
        <article class="card center">
          <p class="eyebrow">${q.title ? `${esc(q.title)} · ` : ""}Session complete</p>
          <p class="score">${q.score}/${q.answered}</p>
          <p>${q.answered && q.score === q.answered ? "Perfect! 🏆" : q.score >= q.answered * 0.7 ? "Great work 💪" : "Keep going — the weak ones will come back 📈"}</p>
          ${q.title ? "" : `<p class="small muted">Round ${cov.round}: ${cov.covered} of ${cov.total} cards covered</p>`}
          ${wrong.length ? `<p class="muted">Will come back: ${wrong.map((i) => `<a href="#" data-action="${P}-info" data-id="${esc(i.id)}">${esc(i.q.slice(0, 50))} ⓘ</a>`).join("; ")}</p>` : ""}
          <div class="row center">
            ${q.title ? "" : `<button class="btn primary" type="button" data-action="${P}-start-quiz" data-kind="${q.kind}">Next session</button>`}
            <button class="btn" type="button" data-action="${P}-end-quiz">Done</button>
          </div>
        </article>`;
    }
    const cur = q.current;
    const it = qs.byId(cur.itemId) || q.pool.find((x) => x.id === cur.itemId);
    const answered = q.picked != null;
    const hidden = cur.selfGraded && !q.revealed;
    return `
      <div class="row between">
        <span class="muted">${q.title ? `${esc(q.title)} · ` : ""}${q.i + 1} of ${q.queue.length}</span>
        <button class="btn small ghost" type="button" data-action="${P}-end-quiz">Finish</button>
      </div>
      <div class="progress"><span style="width:${(q.i / q.queue.length) * 100}%"></span></div>
      <article class="card quiz-card">
        <p class="eyebrow">${esc(cur.label)}${cur.retry ? ` <span class="badge learning">again</span>` : ""}</p>
        ${it ? `<p class="small muted">${SUBJECT_ICON(it.subject)} ${esc(it.topic)}${it.pattern ? ` · ${esc(it.pattern)}` : ""}</p>` : ""}
        <div class="quiz-prompt q-prompt">${lines(cur.prompt)}</div>
        ${it ? figureBlock(it) : ""}
        ${
          hidden
            ? `<p class="muted center">${cur.kind === "recall" ? "Say or write the formula, then check." : "Solve it on paper, then check."}</p>
               <button class="btn primary block" type="button" data-action="${P}-reveal">${cur.kind === "recall" ? "Show the formula" : "Show answer & solution"}</button>`
            : `${cur.selfGraded ? `<div class="formula-box center">${lines(cur.reveal)}</div>` : ""}
               <div class="options ${cur.options.length === 2 ? "two" : ""}">
                ${cur.options
                  .map((o, i) => {
                    let cls = "";
                    if (answered) cls = cur.selfGraded ? (i === q.picked ? (i === 0 ? "correct" : "wrong") : "dim") : i === cur.answer ? "correct" : i === q.picked ? "wrong" : "dim";
                    return `<button class="option ${cls}" type="button" data-action="${P}-pick" data-i="${i}" ${answered ? "disabled" : ""}>${lines(o)}</button>`;
                  })
                  .join("")}
              </div>`
        }
        ${
          (answered || (cur.selfGraded && q.revealed)) && it
            ? `<div class="explain g-explain ${answered ? (q.lastCorrect ? "ok" : "bad") : ""}">
                 <div class="explain-text">
                   ${it.kind === "question" && answered && !cur.selfGraded ? `<p class="small"><b>${q.lastCorrect ? "✓ Right" : `✗ The answer is ${esc(it.a)}`}</b></p>` : ""}
                   ${it.kind === "question" && it.solution ? `<p class="small"><b>Solution</b><br />${lines(it.solution)}</p>` : ""}
                   ${it.formula && it.kind === "question" ? `<p class="small">📐 ${lines(it.formula)}</p>` : ""}
                   ${it.trick ? `<p class="small">💡 <b>Trick:</b> ${lines(it.trick)}</p>` : ""}
                   ${it.kind === "formula" && it.solution ? `<p class="small"><b>Example:</b> ${lines(it.solution)}</p>` : ""}
                 </div>
                 ${infoBtn(it.id)}
               </div>
               ${answered ? `<button class="btn primary block" type="button" data-action="${P}-next">${q.i + 1 < q.queue.length ? "Next →" : "See score"}</button>` : ""}`
            : ""
        }
      </article>`;
  }

  // ---------- Topics ----------
  function nodeStats(n) {
    if (!n) return "";
    const pct = (x) => Math.round((x / n.total) * 100);
    return `<span class="cov">
      <span class="bar"><span class="seen" style="width:${pct(n.covered)}%"></span><span class="mast" style="width:${pct(n.mastered)}%"></span></span>
      <span class="muted small">${n.questions ? plural(n.questions, "question") : ""}${n.questions && n.formulas ? " · " : ""}${n.formulas ? plural(n.formulas, "formula") : ""} · ${pct(n.covered)}% this round · ${n.mastered} mastered${n.weak ? ` · ⚠️ ${n.weak}` : ""}${n.due ? ` · ${n.due} due` : ""}</span>
    </span>`;
  }

  const listOf = (items) =>
    items.length
      ? `<ul class="word-list rule-list">${items
          .slice(0, LIST_SHOWN)
          .map(
            (it) => `<li data-action="${P}-open" data-id="${esc(it.id)}" class="${it.variantOf ? "variant" : ""}">
              <div><b>${it.kind === "formula" ? "📐 " : it.variantOf ? "🔁 " : ""}${esc(it.q.length > 120 ? `${it.q.slice(0, 118)}…` : it.q)}</b><span class="muted small block">${
                it.kind === "formula" ? esc((it.formula || "").split("\n")[0].slice(0, 90)) : `✓ ${esc(it.a)}`
              }</span></div>
              <span class="badge ${stage(it)}">${STAGE_LABEL[stage(it)]}</span>
            </li>`,
          )
          .join("")}</ul>${items.length > LIST_SHOWN ? `<p class="muted small center">Showing ${LIST_SHOWN} of ${items.length}. Search to narrow down.</p>` : ""}`
      : `<p class="muted center">Nothing here yet.</p>`;

  function formulaSheet(items) {
    const f = items.filter((i) => i.kind === "formula");
    if (!f.length) return "";
    return `<article class="card">
      <div class="row between"><h3>📐 Formulas & tricks (${f.length})</h3>
        <button class="btn small" type="button" data-action="${P}-revise-formulas" data-key="${esc(gui.browse)}">Revise</button></div>
      <ul class="formula-sheet">${f
        .map(
          (it) => `<li data-action="${P}-open" data-id="${esc(it.id)}">
            <b>${esc(it.q)}</b>${figureBlock(it, { small: true })}${it.formula ? `<div class="formula-box">${lines(it.formula)}</div>` : ""}${it.trick ? `<span class="small muted">💡 ${lines(it.trick)}</span>` : ""}
          </li>`,
        )
        .join("")}</ul>
    </article>`;
  }

  function viewTopics() {
    const src = gui.tab === "mine" ? "mine" : gui.tab === "book" ? "book" : "mixed";
    const all = qs.itemsFor(src);
    const term = gui.search.trim().toLowerCase();
    const tabs = `<div class="seg" role="tablist">
      ${[
        ["all", `All (${qs.itemsFor("mixed").length})`],
        ["mine", `Mine (${qs.liveItems().length})`],
        ["book", `Formulas (${qs.bookItems().length})`],
      ]
        .map(([k, l]) => `<button type="button" class="${gui.tab === k ? "active" : ""}" data-action="${P}-tab" data-tab="${k}">${l}</button>`)
        .join("")}
    </div>`;
    const search = `<input type="search" id="${P}Search" placeholder="Search questions, formulas and tricks" value="${esc(gui.search)}" autocomplete="off" />`;
    if (term) {
      const hits = all.filter((i) => `${i.q} ${i.a} ${i.formula} ${i.trick} ${i.topic} ${i.pattern}`.toLowerCase().includes(term));
      return `${tabs}<h1>Topics</h1>${search}<p class="muted small">${hits.length} match${hits.length === 1 ? "" : "es"}</p>${listOf(hits)}`;
    }
    // The part's subject is the root: its topics, then a topic's formulas and question types, then one type.
    const node = gui.browse || part.subject;
    const isRoot = node === part.subject;
    const depth = node.split(SEP).length; // 1 the part's topics, 2 a topic, 3 a question type
    const tree = qs.qBuildTree(all);
    const counts = qs.qTopicTree(all);
    const here = node ? all.filter((i) => qPatternKey(i) === node || qPatternKey(i).startsWith(node + SEP)) : all;
    const crumbs = isRoot
      ? ""
      : `<p class="crumbs"><a href="#" data-action="${P}-browse" data-key="">All topics</a>${node
          .split(SEP)
          .slice(1)
          .map((_, i, a) => ` › <a href="#" data-action="${P}-browse" data-key="${esc([part.subject, ...a.slice(0, i + 1)].join(SEP))}">${esc(a[i])}</a>`)
          .join("")}</p>`;
    const head = `${tabs}
      <div class="row between"><h1>${isRoot ? "Topics" : esc(labelOf(node))}</h1><button class="btn small" type="button" data-action="${P}-new">＋ New</button></div>
      ${search}${crumbs}`;
    if (depth < 2) {
      const kids = tree.get(node) || [];
      return `${head}
        <p class="muted small">Coverage — light: practised this round, dark: mastered.</p>
        ${
          kids.length
            ? `<ul class="topic-list">${kids
                .map(
                  (k) => `<li data-action="${P}-browse" data-key="${esc(k)}">
                    <span class="t-name">${esc(labelOf(k))}</span>${nodeStats(counts.get(k))}<span class="home-go" aria-hidden="true">›</span>
                  </li>`,
                )
                .join("")}</ul>`
            : `<p class="muted center">Nothing here yet.</p>`
        }
        ${kids.length ? `<button class="btn small block" type="button" data-action="${P}-practise-keys" data-keys="${esc(node)}">🎯 Practise all ${esc(part.title)}</button>` : ""}
        ${qs.liveItems().length ? `<div class="row wrap center"><button class="btn small" type="button" data-action="${P}-export-csv">⬇ My notes as CSV (Excel)</button></div>` : ""}`;
    }
    if (depth === 2) {
      // A topic: its formula sheet, then its question types.
      const types = (tree.get(node) || []).filter((k) => here.some((i) => i.kind === "question" && qPatternKey(i) === k));
      return `${head}
        ${formulaSheet(here)}
        ${
          types.length
            ? `<article class="card"><h3>🧩 Question types</h3>
                <ul class="topic-list">${types
                  .map(
                    (k) => `<li data-action="${P}-browse" data-key="${esc(k)}">
                      <span class="t-name">${esc(labelOf(k))}</span>${nodeStats(counts.get(k))}<span class="home-go" aria-hidden="true">›</span>
                    </li>`,
                  )
                  .join("")}</ul></article>`
            : here.some((i) => i.kind === "question")
              ? ""
              : `<p class="muted small center">No questions in this topic yet.</p>`
        }
        <button class="btn small block" type="button" data-action="${P}-practise-keys" data-keys="${esc(node)}">🎯 Practise ${esc(labelOf(node))}</button>`;
    }
    // A question type: its questions (each followed by its practice questions) and formula cards.
    const list = qs.itemsOfPattern(node, src);
    const nq = list.filter((i) => i.kind === "question").length;
    return `${head}
      ${nq ? `<button class="btn primary block" type="button" data-action="${P}-practise-type" data-key="${esc(node)}">🎯 Practise this type (${plural(nq, "question")})</button>` : ""}
      ${listOf(list.filter((i) => i.kind === "question"))}
      ${formulaSheet(list)}`;
  }

  // ---------- detail, info, editor ----------
  function progressLine(it) {
    const next = stage(it) === "new" ? "not started" : new Date(`${it.due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const weak = qs.get().practice.weak[it.id];
    return `<p class="muted small">Next revision: ${esc(next)} · Revised ${plural(it.reviews, "time")}${
      weak ? ` · Practice: ${weak.right} right, ${weak.wrong} wrong${weak.need ? " (still weak)" : ""}` : ""
    }${it.source ? ` · ${esc(it.source)}` : ""}</p>`;
  }

  function linkedLine(it) {
    if (it.kind !== "question") return "";
    if (it.variantOf) {
      const o = qs.byId(it.variantOf);
      return o ? `<p class="small">🔁 Practice question of: <a href="#" data-action="${P}-open" data-id="${esc(o.id)}">${esc(o.q.slice(0, 80))}</a></p>` : "";
    }
    const vs = qs.variantsOf(it.id);
    return vs.length
      ? `<p class="small"><b>Practice questions:</b></p><ul class="small">${vs.map((v) => `<li><a href="#" data-action="${P}-open" data-id="${esc(v.id)}">${esc(v.q.slice(0, 90))}</a></li>`).join("")}</ul>`
      : "";
  }

  function showItem(id) {
    const it = qs.byId(id);
    if (!it) return toast("That card is no longer saved.");
    const ai = hasAI(settings());
    openOverlay(`
      <div class="sheet-bar"><span class="badge ${stage(it)}">${STAGE_LABEL[stage(it)]}</span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      ${itemHead(it)}
      ${itemBody(it)}
      ${linkedLine(it)}
      ${progressLine(it)}
      <div class="row wrap">
        <button class="btn small" type="button" data-action="${P}-star" data-id="${esc(it.id)}">${it.starred ? "★ Unstar" : "☆ Star"}</button>
        ${
          it.book
            ? `<button class="btn small primary" type="button" data-action="${P}-add-book" data-id="${esc(it.id)}">＋ Add to my notes</button>`
            : `<button class="btn small" type="button" data-action="${P}-edit" data-id="${esc(it.id)}">✎ Edit</button>
               ${
                 it.kind === "question" && !it.variantOf
                   ? `${ai ? `<button class="btn small" type="button" data-action="${P}-more-practice" data-id="${esc(it.id)}">🤖 ＋2 practice questions</button>` : ""}
                      <button class="btn small" type="button" data-action="${P}-copy-similar" data-id="${esc(it.id)}">📋 Prompt for 2 more</button>`
                   : ""
               }
               ${it.pattern && it.kind === "question" ? `<button class="btn small" type="button" data-action="${P}-practise-type" data-key="${esc(qPatternKey(it))}">🧩 All of this type</button>` : ""}
               <button class="btn small danger" type="button" data-action="${P}-delete" data-id="${esc(it.id)}">Delete</button>`
        }
      </div>
      ${it.book ? "" : figureActions(it, ai)}`);
  }

  function figureActions(it, ai) {
    const has = Boolean(it.figure || it.image);
    return `<div class="fig-actions">
      <p class="small muted">${has ? "Figure" : "No figure yet — add one for geometry, mensuration or trigonometry."}</p>
      <div class="row wrap">
        ${ai ? `<button class="btn small" type="button" data-action="${P}-draw-figure" data-id="${esc(it.id)}">🤖 ${it.figure ? "Redraw" : "Draw"} figure</button>` : ""}
        <button class="btn small" type="button" data-action="${P}-copy-figure" data-id="${esc(it.id)}">📋 Prompt for a figure</button>
        <label class="btn small">📷 ${it.image ? "Change" : "Attach"} photo of the figure<input type="file" accept="image/*" data-input="${P}-fig-photo" data-id="${esc(it.id)}" hidden /></label>
        ${has ? `<button class="btn small ghost" type="button" data-action="${P}-remove-figure" data-id="${esc(it.id)}">Remove figure</button>` : ""}
      </div>
    </div>`;
  }

  /** A photo of a figure, made small enough to keep on the phone (max 640 px, JPEG). */
  async function figurePhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => bad(new Error("That photo couldn't be opened."));
        i.src = url;
      });
      for (const [max, q] of [[640, 0.62], [520, 0.55], [420, 0.5], [340, 0.45]]) {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        const g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL("image/jpeg", q);
        if (cleanImage(data)) return data;
      }
      throw new Error("That photo is too detailed to keep — crop it to just the figure and try again.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function showInfo(id) {
    const it = qs.byId(id);
    if (!it) return toast("That card is no longer saved.");
    const layer = $("#info");
    layer.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-bar"><span class="badge ${stage(it)}">${STAGE_LABEL[stage(it)]}</span>
        <button class="icon-btn" type="button" data-action="close-info" aria-label="Close">✕</button></div>
      ${itemHead(it)}${itemBody(it)}${progressLine(it)}
      <div class="row wrap"><button class="btn small" type="button" data-action="close-info">Back</button></div>
    </div>`;
    layer.classList.add("open");
  }

  function showEditor(id) {
    const it = id ? qs.byId(id) : null;
    const v = (k) => esc(it?.[k] ?? "");
    openOverlay(`
      <div class="sheet-bar"><h3>${it ? "Edit" : "New card"}</h3><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      ${patternList()}
      <form id="${P}EditForm" data-id="${esc(it?.id ?? "")}">
        <label class="field">Kind
          <select name="kind">${[["question", "❓ Question"], ["formula", "📐 Formula / trick"]].map(([k, l]) => `<option value="${k}" ${(it?.kind ?? "question") === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        </label>
        <label class="field">Question (or the formula's name)<textarea name="q" rows="3" required>${v("q")}</textarea></label>
        <label class="field">Answer (questions)<input name="a" value="${v("a")}" /></label>
        <label class="field">Wrong options (one per line)<textarea name="options" rows="3">${esc((it?.options ?? []).join("\n"))}</textarea></label>
        <label class="field">Solution steps / worked example<textarea name="solution" rows="4">${v("solution")}</textarea></label>
        <label class="field">Formula<textarea name="formula" rows="2">${v("formula")}</textarea></label>
        <label class="field">Trick / shortcut<textarea name="trick" rows="2">${v("trick")}</textarea></label>
        <label class="field">Topic<select name="topic">${topicOptions(it || { subject: part.subject, topic: part.defaultTopic })}</select></label>
        <label class="field">Question type<input name="pattern" value="${v("pattern")}" list="${P}Patterns" placeholder="e.g. Successive discounts" /></label>
        <button class="btn primary block" type="submit">Save</button>
      </form>`);
  }

  function saveEditor(form) {
    const f = new FormData(form);
    const id = form.dataset.id;
    const cur = id ? qs.byId(id) : null;
    const [subject, topic] = String(f.get("topic")).split("|");
    const input = {
      ...(cur || {}),
      kind: f.get("kind"),
      q: f.get("q"),
      a: f.get("a"),
      options: String(f.get("options") || "").split("\n").map((x) => x.trim()).filter(Boolean),
      solution: f.get("solution"),
      formula: f.get("formula"),
      trick: f.get("trick"),
      subject,
      topic,
      pattern: f.get("pattern"),
      aiAnswered: cur?.aiAnswered && f.get("a") === cur.a,
      source: cur?.source || "Typed",
    };
    if (!cur) {
      const { added, skipped } = qs.addItems([input]);
      if (!added.length) return toast(`Already saved: “${skipped[0]?.existing}”.`, 5000);
    } else qs.saveItem(input);
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
          <p>You knew <b>${known}</b> of ${vals.length}. Anything you missed comes back tomorrow.</p>
          <button class="btn primary" type="button" data-action="close">Back to Today</button></div>`);
      return;
    }
    const it = qs.byId(ss.ids[ss.i]);
    if (!it) {
      ss.i += 1;
      return renderSession();
    }
    openOverlay(
      `<div class="sheet-bar"><span class="muted">${ss.i + 1} of ${ss.ids.length}</span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      <div class="progress"><span style="width:${(ss.i / ss.ids.length) * 100}%"></span></div>
      <div class="flashcard rule-card ${ss.revealed ? "revealed" : ""}">
        ${itemHead(it)}
        ${itemBody(it, { reveal: ss.revealed })}
        ${
          ss.revealed
            ? ""
            : `<p class="muted center recall">${it.kind === "formula" ? "Say or write the formula first." : "Solve it on paper first."}</p>
               <button class="btn primary block" type="button" data-action="${P}-flip">${it.kind === "formula" ? "Show the formula" : "Show answer & solution"}</button>`
        }
      </div>
      ${
        ss.revealed
          ? `<div class="grades">
              <button class="grade again" type="button" data-action="${P}-grade" data-g="again">Forgot<small>tomorrow</small></button>
              <button class="grade hard" type="button" data-action="${P}-grade" data-g="hard">Hard</button>
              <button class="grade good" type="button" data-action="${P}-grade" data-g="good">Knew it</button>
              <button class="grade easy" type="button" data-action="${P}-grade" data-g="easy">Easy</button>
            </div>`
          : ""
      }`,
      { tall: true },
    );
  }

  // ---------- backups ----------
  function exportBackup() {
    const data = qs.exportData();
    download(`vocabvault-${part.slug}-backup-${todayISO()}.json`, JSON.stringify(data, null, 1), "application/json");
    toast(
      `${part.title} backup saved: ${plural(qs.liveItems().length, "of your own card")}${
        Object.keys(data.bank).length ? ` + progress on ${plural(Object.keys(data.bank).length, "Formula Book card")}` : ""
      }. The Formula Book itself is built in.`,
      7000,
    );
  }

  async function importBackup(file) {
    try {
      const r = qs.importData(JSON.parse(await file.text()), { markDirty: true, applyPrefs: true });
      toast(
        `✓ ${part.title} restored. Backup had ${plural(r.inBackup, "of your own card")}${r.inBackup ? `: ${r.added} new, ${r.updated} updated, ${r.inBackup - r.added - r.updated} already here` : ""}.${r.movedToOther ? ` ${plural(r.movedToOther, "card")} went to ${part.otherTitle}.` : ""}`,
        8000,
      );
      ctx.afterChange();
      render();
    } catch (e) {
      toast(e instanceof SyntaxError ? "That file isn't a backup (couldn't read it)." : e.message, 7000);
    }
  }

  // ---------- actions ----------
  const after = () => ctx.afterChange();
  const actions = {
    [`${P}-open`]: (el) => showItem(el.dataset.id),
    [`${P}-info`]: (el) => showInfo(el.dataset.id),
    [`${P}-new`]: () => showEditor(null),
    [`${P}-edit`]: (el) => showEditor(el.dataset.id),
    [`${P}-qotd`]: () => {
      gui.qotdShown = true;
      render();
    },
    [`${P}-star`]: (el) => {
      qs.updateItem(el.dataset.id, (i) => ({ ...i, starred: !i.starred }));
      showItem(el.dataset.id);
      after();
    },
    [`${P}-delete`]: (el) => {
      const n = qs.variantsOf(el.dataset.id).length;
      if (!confirm(n ? `Delete this question and its ${plural(n, "practice question")}?` : "Delete this card?")) return;
      qs.deleteItem(el.dataset.id);
      closeOverlay();
      toast("Deleted.");
      after();
      render();
    },
    [`${P}-add-book`]: (el) => {
      const r = qs.addBookItemToMine(el.dataset.id);
      toast(r ? "Added to your notes ✓" : "Already in your notes.");
      after();
    },
    [`${P}-more-practice`]: async (el) => {
      const it = qs.byId(el.dataset.id);
      if (!it) return;
      toast("AI is writing 2 practice questions…", 60000);
      try {
        const res = await practiceFor(settings(), it, qs.patternsByTopic());
        if (!res) return toast("The AI couldn't write them right now. Try “Prompt for 2 more” instead.", 7000);
        const { added } = qs.addItems(res.items);
        toast(added.length ? `Added ${plural(added.length, "practice question")} ✓ (by ${res.provider})` : "Those practice questions are already saved — try again for new ones.", 6000);
        showItem(it.id);
        after();
      } catch (e) {
        toast(e.message, 7000);
      }
    },
    [`${P}-draw-figure`]: async (el) => {
      const it = qs.byId(el.dataset.id);
      if (!it) return;
      toast("AI is drawing the figure…", 60000);
      try {
        const res = await figureFor(settings(), it);
        if (!res) return toast("The AI couldn't draw it right now. Try “Prompt for a figure” instead.", 7000);
        qs.updateItem(it.id, (i) => ({ ...i, figure: res.figure }));
        toast(`Figure drawn by ${res.provider} ✓ — check the labels match the question.`, 6000);
        showItem(it.id);
        after();
      } catch (e) {
        toast(e.message, 7000);
      }
    },
    [`${P}-copy-figure`]: async (el) => {
      const it = qs.byId(el.dataset.id);
      if (!it) return;
      closeOverlay();
      await copyAndGuide(buildFigurePrompt(it), "figure", "Prompt copied ✓ — paste it in Gemini, then paste its answer here");
    },
    [`${P}-remove-figure`]: (el) => {
      if (!confirm("Remove the figure from this card?")) return;
      qs.updateItem(el.dataset.id, (i) => ({ ...i, figure: "", image: "" }));
      showItem(el.dataset.id);
      after();
    },
    [`${P}-copy-similar`]: async (el) => {
      const it = qs.byId(el.dataset.id);
      if (!it) return;
      closeOverlay();
      await copyAndGuide(buildSimilarPrompt(it), "similar", "Prompt copied ✓ — paste it in Gemini, then paste its answer here");
    },
    [`${P}-typed`]: () => handleTyped(),
    [`${P}-topic-make`]: () => handleTopic(),
    [`${P}-copy-topic`]: async () => {
      const topic = ($(`#${P}Topic`)?.value ?? gui.topicDraft).trim();
      gui.topicDraft = topic;
      if (!topic) return toast("Write a topic first (e.g. Time and Work).");
      await copyAndGuide(buildQuantTopicPrompt({ topic, count: gui.topicCount, ...promptOpts() }), "topic", "Prompt copied ✓ — paste it in Gemini or ChatGPT");
    },
    [`${P}-chat-copy`]: () => copyAndGuide(buildQuantMaterialPrompt({ files: gui.chatFiles || [], ...promptOpts() }), "files", "Prompt copied ✓ — attach the file in Gemini and paste it"),
    [`${P}-chat-share`]: () => chatShare(),
    [`${P}-chat-close`]: () => closeChatPanel(),
    [`${P}-chat-last`]: () => openChatPanel(gui.lastFiles || []),
    [`${P}-cancel`]: () => {
      gui.candidates = null;
      render();
    },
    [`${P}-add-selected`]: () => {
      const chosen = gui.candidates.items.filter((r) => r.selected).map((r) => r.item);
      const { added, skipped: dup, moved, filled } = qs.addItems([...gui.candidates.hidden, ...chosen]);
      const ownHidden = gui.candidates.hidden.filter((h) => subjectOf(h) === part.subject).length;
      const skipped = dup.slice(ownHidden);
      gui.candidates = null;
      gui.typedDraft = "";
      const v = added.filter((i) => i.variantOf).length;
      toast(
        `Added ${plural(added.length - v, "card")}${v ? ` + ${plural(v, "practice question")}` : ""} ✓${skipped.length ? ` (${skipped.length} already saved)` : ""}${
          moved.length ? ` · ${plural(moved.length, "card")} went to ${part.otherTitle}` : ""
        }${filled.length ? ` · added details${filled.some((f) => f.fill.figure) ? " (figure)" : ""} to ${plural(filled.length, "saved card")}` : ""}`,
        6000,
      );
      after();
      gui.tab = "mine";
      gui.browse = "";
      go(`${P}-topics`);
    },
    [`${P}-set-source`]: (el) => {
      qs.update((s) => (s.prefs.dailySource = el.dataset.src), { touchesData: false });
      render();
    },
    [`${P}-start-session`]: () => {
      const plan = qs.todaysPlan();
      const pending = plan.ids.filter((id) => !plan.done[id]);
      gui.session = { ids: pending.length ? pending : [...plan.ids], i: 0, revealed: false, results: {} };
      renderSession();
    },
    [`${P}-flip`]: () => {
      gui.session.revealed = true;
      renderSession();
    },
    [`${P}-grade`]: (el) => {
      const ss = gui.session;
      const id = ss.ids[ss.i];
      const g = el.dataset.g;
      const it = qs.byId(id);
      qs.updateItem(id, (i) => review(i, g));
      if (it) qs.markTopic(it);
      ss.results[id] = g;
      qs.update((s) => {
        if (s.daily?.ids.includes(id)) s.daily.done[id] = g;
      }, { touchesData: false });
      ss.i += 1;
      ss.revealed = false;
      renderSession();
      after();
    },
    [`${P}-start-quiz`]: (el) => startQuiz(el.dataset.kind, { weakOnly: el.dataset.weak === "1" }),
    [`${P}-practise-keys`]: (el) => startQuiz("mixed", { keys: el.dataset.keys.split("|") }),
    [`${P}-practise-type`]: (el) => {
      closeOverlay();
      startQuiz("mixed", { typeKey: el.dataset.key });
    },
    [`${P}-revise-formulas`]: (el) => startQuiz("formula", { keys: [el.dataset.key] }),
    [`${P}-reveal`]: () => {
      gui.quiz.revealed = true;
      render();
    },
    [`${P}-pick`]: (el) => {
      const q = gui.quiz;
      const cur = q.current;
      q.picked = Number(el.dataset.i);
      q.answered += 1;
      const correct = q.picked === cur.answer;
      q.lastCorrect = correct;
      const it = qs.byId(cur.itemId);
      if (correct) q.score += 1;
      else {
        q.wrong.push(cur.itemId);
        q.queue = requeue(q.queue, q.i, cur.itemId, q.requeued);
      }
      // The answer also counts as a revision: wrong → back tomorrow; right on a due card → moves on.
      const revised = it && practiceReview(it, correct);
      if (revised) qs.updateItem(cur.itemId, () => revised);
      qs.update(
        (s) => {
          s.practice = recordAnswer(s.practice, q.source, cur.itemId, correct);
          if (revised && s.daily?.date === todayISO() && s.daily.ids.includes(cur.itemId) && !s.daily.done[cur.itemId]) s.daily.done[cur.itemId] = correct ? "good" : "again";
        },
        { touchesData: false },
      );
      if (it) qs.markTopic(it);
      render();
    },
    [`${P}-next`]: () => {
      const q = gui.quiz;
      q.i += 1;
      q.picked = null;
      q.revealed = false;
      q.current = q.i < q.queue.length ? questionFor(q, q.queue.slice(0, q.i).includes(q.queue[q.i])) : null;
      render();
      window.scrollTo(0, 0);
    },
    [`${P}-end-quiz`]: () => {
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
    [`${P}-toggle-topic`]: (el) => {
      const tree = qs.qBuildTree(qs.itemsFor(prefs().practiceSource), { withTypes: false });
      qs.update((s) => (s.prefs.excluded = toggle(el.dataset.key, s.prefs.excluded, tree)), { touchesData: false });
      render();
    },
    [`${P}-expand`]: (el) => {
      const k = el.dataset.key;
      if (gui.pickerOpen.has(k)) gui.pickerOpen.delete(k);
      else gui.pickerOpen.add(k);
      render();
    },
    [`${P}-topics-all`]: () => {
      qs.update((s) => (s.prefs.excluded = []), { touchesData: false });
      render();
    },
    [`${P}-topics-none`]: () => {
      const tree = qs.qBuildTree(qs.itemsFor(prefs().practiceSource), { withTypes: false });
      qs.update((s) => (s.prefs.excluded = [...(tree.get(part.subject) || [])]), { touchesData: false });
      render();
    },
    [`${P}-tab`]: (el) => {
      gui.tab = el.dataset.tab;
      gui.browse = "";
      render();
    },
    [`${P}-browse`]: (el) => {
      gui.browse = el.dataset.key;
      render();
      window.scrollTo(0, 0);
    },
    [`${P}-export-csv`]: () => download(`${part.slug}-notes-${todayISO()}.csv`, qItemsToCSV(qs.liveItems()), "text/csv"),
    [`${P}-export-json`]: () => exportBackup(),
    [`${P}-reset`]: () => {
      if (!confirm(`Erase all YOUR ${part.title} notes and progress on this device? (Other parts are not touched; the Formula Book stays.)`)) return;
      qs.resetAll();
      toast(`${part.title} data erased on this device.`);
      render();
    },
  };

  async function onChange(e) {
    const t = e.target;
    if (t.dataset.input === `${P}-files`) {
      const files = [...t.files];
      t.value = "";
      handleFiles(files);
      return true;
    }
    if (t.dataset.input === `${P}-fig-photo`) {
      const f = t.files[0];
      const id = t.dataset.id;
      t.value = "";
      if (!f) return true;
      try {
        const image = await figurePhoto(f);
        qs.updateItem(id, (i) => ({ ...i, image }));
        toast("Figure photo saved ✓");
        showItem(id);
        after();
      } catch (e) {
        toast(e.message, 7000);
      }
      return true;
    }
    if (t.dataset.input === `${P}-chat-files`) {
      const files = [...t.files];
      t.value = "";
      if (files.length) openChatPanel(files);
      return true;
    }
    if (t.dataset.input === `${P}-import`) {
      const f = t.files[0];
      t.value = "";
      if (f) await importBackup(f);
      return true;
    }
    if (t.dataset[`${P}pref`]) {
      const k = t.dataset[`${P}pref`];
      const v = t.type === "checkbox" ? t.checked : ["practiceSize", "dailyCount"].includes(k) ? Number(t.value) : t.value;
      if ($(`#${P}Typed`)) gui.typedDraft = $(`#${P}Typed`).value;
      if ($(`#${P}Topic`)) gui.topicDraft = $(`#${P}Topic`).value;
      qs.update((s) => (s.prefs[k] = v), { touchesData: false });
      render();
      return true;
    }
    if (t.id === `${P}Count`) {
      gui.topicCount = t.value;
      return true;
    }
    if (t.dataset[`${P}cand`] != null) {
      gui.candidates.items[Number(t.dataset[`${P}cand`])].selected = t.checked;
      render();
      return true;
    }
    if (t.dataset[`${P}topic`] != null) {
      const i = Number(t.dataset[`${P}topic`]);
      const [subject, topic] = t.value.split("|");
      const row = gui.candidates.items[i];
      row.item = { ...row.item, subject, topic };
      // Its practice questions move with it.
      for (const r of gui.candidates.items) if (r.item.variantOf === row.item.id) r.item = { ...r.item, subject, topic };
      render();
      return true;
    }
    if (t.dataset[`${P}type`] != null) {
      const row = gui.candidates.items[Number(t.dataset[`${P}type`])];
      row.item = { ...row.item, pattern: t.value.trim() };
      for (const r of gui.candidates.items) if (r.item.variantOf === row.item.id) r.item = { ...r.item, pattern: t.value.trim() };
      return true;
    }
    return false;
  }

  function onInput(e) {
    if (e.target.id === `${P}Search`) {
      gui.search = e.target.value;
      render();
      const input = $(`#${P}Search`);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return true;
    }
    if (e.target.id === `${P}Topic`) {
      gui.topicDraft = e.target.value;
      return true;
    }
    return false;
  }

  function onSubmit(e) {
    if (e.target.id === `${P}EditForm`) {
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
        <h3>${part.icon} ${part.title}</h3>
        <label class="field">Cards to revise each day
          <select data-${P}pref="dailyCount">${[5, 10, 15, 20, 30].map((n) => `<option value="${n}" ${Number(p.dailyCount) === n ? "selected" : ""}>${n}</option>`).join("")}</select>
        </label>
        ${variantsToggle()}
        <p class="muted small">The built-in Formula Book has ${qs.bookItems().length} ${part.subject === "Quant" ? "formula and shortcut" : "rule and trick"} cards for ${part.title}.</p>
      </article>`;
  }

  function dataCard() {
    return `
      <article class="card">
        <h3>🗂️ ${part.title} data <span class="badge">separate backup</span></h3>
        <p class="muted small">Your questions, practice questions, formulas, Formula Book progress and practice history. Separate from the other parts.</p>
        <div class="row wrap">
          <button class="btn small" type="button" data-action="${P}-export-json">⬇ Download backup</button>
          <label class="btn small">⬆ Restore backup<input type="file" accept="application/json,.json" data-input="${P}-import" hidden /></label>
          <button class="btn small danger" type="button" data-action="${P}-reset">Erase data</button>
        </div>
      </article>`;
  }

  return {
    gui,
    views: { [`${P}-today`]: viewToday, [`${P}-add`]: viewAdd, [`${P}-practice`]: viewPractice, [`${P}-topics`]: viewTopics },
    actions,
    onChange,
    onInput,
    onSubmit,
    prefsCard,
    dataCard,
    busy: () => Boolean(gui.busy || gui.quiz || gui.session || gui.candidates || gui.chatFiles || gui.copied),
    onCloseOverlay: () => (gui.session = null),
    cardOfTheDay: () => {
      const pool = qs.itemsFor(prefs().dailySource, { forToday: true });
      return pool.length ? qs.byId(qs.todaysPlan().wotd) : null;
    },
    loadBook: loadQBook,
    isBookId,
  };
}
