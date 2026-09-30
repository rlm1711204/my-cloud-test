import "./styles.css";
import * as store from "./lib/store.js";
import * as drive from "./lib/drive.js";
import { DEFAULT_MODEL, EXAMS, enrichWords, explainError, extractWords } from "./lib/ai.js";
import { filesToSources, filesToText } from "./lib/extract.js";
import { candidatesFromText, difficultyFromLevel, isEasy, levelOf, loadLevels } from "./lib/difficulty.js";
import { review, stage, stats, streak } from "./lib/srs.js";
import { buildIndex, findExisting, needsEnrichment, parseTypedWords, toCSV, todayISO, wordKey } from "./lib/words.js";

// ---------- tiny helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const settings = () => store.get().settings;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

let toastTimer;
function toast(msg, ms = 3200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function speak(text) {
  if (!("speechSynthesis" in window)) return toast("Speech isn't supported in this browser.");
  const u = new SpeechSynthesisUtterance(text);
  const lang = settings().voice;
  u.lang = lang;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang));
  if (voice) u.voice = voice;
  u.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Escape a sentence and highlight the target word (and its inflections) in it. */
function highlight(sentence, word) {
  const safe = esc(sentence);
  const w = wordKey(word);
  if (!w || w.includes(" ")) return safe;
  const stem = w.length > 4 ? w.replace(/(e|y)$/, "") : w;
  return safe.replace(new RegExp(`\\b(${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z]*)`, "gi"), "<mark>$1</mark>");
}

function blankOut(sentence, word) {
  const w = wordKey(word);
  const stem = w.length > 4 ? w.replace(/(e|y)$/, "") : w;
  const re = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z]*`, "gi");
  return re.test(sentence) ? esc(sentence).replace(re, "<b class='blank'>_____</b>") : null;
}

const STAGE_LABEL = { new: "New", learning: "Learning", mastered: "Mastered" };

// ---------- UI state ----------
let view = "today";
const ui = {
  busy: null, // status text while extracting
  candidates: null, // review list after extraction
  typedDraft: "",
  session: null, // flashcard session
  quiz: null,
  search: "",
  filter: "all",
  sort: "newest",
  syncState: "idle",
  syncError: "",
};

// ---------- shared word rendering ----------
function wordHead(w, { big = false } = {}) {
  return `
    <div class="whead ${big ? "big" : ""}">
      <div>
        <h2 class="wword">${esc(w.word)}${w.starred ? ' <span class="star" title="Starred">★</span>' : ""}</h2>
        <div class="wsub">
          ${w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ""}
          ${w.say ? `<span class="say">${esc(w.say)}</span>` : ""}
          ${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ""}
        </div>
      </div>
      <button class="icon-btn" type="button" data-action="speak" data-text="${esc(w.word)}" aria-label="Pronounce ${esc(w.word)}">🔊</button>
    </div>`;
}

function wordDetails(w) {
  const chips = (label, list, cls) =>
    list.length ? `<div class="chips"><span class="chip-label">${label}</span>${list.map((s) => `<span class="chip ${cls}">${esc(s)}</span>`).join("")}</div>` : "";
  return `
    <div class="wdetails">
      ${w.meaning ? `<p class="meaning">${esc(w.meaning)}</p>` : `<p class="muted">No meaning yet — use “Fill with AI” or Edit.</p>`}
      ${w.hindi ? `<p class="hindi" lang="hi"><span class="lang-tag">हिं</span>${esc(w.hindi)}</p>` : ""}
      ${w.tamil ? `<p class="tamil" lang="ta"><span class="lang-tag">த</span>${esc(w.tamil)}</p>` : ""}
      ${w.sentences.length ? `<ol class="sentences">${w.sentences.map((s) => `<li>${highlight(s, w.word)}</li>`).join("")}</ol>` : ""}
      ${chips("Synonyms", w.synonyms, "syn")}
      ${chips("Antonyms", w.antonyms, "ant")}
      ${w.examTip ? `<div class="tip"><strong>Exam tip</strong> ${esc(w.examTip)}</div>` : ""}
      ${w.context ? `<p class="context">Seen in: “${highlight(w.context, w.word)}”${w.source ? ` <span class="muted">— ${esc(w.source)}</span>` : ""}</p>` : ""}
    </div>`;
}

// ---------- views ----------
function viewToday() {
  const s = store.get();
  const words = store.liveWords();
  if (!words.length) {
    return `
      <section class="hero">
        <h1>Build your exam vocabulary, one page at a time.</h1>
        <p>Snap a newspaper editorial, upload a PDF or type words. VocabVault keeps only the hard words,
        adds Hindi meanings, pronunciation and example sentences, and gives you a Word of the Day plus a
        daily revision set.</p>
        <div class="stack">
          <button class="btn primary" data-nav="add" type="button">➕ Add your first words</button>
          ${!s.settings.apiKey ? `<button class="btn" data-nav="settings" type="button">🔑 Set up Claude AI (recommended)</button>` : ""}
        </div>
      </section>`;
  }
  const plan = store.todaysPlan();
  const st = stats(s.words);
  const wotd = store.byId(plan.wotd);
  const planWords = plan.ids.map(store.byId).filter(Boolean);
  const done = planWords.filter((w) => plan.done[w.id]).length;
  const pct = planWords.length ? Math.round((done / planWords.length) * 100) : 0;
  const date = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return `
    <section class="today-head">
      <div>
        <p class="eyebrow">${esc(date)}</p>
        <h1>Today’s vocabulary</h1>
      </div>
      <div class="streak" title="Days in a row with revision">🔥 ${streak(s.activity)}</div>
    </section>

    <section class="stats">
      <div><b>${st.total}</b><span>words</span></div>
      <div><b>${st.due}</b><span>due</span></div>
      <div><b>${st.learning}</b><span>learning</span></div>
      <div><b>${st.mastered}</b><span>mastered</span></div>
    </section>

    ${
      wotd
        ? `<article class="card wotd">
            <p class="eyebrow">✨ Word of the Day</p>
            ${wordHead(wotd, { big: true })}
            ${wordDetails(wotd)}
            <div class="row">
              <button class="btn small" type="button" data-action="share-wotd">📤 Share</button>
              <button class="btn small" type="button" data-action="open-word" data-id="${wotd.id}">Details</button>
            </div>
          </article>`
        : ""
    }

    <article class="card">
      <div class="row between">
        <h3>Words to memorise today</h3>
        <span class="muted">${done}/${planWords.length}</span>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      ${
        planWords.length
          ? `<ul class="plan-list">
              ${planWords
                .map((w) => {
                  const g = plan.done[w.id];
                  return `<li data-action="open-word" data-id="${w.id}">
                    <span class="tick ${g ? (g === "again" ? "again" : "ok") : ""}">${g ? (g === "again" ? "↻" : "✓") : ""}</span>
                    <span class="pw">${esc(w.word)}</span>
                    <span class="ph" lang="hi">${esc(w.hindi)}</span>
                    <span class="badge ${stage(w)}">${STAGE_LABEL[stage(w)]}</span>
                  </li>`;
                })
                .join("")}
            </ul>
            <button class="btn primary block" type="button" data-action="start-session">
              ${done === 0 ? "▶ Start flashcards" : done < planWords.length ? "▶ Continue" : "↻ Revise again"}
            </button>`
          : `<p class="muted">Add a few more words to get a daily set.</p>`
      }
      ${done && done === planWords.length ? `<p class="done-msg">🎉 Done for today! Try a quick <a href="#" data-nav="practice">quiz</a> to lock it in.</p>` : ""}
    </article>`;
}

function viewAdd() {
  const s = settings();
  if (ui.busy) {
    return `<section class="card center busy"><div class="spinner" aria-hidden="true"></div><p>${esc(ui.busy)}</p></section>`;
  }
  if (ui.candidates) return viewCandidates();
  const aiOn = Boolean(s.apiKey);
  return `
    <h1>Add words</h1>
    <p class="mode ${aiOn ? "on" : "off"}">
      ${
        aiOn
          ? `🤖 <b>AI mode</b> — Claude picks the hard words (${esc(EXAMS[s.exam] ?? EXAMS.general)}) and writes Hindi meaning, pronunciation, 2 sentences & an exam tip.`
          : `📴 <b>Offline mode</b> — words are picked using a word-frequency list; you fill in meanings. <a href="#" data-nav="settings">Add a Claude key</a> for full word cards.`
      }
    </p>

    <div class="add-grid">
      <label class="add-tile">
        <input type="file" accept="image/*" capture="environment" data-input="files" hidden />
        <span class="big-ico">📷</span><b>Scan with camera</b><span>Book page, newspaper, notes</span>
      </label>
      <label class="add-tile">
        <input type="file" accept="image/*,application/pdf,.pdf" multiple data-input="files" hidden />
        <span class="big-ico">🖼️</span><b>Upload screenshot / PDF</b><span>Several files at once is fine</span>
      </label>
    </div>

    <article class="card">
      <h3>✍️ Type or paste words</h3>
      <p class="muted">One per line or separated by commas. Phrases & idioms work too.</p>
      <textarea id="typed" rows="5" placeholder="obdurate, sanguine&#10;cut corners&#10;perfunctory">${esc(ui.typedDraft)}</textarea>
      <button class="btn primary block" type="button" data-action="typed">Check & prepare words</button>
    </article>

    <p class="muted small">Duplicates are checked automatically — words already in your master list (including forms like “mitigated” for “mitigate”) are never added twice.</p>`;
}

function viewCandidates() {
  const c = ui.candidates;
  const selected = c.items.filter((i) => i.selected).length;
  const dups = c.items.filter((i) => i.status === "dup").length;
  return `
    <div class="row between">
      <h1>Review words</h1>
      <button class="btn small ghost" type="button" data-action="cancel-candidates">Cancel</button>
    </div>
    <p class="muted">Found ${plural(c.items.length, "word")}${dups ? ` · ${dups} already in your list` : ""}. Untick any you already know.</p>
    <div class="row">
      <button class="btn small" type="button" data-action="select-all">Select all new</button>
      <button class="btn small" type="button" data-action="select-none">Clear</button>
    </div>
    <ul class="cand-list">
      ${c.items
        .map(
          (it, i) => `
        <li class="cand ${it.status}">
          <label>
            <input type="checkbox" data-cand="${i}" ${it.selected ? "checked" : ""} ${it.status === "dup" ? "disabled" : ""} />
            <span class="cand-body">
              <span class="cand-top">
                <b>${esc(it.rec.word)}</b>
                ${it.rec.say ? `<span class="say">${esc(it.rec.say)}</span>` : ""}
                ${it.status === "dup" ? `<span class="badge dup">Already saved</span>` : ""}
                ${it.status === "similar" ? `<span class="badge similar">Similar to “${esc(it.similarTo)}”</span>` : ""}
                ${it.easy ? `<span class="badge easy">Common word</span>` : ""}
                <span class="diff" title="Difficulty">${"●".repeat(it.rec.difficulty || 3)}</span>
              </span>
              ${it.rec.meaning ? `<span class="cand-meaning">${esc(it.rec.meaning)}</span>` : ""}
              ${it.rec.hindi ? `<span class="cand-hindi" lang="hi">${esc(it.rec.hindi)}</span>` : ""}
              ${!it.rec.meaning && it.rec.context ? `<span class="cand-meaning muted">“${highlight(it.rec.context, it.rec.word)}”</span>` : ""}
            </span>
          </label>
        </li>`,
        )
        .join("")}
    </ul>
    <div class="sticky-actions">
      <button class="btn primary block" type="button" data-action="add-selected" ${selected ? "" : "disabled"}>
        Add ${plural(selected, "word")} to master list
      </button>
    </div>`;
}

function viewPractice() {
  const pool = store.liveWords().filter((w) => w.meaning);
  if (ui.quiz) return viewQuiz();
  return `
    <h1>Quiz</h1>
    <p class="muted">Exam-style questions from your own list. Wrong answers go back into tomorrow’s revision.</p>
    ${
      pool.length < 4
        ? `<article class="card"><p>You need at least 4 words with meanings to start a quiz (you have ${pool.length}).</p>
           <button class="btn primary" data-nav="add" type="button">Add words</button></article>`
        : `<div class="quiz-grid">
            ${[
              ["mixed", "🎲", "Mixed", "A bit of everything"],
              ["meaning", "📖", "Word → Meaning", "Pick the right meaning"],
              ["hindi", "🇮🇳", "Word → Hindi", "Pick the Hindi meaning"],
              ["reverse", "🔁", "Meaning → Word", "Like one-word substitution"],
              ["blank", "✏️", "Fill in the blank", "Cloze test practice"],
              ["synonym", "🔗", "Synonyms", "Find the closest word"],
            ]
              .map(([k, ico, t, d]) => `<button class="quiz-tile" type="button" data-action="start-quiz" data-kind="${k}"><span class="big-ico">${ico}</span><b>${t}</b><span>${d}</span></button>`)
              .join("")}
          </div>`
    }`;
}

function viewQuiz() {
  const q = ui.quiz;
  if (q.i >= q.qs.length) {
    const wrong = q.wrong.map(store.byId).filter(Boolean);
    return `
      <article class="card center">
        <p class="eyebrow">Quiz complete</p>
        <p class="score">${q.score}/${q.qs.length}</p>
        <p>${q.score === q.qs.length ? "Perfect! 🏆" : q.score >= q.qs.length * 0.7 ? "Great work 💪" : "Keep going — revision fixes this 📈"}</p>
        ${wrong.length ? `<p class="muted">To revise: ${wrong.map((w) => `<a href="#" data-action="open-word" data-id="${w.id}">${esc(w.word)}</a>`).join(", ")}</p>` : ""}
        <div class="row center">
          <button class="btn primary" type="button" data-action="start-quiz" data-kind="${q.kind}">Play again</button>
          <button class="btn" type="button" data-action="end-quiz">Done</button>
        </div>
      </article>`;
  }
  const cur = q.qs[q.i];
  return `
    <div class="row between">
      <span class="muted">Question ${q.i + 1} of ${q.qs.length}</span>
      <button class="btn small ghost" type="button" data-action="end-quiz">Quit</button>
    </div>
    <div class="progress"><span style="width:${(q.i / q.qs.length) * 100}%"></span></div>
    <article class="card quiz-card">
      <p class="eyebrow">${esc(cur.label)}</p>
      <div class="quiz-prompt">${cur.prompt}</div>
      <div class="options">
        ${cur.options
          .map((o, i) => {
            let cls = "";
            if (q.picked != null) cls = i === cur.answer ? "correct" : i === q.picked ? "wrong" : "dim";
            return `<button class="option ${cls}" type="button" data-action="pick" data-i="${i}" ${q.picked != null ? "disabled" : ""}>${esc(o)}</button>`;
          })
          .join("")}
      </div>
      ${q.picked != null ? `<button class="btn primary block" type="button" data-action="next-q">${q.i + 1 < q.qs.length ? "Next →" : "See score"}</button>` : ""}
    </article>`;
}

function viewWords() {
  const all = store.liveWords();
  const needs = all.filter(needsEnrichment).length;
  const term = ui.search.trim().toLowerCase();
  let list = all.filter((w) => {
    if (term && !(`${w.word} ${w.meaning} ${w.hindi} ${w.synonyms.join(" ")}`.toLowerCase().includes(term))) return false;
    if (ui.filter === "starred") return w.starred;
    if (ui.filter === "incomplete") return needsEnrichment(w);
    if (["new", "learning", "mastered"].includes(ui.filter)) return stage(w) === ui.filter;
    return true;
  });
  const sorters = {
    newest: (a, b) => b.addedAt.localeCompare(a.addedAt),
    az: (a, b) => a.word.localeCompare(b.word),
    hardest: (a, b) => b.difficulty - a.difficulty || b.lapses - a.lapses,
    weakest: (a, b) => a.box - b.box || b.lapses - a.lapses,
  };
  list = [...list].sort(sorters[ui.sort]);
  const filters = [
    ["all", "All"],
    ["new", "New"],
    ["learning", "Learning"],
    ["mastered", "Mastered"],
    ["starred", "★ Starred"],
    ["incomplete", "Needs details"],
  ];
  return `
    <div class="row between">
      <h1>Master list <span class="muted">(${all.length})</span></h1>
      <button class="btn small" type="button" data-action="new-word">＋ New</button>
    </div>
    <input id="search" type="search" placeholder="Search word, meaning, Hindi…" value="${esc(ui.search)}" autocomplete="off" />
    <div class="filter-row">
      ${filters.map(([k, l]) => `<button type="button" class="fchip ${ui.filter === k ? "active" : ""}" data-action="filter" data-f="${k}">${l}</button>`).join("")}
    </div>
    <div class="row between">
      <select id="sort" aria-label="Sort">
        <option value="newest" ${ui.sort === "newest" ? "selected" : ""}>Newest first</option>
        <option value="az" ${ui.sort === "az" ? "selected" : ""}>A → Z</option>
        <option value="hardest" ${ui.sort === "hardest" ? "selected" : ""}>Hardest</option>
        <option value="weakest" ${ui.sort === "weakest" ? "selected" : ""}>Weakest memory</option>
      </select>
      ${needs && settings().apiKey ? `<button class="btn small" type="button" data-action="enrich-missing">🤖 Fill ${needs} missing</button>` : ""}
    </div>
    ${
      list.length
        ? `<ul class="word-list">${list
            .map(
              (w) => `<li data-action="open-word" data-id="${w.id}">
                <div><b>${esc(w.word)}</b>${w.starred ? ' <span class="star">★</span>' : ""}
                  <span class="wl-meaning">${esc(w.meaning || "—")}</span></div>
                <div class="wl-right"><span class="ph" lang="hi">${esc(w.hindi)}</span><span class="badge ${stage(w)}">${STAGE_LABEL[stage(w)]}</span></div>
              </li>`,
            )
            .join("")}</ul>`
        : `<p class="muted center">${all.length ? "No words match." : "Your master list is empty."}</p>`
    }
    <div class="row wrap">
      <button class="btn small" type="button" data-action="export-csv">⬇ CSV (Excel)</button>
      <button class="btn small" type="button" data-action="export-json">⬇ Backup</button>
      <label class="btn small">⬆ Restore backup<input type="file" accept="application/json,.json" data-input="import" hidden /></label>
    </div>`;
}

function viewSettings() {
  const s = store.get();
  const st = s.settings;
  const connected = drive.isConnected();
  const last = s.drive.lastSync ? new Date(s.drive.lastSync).toLocaleString("en-IN") : "never";
  return `
    <h1>Settings</h1>

    <article class="card">
      <h3>🤖 Claude AI</h3>
      <p class="muted">Used to find hard words in photos/PDFs and to write Hindi meanings, pronunciation, sentences and exam tips.
      Get a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.
      It is stored only on this device.</p>
      <label class="field">API key<input type="password" data-setting="apiKey" value="${esc(st.apiKey)}" placeholder="sk-ant-…" autocomplete="off" /></label>
      <label class="field">Model
        <select data-setting="model">
          ${[
            [DEFAULT_MODEL, "Opus 5.5 · best (default)"],
            ["claude-sonnet-5-5", "Sonnet 5.5 · faster, ½ cost"],
            ["claude-haiku-4-5", "Haiku 4.5 · fastest, cheapest"],
          ]
            .map(([v, l]) => `<option value="${v}" ${st.model === v ? "selected" : ""}>${l}</option>`)
            .join("")}
        </select>
      </label>
      <label class="field">Exam focus
        <select data-setting="exam">
          ${Object.entries(EXAMS).map(([k, v]) => `<option value="${k}" ${st.exam === k ? "selected" : ""}>${esc(v)}</option>`).join("")}
        </select>
      </label>
      <label class="toggle"><input type="checkbox" data-setting="tamil" ${st.tamil ? "checked" : ""} /> Also add Tamil meaning (தமிழ்)</label>
    </article>

    <article class="card">
      <h3>📅 Daily practice</h3>
      <label class="field">Words to memorise per day
        <input type="number" min="3" max="50" data-setting="dailyCount" value="${st.dailyCount}" />
      </label>
      <label class="field">Pronunciation voice
        <select data-setting="voice">
          ${[
            ["en-IN", "Indian English"],
            ["en-GB", "British English"],
            ["en-US", "American English"],
          ]
            .map(([v, l]) => `<option value="${v}" ${st.voice === v ? "selected" : ""}>${l}</option>`)
            .join("")}
        </select>
      </label>
      <button class="btn small" type="button" data-action="speak" data-text="Perspicacious">🔊 Test voice</button>
    </article>

    <article class="card">
      <h3>☁️ Google Drive</h3>
      <p class="muted">Your master list is saved in a <b>${drive.FOLDER_NAME}</b> folder in your Drive: <code>${drive.JSON_NAME}</code> (used by the app)
      plus a <b>${drive.SHEET_NAME}</b> Google Sheet you can open, filter or print. The app can only see files it created.</p>
      <label class="field">Google OAuth Client ID<input type="text" data-setting="googleClientId" value="${esc(st.googleClientId)}" placeholder="1234-abc.apps.googleusercontent.com" autocomplete="off" /></label>
      <p class="muted small">One-time setup, ~5 minutes — see “Google Drive setup” in the README.</p>
      <p>Status: <b>${connected ? "Connected" : "Not connected"}</b> · Last sync: ${esc(last)}${s.dirty ? " · <span class='warn'>unsynced changes</span>" : ""}</p>
      ${ui.syncError ? `<p class="error">${esc(ui.syncError)}</p>` : ""}
      <div class="row wrap">
        <button class="btn primary small" type="button" data-action="sync">${connected ? "⟳ Sync now" : "Connect & sync"}</button>
        ${s.drive.sheetId ? `<a class="btn small" href="${drive.sheetUrl(s.drive)}" target="_blank" rel="noopener">Open Sheet</a>` : ""}
        ${s.drive.folderId ? `<a class="btn small" href="${drive.folderUrl(s.drive)}" target="_blank" rel="noopener">Open folder</a>` : ""}
        ${connected ? `<button class="btn small ghost" type="button" data-action="disconnect">Disconnect</button>` : ""}
      </div>
      <label class="toggle"><input type="checkbox" data-setting="autoSync" ${st.autoSync ? "checked" : ""} /> Sync automatically after changes</label>
    </article>

    <article class="card">
      <h3>🗂️ Data</h3>
      <div class="row wrap">
        <button class="btn small" type="button" data-action="export-json">⬇ Download backup</button>
        <label class="btn small">⬆ Restore backup<input type="file" accept="application/json,.json" data-input="import" hidden /></label>
        <button class="btn small danger" type="button" data-action="reset">Erase data on this device</button>
      </div>
    </article>
    <p class="muted small center">VocabVault · word frequency data from SCOWL (© Kevin Atkinson)</p>`;
}

// ---------- overlays (word details, editor, flashcards) ----------
function openOverlay(html, { tall = false } = {}) {
  const o = $("#overlay");
  const wasOpen = o.classList.contains("open");
  o.innerHTML = `<div class="sheet ${tall ? "tall" : ""} ${wasOpen ? "no-anim" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  o.classList.add("open");
  document.body.classList.add("no-scroll");
}
function closeOverlay() {
  const o = $("#overlay");
  o.classList.remove("open");
  o.innerHTML = "";
  document.body.classList.remove("no-scroll");
  ui.session = null;
}

function showWord(id) {
  const w = store.byId(id);
  if (!w) return;
  const next = stage(w) === "new" ? "not started" : new Date(`${w.due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  openOverlay(`
    <div class="sheet-bar"><span class="badge ${stage(w)}">${STAGE_LABEL[stage(w)]}</span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
    ${wordHead(w, { big: true })}
    ${wordDetails(w)}
    <p class="muted small">Next review: ${esc(next)} · Reviewed ${plural(w.reviews, "time")} · Difficulty ${w.difficulty}/5 · Added ${esc(w.addedAt.slice(0, 10))}</p>
    <div class="row wrap">
      <button class="btn small" type="button" data-action="star" data-id="${w.id}">${w.starred ? "★ Unstar" : "☆ Star"}</button>
      <button class="btn small" type="button" data-action="edit-word" data-id="${w.id}">✎ Edit</button>
      ${settings().apiKey ? `<button class="btn small" type="button" data-action="enrich-one" data-id="${w.id}">🤖 ${needsEnrichment(w) ? "Fill" : "Refresh"} with AI</button>` : ""}
      <button class="btn small danger" type="button" data-action="delete-word" data-id="${w.id}">Delete</button>
    </div>`);
}

function showEditor(id) {
  const w = id ? store.byId(id) : null;
  const v = (k) => esc(w?.[k] ?? "");
  openOverlay(`
    <div class="sheet-bar"><h3>${w ? "Edit word" : "New word"}</h3><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
    <form id="editForm" data-id="${w?.id ?? ""}">
      <label class="field">Word<input name="word" required value="${v("word")}" /></label>
      <div class="two">
        <label class="field">Part of speech<input name="pos" value="${v("pos")}" placeholder="adjective" /></label>
        <label class="field">Difficulty (1–5)<input name="difficulty" type="number" min="1" max="5" value="${w?.difficulty ?? 3}" /></label>
      </div>
      <label class="field">Meaning (simple English)<input name="meaning" value="${v("meaning")}" /></label>
      <label class="field">Hindi meaning<input name="hindi" lang="hi" value="${v("hindi")}" /></label>
      <label class="field">Tamil meaning<input name="tamil" lang="ta" value="${v("tamil")}" /></label>
      <div class="two">
        <label class="field">Say it<input name="say" value="${v("say")}" placeholder="uh-BAYT" /></label>
        <label class="field">IPA<input name="ipa" value="${v("ipa")}" placeholder="/əˈbeɪt/" /></label>
      </div>
      <label class="field">Example sentences (one per line)<textarea name="sentences" rows="3">${esc((w?.sentences ?? []).join("\n"))}</textarea></label>
      <label class="field">Synonyms (comma separated)<input name="synonyms" value="${esc((w?.synonyms ?? []).join(", "))}" /></label>
      <label class="field">Antonyms (comma separated)<input name="antonyms" value="${esc((w?.antonyms ?? []).join(", "))}" /></label>
      <label class="field">Exam tip / mnemonic<textarea name="examTip" rows="2">${v("examTip")}</textarea></label>
      <button class="btn primary block" type="submit">Save</button>
      ${!w && settings().apiKey ? `<p class="muted small center">Tip: just type the word and use the Add tab to let Claude fill everything.</p>` : ""}
    </form>`);
}

function renderSession() {
  const ss = ui.session;
  if (!ss) return;
  if (ss.i >= ss.ids.length) {
    const vals = Object.values(ss.results);
    const known = vals.filter((g) => g !== "again").length;
    openOverlay(`
      <div class="sheet-bar"><span></span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
      <div class="center session-done">
        <p class="big-ico">🎉</p>
        <h2>Session complete</h2>
        <p>You knew <b>${known}</b> of ${vals.length}. Words you missed will come back tomorrow.</p>
        <button class="btn primary" type="button" data-action="close">Back to Today</button>
      </div>`);
    return;
  }
  const w = store.byId(ss.ids[ss.i]);
  if (!w) {
    ss.i += 1;
    return renderSession();
  }
  openOverlay(`
    <div class="sheet-bar">
      <span class="muted">Card ${ss.i + 1} of ${ss.ids.length}</span>
      <button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button>
    </div>
    <div class="progress"><span style="width:${(ss.i / ss.ids.length) * 100}%"></span></div>
    <div class="flashcard ${ss.revealed ? "revealed" : ""}">
      ${wordHead(w, { big: true })}
      ${
        ss.revealed
          ? wordDetails(w)
          : `<p class="muted center recall">Say the meaning in your head (English & Hindi), then reveal.</p>
             <button class="btn primary block" type="button" data-action="reveal">Show meaning</button>`
      }
    </div>
    ${
      ss.revealed
        ? `<div class="grades">
            <button class="grade again" type="button" data-action="grade" data-g="again">Forgot<small>tomorrow</small></button>
            <button class="grade hard" type="button" data-action="grade" data-g="hard">Hard</button>
            <button class="grade good" type="button" data-action="grade" data-g="good">Knew it</button>
            <button class="grade easy" type="button" data-action="grade" data-g="easy">Easy</button>
          </div>`
        : ""
    }`,
    { tall: true },
  );
  if (!ss.revealed && ss.autoSpeak) speak(w.word);
}

// ---------- quiz ----------
const QUIZ_LABELS = {
  meaning: "Choose the correct meaning",
  hindi: "सही हिंदी अर्थ चुनें",
  reverse: "Which word means…",
  blank: "Fill in the blank",
  synonym: "Choose the closest synonym",
};

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeQuestion(w, kind, pool) {
  const others = shuffle(pool.filter((o) => o.id !== w.id));
  const pick = (field, n = 3) => [...new Set(others.map((o) => o[field]).filter((x) => x && x !== w[field]))].slice(0, n);
  const build = (correct, wrongs) => {
    if (!correct || wrongs.length < 3) return null;
    const options = shuffle([correct, ...wrongs.slice(0, 3)]);
    return { options, answer: options.indexOf(correct) };
  };
  const head = `<span class="qword">${esc(w.word)}</span>${w.pos ? ` <span class="pos">${esc(w.pos)}</span>` : ""}`;
  let q = null;
  if (kind === "meaning") {
    const b = build(w.meaning, pick("meaning"));
    q = b && { prompt: head, ...b };
  }
  if (kind === "hindi") {
    const b = build(w.hindi, pick("hindi"));
    q = b && { prompt: head, ...b };
  }
  if (kind === "reverse") {
    const b = build(w.word, pick("word"));
    q = b && { prompt: `<span class="qmeaning">${esc(w.meaning)}</span>`, ...b };
  }
  if (kind === "blank") {
    const sentence = w.sentences.map((s) => blankOut(s, w.word)).find(Boolean);
    const b = sentence && build(w.word, pick("word"));
    q = b && { prompt: `<span class="qsentence">${sentence}</span>`, ...b };
  }
  if (kind === "synonym" && w.synonyms.length) {
    const correct = w.synonyms[0];
    const own = new Set([...w.synonyms, w.word].map((s) => s.toLowerCase()));
    const wrongs = [...new Set(others.flatMap((o) => [o.word, ...o.synonyms]).filter((s) => !own.has(s.toLowerCase())))].slice(0, 3);
    const b = build(correct, wrongs);
    q = b && { prompt: head, ...b };
  }
  return q && { ...q, kind, label: QUIZ_LABELS[kind], wordId: w.id };
}

function startQuiz(kind) {
  const pool = store.liveWords().filter((w) => w.meaning);
  // Favour words being learnt and words often forgotten.
  const weighted = shuffle(pool).sort((a, b) => b.lapses - a.lapses + (a.box - b.box) * 0.5 + (Math.random() - 0.5) * 3);
  const kinds = ["meaning", "hindi", "reverse", "blank", "synonym"];
  const qs = [];
  for (const w of weighted) {
    if (qs.length >= 10) break;
    const order = kind === "mixed" ? shuffle(kinds) : [kind];
    const q = order.map((k) => makeQuestion(w, k, pool)).find(Boolean);
    if (q) qs.push(q);
  }
  if (!qs.length) return toast("Not enough words with the needed details for this quiz type yet.");
  ui.quiz = { kind, qs, i: 0, picked: null, score: 0, wrong: [] };
  render();
}

// ---------- add pipeline ----------
function setBusy(text) {
  ui.busy = text;
  if (view === "add") render();
}

function prepareCandidates(records, { typed = false, levels = null } = {}) {
  const index = buildIndex(store.liveWords());
  const seen = new Set();
  const items = [];
  for (const rec of records) {
    const key = wordKey(rec.word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const ex = findExisting(key, index);
    const easy = typed && levels ? isEasy(key, levels) : false;
    const status = ex?.exact ? "dup" : ex ? "similar" : "new";
    items.push({ rec, status, similarTo: ex?.match.word, easy, selected: status !== "dup" && (typed || !easy) });
  }
  // New words first, duplicates last.
  const order = { new: 0, similar: 1, dup: 2 };
  items.sort((a, b) => order[a.status] - order[b.status]);
  return items;
}

async function handleFiles(files) {
  if (!files.length) return;
  const s = settings();
  const source = files.map((f) => f.name).join(", ").slice(0, 120);
  setBusy("Preparing your files…");
  try {
    let records;
    if (s.apiKey) {
      const sources = await filesToSources(files);
      const known = store.liveWords().map((w) => w.word);
      const res = await extractWords(s, sources, known.length <= 4000 ? known : [], setBusy);
      records = res.map((r) => ({ ...r, source }));
    } else {
      const text = await filesToText(files, setBusy);
      setBusy("Picking out the difficult words…");
      const levels = await loadLevels();
      records = candidatesFromText(text, levels).map((c) => ({
        word: c.word,
        context: c.context,
        difficulty: difficultyFromLevel(c.level),
        source,
      }));
    }
    ui.busy = null;
    if (!records.length) {
      toast("No difficult words found. Try a clearer photo, or type the words.");
      return render();
    }
    ui.candidates = { items: prepareCandidates(records) };
  } catch (e) {
    ui.busy = null;
    toast(explainError(e), 6000);
  }
  if (view === "add") render();
}

async function handleTyped() {
  const text = $("#typed")?.value ?? "";
  ui.typedDraft = text;
  const list = parseTypedWords(text);
  if (!list.length) return toast("Type at least one word.");
  const s = settings();
  const index = buildIndex(store.liveWords());
  const fresh = list.filter((w) => !findExisting(w, index)?.exact);
  const dupRecords = list.filter((w) => findExisting(w, index)?.exact).map((w) => ({ word: w }));
  setBusy("Checking your words…");
  try {
    const levels = await loadLevels();
    let records;
    if (s.apiKey && fresh.length) {
      records = (await enrichWords(s, fresh, setBusy)).map((r) => ({ ...r, source: "Typed" }));
    } else {
      records = fresh.map((w) => ({ word: w, difficulty: difficultyFromLevel(levelOf(w, levels)), source: "Typed" }));
    }
    ui.busy = null;
    ui.candidates = { items: prepareCandidates([...records, ...dupRecords], { typed: true, levels }), typed: true };
  } catch (e) {
    ui.busy = null;
    toast(explainError(e), 6000);
  }
  if (view === "add") render();
}

async function enrich(ids) {
  const words = ids.map(store.byId).filter(Boolean);
  if (!words.length) return;
  toast(`Claude is filling in ${plural(words.length, "word")}…`, 60000);
  try {
    const out = [];
    for (let i = 0; i < words.length; i += 25) {
      out.push(...(await enrichWords(settings(), words.slice(i, i + 25).map((w) => w.word))));
    }
    const byKey = new Map(out.map((r) => [wordKey(r.word), r]));
    let n = 0;
    words.forEach((w, i) => {
      const r = byKey.get(wordKey(w.word)) ?? out[i];
      if (!r) return;
      const keep = { id: w.id, word: w.word, box: w.box, due: w.due, reviews: w.reviews, lapses: w.lapses, lastReviewed: w.lastReviewed, starred: w.starred, addedAt: w.addedAt, source: w.source, context: w.context || r.context, tags: w.tags };
      store.saveWord({ ...w, ...r, ...keep });
      n += 1;
    });
    toast(`Updated ${plural(n, "word")} ✓`);
  } catch (e) {
    toast(explainError(e), 6000);
  }
}

// ---------- sync ----------
function updateSyncChip() {
  const s = store.get();
  const chip = $("#syncChip");
  let text = "Local only";
  let cls = "";
  if (s.settings.googleClientId) {
    if (ui.syncState === "syncing") (text = "Syncing…"), (cls = "busy");
    else if (ui.syncState === "error") (text = "Sync error"), (cls = "err");
    else if (!drive.isConnected()) (text = "Tap to sync"), (cls = "warn");
    else if (s.dirty) (text = "Unsynced"), (cls = "warn");
    else (text = "Synced ✓"), (cls = "ok");
  }
  chip.textContent = text;
  chip.className = `sync-chip ${cls}`;
}

let syncing = null;
async function sync({ interactive = false } = {}) {
  const s = store.get();
  if (!s.settings.googleClientId) {
    if (interactive) {
      toast("Add your Google Client ID in Settings to save to Drive.");
      go("settings");
    }
    return;
  }
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      if (!drive.isConnected()) {
        if (!interactive) return;
        await drive.connect(s.settings.googleClientId);
      }
      ui.syncState = "syncing";
      ui.syncError = "";
      updateSyncChip();
      const { data, ids } = await drive.pull(store.get().drive);
      if (data) store.importData(data);
      const payload = store.exportData();
      const newIds = await drive.push(payload, toCSV(payload.words), ids);
      store.update(
        (st) => {
          st.drive = { ...newIds, lastSync: new Date().toISOString() };
          st.dirty = false;
        },
        { touchesData: false },
      );
      ui.syncState = "ok";
      if (interactive) toast("Saved to Google Drive ✓");
    } catch (e) {
      ui.syncState = e.needsAuth ? "idle" : "error";
      ui.syncError = e.message;
      if (interactive || !e.needsAuth) toast(e.message, 5000);
    } finally {
      syncing = null;
      updateSyncChip();
      if (view === "settings" || view === "today" || view === "words") render();
    }
  })();
  return syncing;
}

let autoSyncTimer;
function scheduleAutoSync() {
  const s = store.get();
  if (!s.settings.autoSync || !s.dirty || !drive.isConnected()) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => store.get().dirty && sync(), 2500);
}

// ---------- routing & events ----------
const VIEWS = { today: viewToday, add: viewAdd, practice: viewPractice, words: viewWords, settings: viewSettings };

function render() {
  const main = $("#view");
  const searchFocused = document.activeElement?.id === "search";
  main.innerHTML = VIEWS[view]();
  for (const b of document.querySelectorAll(".tabbar [data-nav]")) b.classList.toggle("active", b.dataset.nav === view);
  if (searchFocused) {
    const input = $("#search");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  updateSyncChip();
}

function go(v) {
  if (view === "add" && v !== "add" && $("#typed")) ui.typedDraft = $("#typed").value;
  view = v;
  render();
  window.scrollTo(0, 0);
  history.replaceState(null, "", `#${v}`);
}

const actions = {
  speak: (el) => speak(el.dataset.text),
  sync: () => sync({ interactive: true }),
  disconnect: () => {
    drive.disconnect();
    toast("Disconnected from Google Drive on this device.");
    render();
  },
  close: () => {
    closeOverlay();
    render();
  },
  "open-word": (el) => showWord(el.dataset.id),
  "new-word": () => showEditor(null),
  "edit-word": (el) => showEditor(el.dataset.id),
  star: (el) => {
    const w = store.byId(el.dataset.id);
    store.saveWord({ ...w, starred: !w.starred });
    showWord(w.id);
  },
  "delete-word": (el) => {
    const w = store.byId(el.dataset.id);
    if (!confirm(`Delete “${w.word}” from your master list?`)) return;
    store.deleteWord(w.id);
    closeOverlay();
    render();
    toast(`Deleted “${w.word}”`);
  },
  "enrich-one": async (el) => {
    await enrich([el.dataset.id]);
    showWord(el.dataset.id);
  },
  "enrich-missing": async () => {
    await enrich(store.liveWords().filter(needsEnrichment).map((w) => w.id));
    render();
  },
  "share-wotd": async () => {
    const w = store.byId(store.todaysPlan().wotd);
    if (!w) return;
    const text = [
      `📘 Word of the Day: ${w.word.toUpperCase()}${w.pos ? ` (${w.pos})` : ""}`,
      w.say && `🔊 ${w.say}${w.ipa ? `  ${w.ipa}` : ""}`,
      w.meaning && `➡ ${w.meaning}`,
      w.hindi && `🇮🇳 ${w.hindi}`,
      ...w.sentences.map((s) => `• ${s}`),
      w.synonyms.length && `Synonyms: ${w.synonyms.join(", ")}`,
      w.examTip && `💡 ${w.examTip}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Copied — paste it in WhatsApp or notes.");
      }
    } catch {
      /* share cancelled */
    }
  },
  "start-session": () => {
    const plan = store.todaysPlan();
    const pending = plan.ids.filter((id) => !plan.done[id]);
    ui.session = { ids: pending.length ? pending : [...plan.ids], i: 0, revealed: false, results: {}, autoSpeak: true };
    renderSession();
  },
  reveal: () => {
    ui.session.revealed = true;
    renderSession();
  },
  grade: (el) => {
    const ss = ui.session;
    const id = ss.ids[ss.i];
    const g = el.dataset.g;
    const today = todayISO();
    store.update((s) => {
      const i = s.words.findIndex((w) => w.id === id);
      if (i >= 0) s.words[i] = review(s.words[i], g, today);
      if (s.daily?.date === today) s.daily.done[id] = g;
      if (!s.activity.includes(today)) s.activity.push(today);
    });
    ss.results[id] = g;
    ss.i += 1;
    ss.revealed = false;
    renderSession();
  },
  "start-quiz": (el) => startQuiz(el.dataset.kind),
  "end-quiz": () => {
    ui.quiz = null;
    render();
  },
  pick: (el) => {
    const q = ui.quiz;
    const cur = q.qs[q.i];
    q.picked = Number(el.dataset.i);
    if (q.picked === cur.answer) q.score += 1;
    else {
      q.wrong.push(cur.wordId);
      store.update((s) => {
        const i = s.words.findIndex((w) => w.id === cur.wordId);
        if (i >= 0) s.words[i] = review(s.words[i], "again");
      });
    }
    const today = todayISO();
    if (!store.get().activity.includes(today)) store.update((s) => s.activity.push(today));
    render();
  },
  "next-q": () => {
    ui.quiz.i += 1;
    ui.quiz.picked = null;
    render();
  },
  typed: () => handleTyped(),
  "cancel-candidates": () => {
    ui.candidates = null;
    render();
  },
  "select-all": () => {
    for (const it of ui.candidates.items) it.selected = it.status !== "dup";
    render();
  },
  "select-none": () => {
    for (const it of ui.candidates.items) it.selected = false;
    render();
  },
  "add-selected": () => {
    const recs = ui.candidates.items.filter((i) => i.selected).map((i) => i.rec);
    const n = store.addWords(recs);
    const wasTyped = ui.candidates.typed;
    ui.candidates = null;
    if (wasTyped) ui.typedDraft = "";
    toast(`Added ${plural(n, "word")} to your master list ✓`);
    go("words");
  },
  filter: (el) => {
    ui.filter = el.dataset.f;
    render();
  },
  "export-csv": () => download(`vocab-master-${todayISO()}.csv`, "﻿" + toCSV(store.get().words), "text/csv;charset=utf-8"),
  "export-json": () => download(`vocabvault-backup-${todayISO()}.json`, JSON.stringify(store.exportData(), null, 1), "application/json"),
  reset: () => {
    if (!confirm("Erase all words on this device? (Your Google Drive copy is not touched.)")) return;
    store.resetAll();
    render();
    toast("Local data erased.");
  },
};

document.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) {
    e.preventDefault();
    closeOverlay();
    return go(nav.dataset.nav);
  }
  const el = e.target.closest("[data-action]");
  if (el && actions[el.dataset.action]) {
    if (el.tagName === "A") e.preventDefault();
    e.stopPropagation();
    actions[el.dataset.action](el, e);
    return;
  }
  if (e.target.id === "overlay") actions.close();
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.input === "files") {
    const files = [...t.files];
    t.value = "";
    return handleFiles(files);
  }
  if (t.dataset.input === "import") {
    const f = t.files[0];
    t.value = "";
    if (!f) return;
    try {
      store.importData(JSON.parse(await f.text()), { markDirty: true });
      toast("Backup restored and merged ✓");
      render();
    } catch (err) {
      toast(err.message, 5000);
    }
    return;
  }
  if (t.dataset.cand != null) {
    ui.candidates.items[Number(t.dataset.cand)].selected = t.checked;
    const btn = $('[data-action="add-selected"]');
    const n = ui.candidates.items.filter((i) => i.selected).length;
    btn.disabled = !n;
    btn.textContent = `Add ${plural(n, "word")} to master list`;
    return;
  }
  if (t.dataset.setting) {
    const k = t.dataset.setting;
    let v = t.type === "checkbox" ? t.checked : t.value.trim();
    if (k === "dailyCount") v = Math.min(50, Math.max(3, Number(v) || 10));
    store.update((s) => (s.settings[k] = v), { touchesData: false });
    if (k === "googleClientId") drive.disconnect();
    toast("Saved");
    if (k === "dailyCount" || k === "googleClientId" || k === "voice") render();
    return;
  }
  if (t.id === "sort") {
    ui.sort = t.value;
    render();
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    ui.search = e.target.value;
    render();
  }
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "editForm") return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = e.target.dataset.id;
  const existing = id ? store.byId(id) : null;
  const list = (s, sep) => String(s || "").split(sep).map((x) => x.trim()).filter(Boolean);
  const rec = {
    ...(existing ?? {}),
    word: fd.get("word").trim(),
    pos: fd.get("pos"),
    difficulty: fd.get("difficulty"),
    meaning: fd.get("meaning"),
    hindi: fd.get("hindi"),
    tamil: fd.get("tamil"),
    say: fd.get("say"),
    ipa: fd.get("ipa"),
    sentences: list(fd.get("sentences"), /\n/),
    synonyms: list(fd.get("synonyms"), /,/),
    antonyms: list(fd.get("antonyms"), /,/),
    examTip: fd.get("examTip"),
  };
  if (!existing) {
    const dup = findExisting(rec.word, buildIndex(store.liveWords()));
    if (dup?.exact) return toast(`“${dup.match.word}” is already in your list.`);
    store.addWords([{ ...rec, source: "Manual" }]);
  } else {
    store.saveWord(rec);
  }
  closeOverlay();
  render();
  toast("Saved ✓");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("#overlay").classList.contains("open")) actions.close();
  if (ui.session && !e.target.closest("input,textarea")) {
    if (e.key === " " && !ui.session.revealed) (e.preventDefault(), actions.reveal());
    const map = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
    if (ui.session.revealed && map[e.key]) actions.grade({ dataset: { g: map[e.key] } });
  }
});

store.subscribe(() => {
  updateSyncChip();
  scheduleAutoSync();
});

// ---------- start ----------
const initial = location.hash.slice(1);
if (VIEWS[initial]) view = initial;
render();
if (drive.isConnected()) sync();
window.addEventListener("online", () => scheduleAutoSync());
window.speechSynthesis?.getVoices(); // warm up the voice list

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
