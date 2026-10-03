import "./styles.css";
import * as store from "./lib/store.js";
import * as drive from "./lib/drive.js";
import { DEFAULT_MODEL, EXAMS } from "./lib/ai.js";
import { AllProvidersFailed, aiEnrichAll, aiList, fallbackNote, hasAI, pickedAI } from "./lib/engine.js";
import { SERVICES, extraServicesOf, serviceName, testService } from "./lib/compat.js";
import { GEMINI_AUTO, checkKey, geminiKeysOf, keyStatus, knownModels, looksLikeGeminiKey, pickedGeminiKey, pickedKeyNumber, testKey } from "./lib/gemini.js";
import { filesToSources, filesToText } from "./lib/extract.js";
import { candidatesFromText, difficultyFromLevel, isEasy, levelOf, loadLevels } from "./lib/difficulty.js";
import { enrichFree } from "./lib/freedict.js";
import { practiceReview, review, stage, stats, streak } from "./lib/srs.js";
import { isBankId, loadBank } from "./lib/bank.js";
import { coverage, markAsked, pickSession, recordAnswer, requeue, weakWords } from "./lib/practice.js";
import * as notify from "./lib/notify.js";
import * as install from "./lib/install.js";
import { brand } from "./brand.js";
import { applyBrand } from "./lib/theme.js";
import { isStaleFileError, liveVersion, reloadForUpdate, takeDraft } from "./lib/update.js";
import * as gs from "./lib/grammar-store.js";
import { loadRuleBook } from "./lib/rulebook.js";
import { rulesToCSV } from "./lib/rules.js";
import { createGrammarUI } from "./grammar-ui.js";
import * as gk from "./lib/gk-store.js";
import { itemsToCSV } from "./lib/gk.js";
import { createGkUI } from "./gk-ui.js";
import { createAreaUI } from "./area-ui.js";
import { maths as mathsStore, reasoning as reasonStore } from "./lib/quant-stores.js";
import { onSaveError } from "./lib/quant-store.js";
import { qItemsToCSV } from "./lib/quant.js";
import { createQuantUI } from "./quant-ui.js";
import { createCropper } from "./cropper.js";
import { createPrepare } from "./prepare-ui.js";
import {
  buildIndex,
  cleanHeadword,
  findExisting,
  needsEnrichment,
  parseTypedWords,
  parseVocabList,
  toCSV,
  todayISO,
  wordKey,
} from "./lib/words.js";

// ---------- tiny helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const settings = () => store.get().settings;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

let toastTimer;
function toast(msg, ms = 3200) {
  // A file from an older version of the app couldn't load: reload into the new version instead of showing it.
  if (isStaleFileError(msg)) {
    if (updateNow()) return;
    msg = "Part of the app couldn't load. Check your internet, then close and reopen the app.";
    ms = 7000;
  }
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

function speak(text, audioUrl) {
  if (audioUrl) {
    // Recorded pronunciation from the free dictionary; fall back to the phone's voice if it can't play.
    return new Audio(audioUrl).play().catch(() => speak(text));
  }
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
  setTimeout(() => URL.revokeObjectURL(a.href), 60000); // Android saves the file asynchronously
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
  wordsTab: "mine", // Words screen: "mine" | "bank"
  notifyStatus: "",
  section: "vocab", // which part of the app the tab bar shows: "vocab" | "grammar" | "gk" | "maths" | "reasoning"
  extraProvider: "openrouter", // service chosen in the "add another AI" form
  extraStatus: {}, // service id -> {ok, message} from the last key test
};

// ---------- shared word rendering ----------
/** Small ⓘ button that opens the full card for a word on top of the current screen. */
const infoBtn = (id, label = "Full details") =>
  `<button class="icon-btn info-btn" type="button" data-action="info" data-id="${esc(id)}" aria-label="${esc(label)}" title="${esc(label)}">ⓘ</button>`;

function wordHead(w, { big = false, info = false } = {}) {
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
      <div class="whead-btns">
        ${info ? infoBtn(w.id) : ""}
        <button class="icon-btn" type="button" data-action="speak" data-text="${esc(w.word)}" data-audio="${esc(w.audio)}" aria-label="Pronounce ${esc(w.word)}">🔊</button>
      </div>
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
const sourceSelect = (setting, value, extra = "") =>
  `<select data-setting="${setting}" ${extra}>${Object.entries(store.SOURCES)
    .map(([k, l]) => `<option value="${k}" ${value === k ? "selected" : ""}>${l} (${store.wordsFor(k).length})</option>`)
    .join("")}</select>`;

/** "Made by …" credit — shown only when a name is set in src/brand.js. */
function madeBy({ small = false } = {}) {
  if (!brand.madeBy) return "";
  const name = brand.madeByLink
    ? `<a href="${esc(brand.madeByLink)}" target="_blank" rel="noopener">${esc(brand.madeBy)}</a>`
    : esc(brand.madeBy);
  return `<p class="made-by ${small ? "small" : ""}">Made by <b>${name}</b>${brand.madeByNote ? `<span>${esc(brand.madeByNote)}</span>` : ""}</p>`;
}

// ---------- install as an app ----------
/** Slim "Install app" banner on Today, until installed or dismissed. */
function installBanner() {
  const state = install.state();
  if (state === "standalone" || state === "installed" || install.dismissed()) return "";
  const ready = state === "ready";
  return `
    <article class="card install-banner">
      <img src="./icon-192.png" alt="" width="44" height="44" />
      <div>
        <b>Install ${esc(brand.name)}</b>
        <p class="small muted">${ready ? "Opens like a normal app, works offline and sends your daily words." : install.manualSteps()}</p>
      </div>
      <div class="ib-actions">
        ${ready ? `<button class="btn primary small" type="button" data-action="install">📲 Install</button>` : ""}
        <button class="icon-btn" type="button" data-action="dismiss-install" aria-label="Hide">✕</button>
      </div>
    </article>`;
}

/** Settings card: always there, so the option can be found again after hiding the banner. */
function installCard() {
  const state = install.state();
  const body = {
    standalone: `<p>✅ You're using the installed app.</p>`,
    installed: `<p>✅ Installed. Open <b>${esc(brand.shortName || brand.name)}</b> from your home screen or app drawer.</p>`,
    ready: `<p class="muted">Add ${esc(brand.name)} to your home screen. It opens full-screen like a normal app, works offline, and is needed for the daily notification.</p>
      <button class="btn primary" type="button" data-action="install">📲 Install app</button>`,
    manual: `<p class="muted">${install.manualSteps()}</p>
      <p class="muted small">Already installed? Open it from your home screen. Chrome only shows an Install button in a normal Chrome tab.</p>`,
  }[state];
  return `<article class="card"><h3>📲 Install on your phone</h3>${body}</article>`;
}

function viewToday() {
  const s = store.get();
  const source = s.settings.dailySource;
  const pool = store.wordsFor(source);
  if (!pool.length) {
    return `${installBanner()}
      <section class="hero">
        <h1>Build your exam vocabulary, one page at a time.</h1>
        <p>${esc(brand.tagline)}</p>
        <p class="muted">Snap a newspaper editorial, upload a PDF or type words. Only the hard words are kept,
        with Hindi meanings, pronunciation and example sentences, plus a Word of the Day and a daily revision set.</p>
        <div class="stack">
          <button class="btn primary" data-nav="add" type="button">➕ Add your first words</button>
          <button class="btn" type="button" data-action="use-bank">📚 Start with the built-in Word Bank (${store.bankWords().length} words)</button>
          ${!hasAI(s.settings) ? `<p class="muted small">Works free out of the box. Word cards come from free online dictionaries.</p>` : ""}
        </div>
      </section>
      ${madeBy()}`;
  }
  const plan = store.todaysPlan();
  const st = stats(pool);
  const wotd = store.byId(plan.wotd);
  const planWords = plan.ids.map(store.byId).filter(Boolean);
  const done = planWords.filter((w) => plan.done[w.id]).length;
  const pct = planWords.length ? Math.round((done / planWords.length) * 100) : 0;
  const date = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const n = s.settings.notify;
  const two = n.enabled ? notify.wordsForDay(store.wordsFor(n.source)) : [];

  return `${installBanner()}
    <section class="today-head">
      <div>
        <p class="eyebrow">${esc(date)}</p>
        <h1>Today’s vocabulary</h1>
      </div>
      <div class="streak" title="Days in a row with revision">🔥 ${streak(s.activity)}</div>
    </section>
    <label class="source-line">Words from ${sourceSelect("dailySource", source, 'aria-label="Today\'s words from"')}</label>

    <section class="stats">
      <div><b>${st.total}</b><span>words</span></div>
      <div><b>${st.due}</b><span>due</span></div>
      <div><b>${st.learning}</b><span>learning</span></div>
      <div><b>${st.mastered}</b><span>mastered</span></div>
    </section>

    ${
      two.length
        ? `<article class="card two-words">
            <p class="eyebrow">🔔 Today’s 2 words</p>
            ${two
              .map(
                (w) => `<div class="tw" data-action="info" data-id="${w.id}"><b>${esc(w.word)} <span class="info-inline">ⓘ</span></b>
                  <span>${esc(w.meaning)}</span><span class="ph" lang="hi">${esc(w.hindi)}</span></div>`,
              )
              .join("")}
          </article>`
        : ""
    }

    ${
      wotd
        ? `<article class="card wotd">
            <p class="eyebrow">✨ Word of the Day${wotd.bank ? ` <span class="badge bank">Word Bank</span>` : ""}</p>
            ${wordHead(wotd, { big: true, info: true })}
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
          : `<p class="muted">Only ${plural(pool.length, "word")} in <b>${esc(store.SOURCES[source])}</b> — it's today's Word of the Day.
             Add more words, or take today's words from:</p>
             <div class="row wrap">
               <button class="btn small primary" type="button" data-action="set-daily-source" data-src="mixed">🔀 Mixed (my words + Word Bank)</button>
               <button class="btn small" type="button" data-action="set-daily-source" data-src="bank">📚 Word Bank</button>
             </div>`
      }
      ${done && done === planWords.length ? `<p class="done-msg">🎉 Done for today! Lock it in with a quick <a href="#" data-nav="practice">practice</a>.</p>` : ""}
    </article>
    ${madeBy()}`;
}

/** Short label for a key's state, from a real check (see checkKeysInBackground). */
function keyStateText(k) {
  const ks = keyStatus(k);
  if (ks.state === "invalid") return "not working";
  if (ks.state === "resting") return `limit reached · back ${new Date(ks.until).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  if (ks.state === "checking") return "checking…";
  if (ks.state === "ok") return "works ✓";
  return "not checked yet";
}

const KEY_BADGE = { invalid: "easy", resting: "learning", ok: "mastered", checking: "new", unchecked: "new" };

/** True from a tap on a file / camera button until the picker closes (see checkKeysInBackground). */
let filePickerOpen = false;
let pickerTimer;
document.addEventListener(
  "click",
  (e) => {
    const input = e.target.closest?.("label")?.querySelector('input[type="file"]') ?? (e.target.matches?.('input[type="file"]') ? e.target : null);
    if (!input) return;
    filePickerOpen = true;
    clearTimeout(pickerTimer);
    pickerTimer = setTimeout(() => (filePickerOpen = false), 5 * 60 * 1000);
  },
  true,
);
const pickerClosed = () => {
  clearTimeout(pickerTimer);
  pickerTimer = setTimeout(() => (filePickerOpen = false), 1000);
};
document.addEventListener("change", (e) => e.target.type === "file" && pickerClosed(), true);
document.addEventListener("cancel", (e) => e.target.type === "file" && pickerClosed(), true);
window.addEventListener("focus", () => filePickerOpen && setTimeout(pickerClosed, 1500));

/**
 * Check every key and service for real when Settings or Add is open (each at most every 10 minutes),
 * then refresh the screen — without wiping anything being typed.
 */
function checkKeysInBackground() {
  const s = settings();
  const refresh = (ran) => {
    if (!ran || !["settings", "add", "g-add", "k-add", "m-add", "r-add"].includes(view) || ui.busy || ui.candidates) return;
    // Redrawing while the camera / file picker is open would replace its <input>, and the chosen photo would be lost.
    if (filePickerOpen) return setTimeout(() => refresh(ran), 2000);
    if (grammar.gui.busy || grammar.gui.candidates || gkui.gui.busy || gkui.gui.candidates || QPARTS.some((q) => q.ui.gui.busy || q.ui.gui.candidates)) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;
    if ($("#typed")) ui.typedDraft = $("#typed").value;
    if ($("#gTyped")) grammar.gui.typedDraft = $("#gTyped").value;
    if ($("#kTyped")) gkui.gui.typedDraft = $("#kTyped").value;
    if ($("#kTopic")) gkui.gui.topicDraft = $("#kTopic").value;
    for (const q of QPARTS) {
      if ($(`#${q.prefix}Typed`)) q.ui.gui.typedDraft = $(`#${q.prefix}Typed`).value;
      if ($(`#${q.prefix}Topic`)) q.ui.gui.topicDraft = $(`#${q.prefix}Topic`).value;
    }
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  };
  for (const k of geminiKeysOf(s)) checkKey(k).then(refresh);
  for (const e of extraServicesOf(s)) {
    if (ui.extraStatus[e.id]) continue;
    ui.extraStatus[e.id] = { ok: false, checking: true, message: "Checking…" };
    testService(e).then((r) => {
      ui.extraStatus[e.id] = r;
      refresh(true);
    });
  }
}

/** Choose which AI scans and writes cards: Auto (all of them in order) or one Gemini key / one service by hand. */
function keyPicker() {
  const s = settings();
  const keys = geminiKeysOf(s);
  const extras = extraServicesOf(s);
  if (keys.length + extras.length < 2) return "";
  const picked = pickedAI(s);
  const pickedKey = pickedGeminiKey(s);
  const value = picked?.kind === "extra" ? `x:${picked.entry.id}` : pickedKey ? `g:${keys.indexOf(pickedKey)}` : "";
  const opts = [
    ["", "Auto — use them in order, switch when one runs out"],
    ...keys.map((k, i) => [`g:${i}`, `Gemini key ${i + 1} only (${k.slice(0, 4)}…${k.slice(-4)}) · ${keyStateText(k)}`]),
    ...extras.map((e) => {
      const st = ui.extraStatus[e.id];
      return [`x:${e.id}`, `${serviceName(s, e)} only${st ? ` · ${st.checking ? "checking…" : st.ok ? "works ✓" : "not working"}` : ""}`];
    }),
  ];
  const name = picked?.kind === "extra" ? serviceName(s, picked.entry) : pickedKey ? `Gemini key ${keys.indexOf(pickedKey) + 1}` : "";
  return `
    <label class="field key-pick">🔑 AI for scanning & adding
      <select data-keypick>
        ${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`).join("")}
      </select>
    </label>
    ${name ? `<p class="muted small">Only ${esc(name)} is used. If it runs out, choose another or Auto (the free dictionary fills in meanwhile).</p>` : ""}`;
}

function viewAdd() {
  const s = settings();
  if (ui.busy) {
    return `<section class="card center busy"><div class="spinner" aria-hidden="true"></div><p>${esc(ui.busy)}</p></section>`;
  }
  if (ui.candidates) return viewCandidates();
  const aiOn = hasAI(s);
  const nKeys = geminiKeysOf(s).length;
  const pickN = pickedKeyNumber(s);
  const picked = pickedAI(s);
  const aiName =
    picked?.kind === "extra"
      ? serviceName(s, picked.entry)
      : pickN
        ? `Gemini key ${pickN}`
        : [
            nKeys && (nKeys > 1 ? `Gemini ×${nKeys} keys` : "Gemini"),
            ...extraServicesOf(s).map((e) => serviceName(s, e)),
            s.apiKey && "Claude",
          ]
            .filter(Boolean)
            .join(" → ");
  return `
    <h1>Add words</h1>
    <p class="mode ${aiOn ? "on" : "off"}">
      ${
        aiOn
          ? `🤖 <b>AI mode (${aiName} → free dictionary)</b> — AI picks the hard words (${esc(EXAMS[s.exam] ?? EXAMS.general)}) and writes Hindi meaning, pronunciation, 2 sentences & an exam tip. If one fails or hits its limit, the next takes over.`
          : `🆓 <b>Free mode</b> — hard words are picked with a word-frequency list; meaning, Hindi, pronunciation, audio and examples come from free online dictionaries. (Tip: <a href="#" data-nav="settings">add a free Gemini key</a> for exam tips and richer cards.)`
      }
    </p>
    ${keyPicker()}

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

/** Which AI wrote these cards, and why any came from the free dictionary — always visible, never just a toast. */
function aiBanner(ai) {
  if (!ai) return "";
  const by = ai.usedBy?.length ? ai.usedBy.join(" + ") : "";
  const fellBack = ai.failed > 0 || !by;
  return `<div class="ai-banner ${fellBack ? "warn" : "ok"}">
    ${by ? `🤖 Cards written by <b>${esc(by)}</b>.` : "📖 The AI wasn't used — cards came from the free dictionary."}
    ${ai.failed && by ? ` ${plural(ai.failed, "word")} came from the free dictionary.` : ""}
    ${ai.notes?.length ? `<span class="small block">${esc(ai.notes.join(" · "))}</span>` : ""}
  </div>`;
}

function viewCandidates() {
  const c = ui.candidates;
  const selected = c.items.filter((i) => i.selected).length;
  const skipped = c.skipped || [];
  return `
    <div class="row between">
      <h1>Review words</h1>
      <button class="btn small ghost" type="button" data-action="cancel-candidates">Cancel</button>
    </div>
    <p class="muted">${plural(c.items.length, "new word")} to review. Untick any you don't need.</p>
    ${aiBanner(c.ai)}
    ${
      skipped.length
        ? `<p class="muted small">Skipped ${plural(skipped.length, "word")} already in your master list: ${esc(skipped.slice(0, 12).join(", "))}${skipped.length > 12 ? "…" : ""}</p>`
        : ""
    }
    <div class="row">
      <button class="btn small" type="button" data-action="select-all">Select all new</button>
      <button class="btn small" type="button" data-action="select-hard">Only hard (●●●+)</button>
      <button class="btn small" type="button" data-action="select-none">Clear</button>
    </div>
    <ul class="cand-list">
      ${c.items
        .map(
          (it, i) => `
        <li class="cand ${it.status}">
          <label>
            <input type="checkbox" data-cand="${i}" ${it.selected ? "checked" : ""} />
            <span class="cand-body">
              <span class="cand-top">
                <b>${esc(it.rec.word)}</b>
                ${it.rec.say ? `<span class="say">${esc(it.rec.say)}</span>` : ""}
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

const PRACTICE_KINDS = [
  ["mixed", "🎲", "Mixed", "A bit of everything"],
  ["meaning", "📖", "Word → Meaning", "Pick the right meaning"],
  ["hindi", "🇮🇳", "Word → Hindi", "Pick the Hindi meaning"],
  ["reverse", "🔁", "Meaning → Word", "One-word substitution"],
  ["blank", "✏️", "Fill in the blank", "Cloze test practice"],
  ["synonym", "🔗", "Synonyms", "Closest in meaning"],
  ["antonym", "↔️", "Antonyms", "Opposite in meaning"],
];

function viewPractice() {
  if (ui.quiz) return viewQuiz();
  const st = settings();
  const source = st.practiceSource;
  const pool = store.wordsFor(source).filter((w) => w.meaning);
  const cov = coverage(pool, store.get().practice, source);
  const weak = weakWords(pool, store.get().practice);
  const pct = cov.total ? Math.round((cov.covered / cov.total) * 100) : 0;
  return `
    <h1>Practice</h1>
    <p class="muted">Random questions that still cover <b>every</b> word before any repeats. Wrong answers come back a few
    questions later — and in later sessions until you get them right twice in a row.</p>

    <article class="card">
      <label class="field">Practise words from ${sourceSelect("practiceSource", source)}</label>
      ${
        pool.length >= 4
          ? `<p class="small">Round ${cov.round}: <b>${cov.covered}</b> of ${cov.total} words covered</p>
             <div class="progress"><span style="width:${pct}%"></span></div>
             <p class="small">${
               weak.length
                 ? `⚠️ <b>${plural(weak.length, "weak word")}</b> to fix: ${esc(weak.slice(0, 8).map((w) => w.word).join(", "))}${weak.length > 8 ? "…" : ""}`
                 : "✅ No weak words right now."
             }</p>`
          : `<p>You need at least 4 words with meanings here (found ${pool.length}). Try the <b>Word Bank</b> or <b>Mixed</b>.</p>`
      }
      <label class="field">Questions per session
        <select data-setting="practiceSize">${[10, 20, 30, 50]
          .map((n) => `<option value="${n}" ${Number(st.practiceSize) === n ? "selected" : ""}>${n}</option>`)
          .join("")}</select>
      </label>
    </article>

    ${
      pool.length >= 4
        ? `<div class="quiz-grid">
            ${PRACTICE_KINDS.map(
              ([k, ico, t, d]) =>
                `<button class="quiz-tile" type="button" data-action="start-quiz" data-kind="${k}"><span class="big-ico">${ico}</span><b>${t}</b><span>${d}</span></button>`,
            ).join("")}
          </div>
          ${weak.length ? `<button class="btn block" type="button" data-action="start-quiz" data-kind="mixed" data-weak="1">🎯 Fix my ${plural(weak.length, "weak word")}</button>` : ""}`
        : ""
    }`;
}

function viewQuiz() {
  const q = ui.quiz;
  if (q.i >= q.queue.length) {
    const wrong = [...new Set(q.wrong)].map(store.byId).filter(Boolean);
    const pool = store.wordsFor(q.source).filter((w) => w.meaning);
    const cov = coverage(pool, store.get().practice, q.source);
    return `
      <article class="card center">
        <p class="eyebrow">Session complete</p>
        <p class="score">${q.score}/${q.answered}</p>
        <p>${q.score === q.answered ? "Perfect! 🏆" : q.score >= q.answered * 0.7 ? "Great work 💪" : "Keep going — the weak words will come back 📈"}</p>
        <p class="small muted">Round ${cov.round}: ${cov.covered} of ${cov.total} words covered</p>
        ${wrong.length ? `<p class="muted">Will come back (tap for details): ${wrong.map((w) => `<a href="#" data-action="info" data-id="${w.id}">${esc(w.word)} ⓘ</a>`).join(", ")}</p>` : ""}
        <div class="row center">
          <button class="btn primary" type="button" data-action="start-quiz" data-kind="${q.kind}">Next session</button>
          <button class="btn" type="button" data-action="end-quiz">Done</button>
        </div>
      </article>`;
  }
  const cur = q.current;
  return `
    <div class="row between">
      <span class="muted">Question ${q.i + 1} of ${q.queue.length} · ${esc(store.SOURCES[q.source])}</span>
      <button class="btn small ghost" type="button" data-action="end-quiz">Finish</button>
    </div>
    <div class="progress"><span style="width:${(q.i / q.queue.length) * 100}%"></span></div>
    <article class="card quiz-card">
      <p class="eyebrow">${esc(cur.label)}${cur.retry ? ` <span class="badge learning">again</span>` : ""}</p>
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
      ${
        q.picked != null
          ? `<div class="explain ${q.picked === cur.answer ? "ok" : "bad"}">
               <p class="small"><b>${q.picked === cur.answer ? "✓" : "✗"} ${esc(cur.word)}</b> — ${esc(cur.meaning)}${cur.hindi ? ` · <span lang="hi">${esc(cur.hindi)}</span>` : ""}</p>
               ${infoBtn(cur.wordId)}
             </div>
             <button class="btn primary block" type="button" data-action="next-q">${q.i + 1 < q.queue.length ? "Next →" : "See score"}</button>`
          : ""
      }
    </article>`;
}

const WORDS_SHOWN = 150; // keep the page light: search narrows the Word Bank

function viewWords() {
  const bankTab = ui.wordsTab === "bank";
  const all = bankTab ? store.bankWords() : store.liveWords();
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
  list = [...list].sort(sorters[bankTab && ui.sort === "newest" ? "az" : ui.sort]);
  const total = list.length;
  list = list.slice(0, WORDS_SHOWN);
  const filters = [
    ["all", "All"],
    ["new", "New"],
    ["learning", "Learning"],
    ["mastered", "Mastered"],
    ["starred", "★ Starred"],
    ["incomplete", "Needs details"],
  ];
  return `
    <div class="seg" role="tablist">
      <button type="button" class="${bankTab ? "" : "active"}" data-action="words-tab" data-tab="mine">My words (${store.liveWords().length})</button>
      <button type="button" class="${bankTab ? "active" : ""}" data-action="words-tab" data-tab="bank">📚 Word Bank (${store.bankWords().length})</button>
    </div>
    <div class="row between">
      <h1>${bankTab ? "Word Bank" : "Master list"} <span class="muted">(${all.length})</span></h1>
      ${bankTab ? "" : `<button class="btn small" type="button" data-action="new-word">＋ New</button>`}
    </div>
    ${bankTab ? `<p class="muted small">Built-in exam words for learning and practice. They stay separate from your own list — tap “＋ Add to my words” on any word to copy it.</p>` : ""}
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
      ${needs ? `<button class="btn small" type="button" data-action="enrich-missing">${hasAI(settings()) ? "🤖" : "📖"} Fill ${needs} missing</button>` : ""}
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
    ${total > list.length ? `<p class="muted small center">Showing ${list.length} of ${total} — type in the search box to find any word.</p>` : ""}
    ${
      bankTab
        ? ""
        : `<div class="row wrap">
      <button class="btn small" type="button" data-action="export-csv">⬇ CSV (Excel)</button>
      <button class="btn small" type="button" data-action="export-json">⬇ Backup</button>
      <label class="btn small">⬆ Restore backup<input type="file" accept="application/json,.json" data-input="import" hidden /></label>
    </div>`
    }`;
}

/** Settings card: other free AI services (OpenRouter, Groq, Mistral, Cerebras, any OpenAI-compatible one). */
function extraServicesCard(st) {
  const list = extraServicesOf(st);
  const svc = SERVICES[ui.extraProvider] || SERVICES.openrouter;
  return `
    <article class="card">
      <h3>🧩 More free AI services <span class="badge">optional</span></h3>
      <p class="muted">Add free keys from other AI services as extra backups. They're used after Gemini, in this order,
      and each picks its own best free model automatically — new models are picked up without an app update.</p>
      ${
        list.length
          ? `<ul class="key-list">${list
              .map((e) => {
                const st2 = ui.extraStatus[e.id];
                const badge = st2
                  ? `<span class="badge ${st2.checking ? "new" : st2.ok ? "mastered" : "easy"}">${st2.checking ? "checking…" : st2.ok ? "works ✓" : "not working"}</span>`
                  : "";
                return `<li class="svc">
                  <div><b>${esc(serviceName(st, e))}</b> <code>${esc(e.key.slice(0, 4))}…${esc(e.key.slice(-4))}</code> ${badge}
                    ${st2 ? `<span class="muted small block">${esc(st2.message)}</span>` : ""}
                    <label class="small muted">Model <input type="text" class="model-in" data-extra-model="${esc(e.id)}" value="${esc(e.model && e.model !== "auto" ? e.model : "")}" placeholder="auto — best free model" autocomplete="off" /></label>
                  </div>
                  <button class="icon-btn small" type="button" data-action="test-extra-ai" data-id="${esc(e.id)}" aria-label="Test">⟳</button>
                  <button class="icon-btn small" type="button" data-action="remove-extra-ai" data-id="${esc(e.id)}" aria-label="Remove">✕</button>
                </li>`;
              })
              .join("")}</ul>`
          : ""
      }
      <label class="field">Service
        <select data-extra-provider>
          ${Object.entries(SERVICES)
            .map(([k, v]) => `<option value="${k}" ${ui.extraProvider === k ? "selected" : ""}>${esc(v.label)}</option>`)
            .join("")}
        </select>
      </label>
      <p class="muted small">${esc(svc.note)}${svc.keys ? ` Free key: <a href="${esc(svc.keys)}" target="_blank" rel="noopener">${esc(svc.keys.replace(/^https:\/\//, ""))}</a>` : ""}</p>
      ${ui.extraProvider === "custom" ? `<label class="field">API address<input type="url" id="newExtraBase" placeholder="https://…/v1" autocomplete="off" /></label>` : ""}
      <div class="row"><input type="password" id="newExtraKey" placeholder="Paste the API key" autocomplete="off" />
        <button class="btn small primary" type="button" data-action="add-extra-ai">Add</button></div>
      <p class="muted small">Keys stay on this phone and are never put in backups.</p>
    </article>`;
}

function viewSettings() {
  const s = store.get();
  const st = s.settings;
  const connected = drive.isConnected();
  const last = s.drive.lastSync ? new Date(s.drive.lastSync).toLocaleString("en-IN") : "never";
  return `
    <h1>Settings</h1>
    ${installCard()}

    <article class="card">
      <h3>🏠 Start screen</h3>
      <label class="field">When the app opens
        <select data-setting="startSection">
          ${[
            ["ask", "Show the choice of parts"],
            ["vocab", "Go straight to Vocabulary"],
            ["grammar", "Go straight to Grammar"],
            ["gk", "Go straight to GK"],
            ["maths", "Go straight to Maths"],
            ["reasoning", "Go straight to Reasoning"],
            ["last", "Where I left off"],
          ]
            .map(([v, l]) => `<option value="${v}" ${st.startSection === v ? "selected" : ""}>${l}</option>`)
            .join("")}
        </select>
      </label>
      <button class="btn small" type="button" data-nav="home">Open the start screen</button>
    </article>

    <article class="card">
      <h3>📷 Photos & PDFs</h3>
      <label class="toggle"><input type="checkbox" data-setting="cropStep" ${st.cropStep !== false ? "checked" : ""} /> Offer to crop before reading</label>
      <p class="muted small">After you take a photo or pick photos / a PDF on any Add screen (Vocabulary, Grammar, GK, Maths, Reasoning): crop, turn or leave out photos, and crop or skip PDF pages.</p>
    </article>


    <article class="card">
      <h3>📖 Word cards</h3>
      <p class="muted">Order used: ${[geminiKeysOf(st).length && `<b>Gemini</b> (free${geminiKeysOf(st).length > 1 ? `, ${geminiKeysOf(st).length} keys` : ""})`, st.apiKey && "<b>Claude</b> (paid)", "<b>free dictionaries</b>"].filter(Boolean).join(" → ")}.
      If one fails or hits its limit, the next one takes over automatically.</p>
      <p class="muted small">Free dictionaries: meaning, pronunciation, audio, synonyms and examples from Wiktionary; Hindi/Tamil via MyMemory translation (a few hundred words a day).</p>
      <label class="field">Exam focus
        <select data-setting="exam">
          ${Object.entries(EXAMS).map(([k, v]) => `<option value="${k}" ${st.exam === k ? "selected" : ""}>${esc(v)}</option>`).join("")}
        </select>
      </label>
      <label class="toggle"><input type="checkbox" data-setting="tamil" ${st.tamil ? "checked" : ""} /> Also add Tamil meaning (தமிழ்)</label>
    </article>

    <article class="card">
      <h3>✨ Google Gemini <span class="badge">free tier</span></h3>
      <p class="muted">Free AI word cards with exam tips. Get a free key (no card needed) at
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> → <i>Create API key</i> (new keys start with <code>AQ.</code>).
      The free tier has daily limits; when they run out the app switches to your other keys and services, then the free dictionary.
      Google may use free-tier inputs to improve its products — fine for textbook pages, avoid personal documents.</p>
      <div class="field">Gemini API keys (tried in order; when one hits its limit the next is used)
        ${geminiKeysOf(st).length
          ? `<ul class="key-list">${geminiKeysOf(st)
              .map((k, i) => {
                const ks = keyStatus(k);
                const label = `<span class="badge ${KEY_BADGE[ks.state]}">${esc(keyStateText(k))}</span>${k === pickedGeminiKey(st) ? ` <span class="badge new">in use</span>` : ""}`;
                return `<li class="svc"><div><code>Key ${i + 1}: ${esc(k.slice(0, 4))}…${esc(k.slice(-4))}</code> ${label}
                  ${ks.state === "invalid" && ks.message ? `<span class="small error block">${esc(ks.message)}</span>` : ""}</div>
                  <button class="icon-btn small" type="button" data-action="remove-gemini-key" data-i="${i}" aria-label="Remove key ${i + 1}">✕</button></li>`;
              })
              .join("")}</ul>`
          : ""}
        <div class="row"><input type="password" id="newGeminiKey" placeholder="Paste a key: AQ.… or AIza…" autocomplete="off" />
          <button class="btn small primary" type="button" data-action="add-gemini-key">Add</button></div>
      </div>
      ${keyPicker()}
      <label class="field">Model
        <select data-setting="geminiModel">
          ${[
            [GEMINI_AUTO, "Auto · newest free model (recommended)"],
            ...[...new Set([...knownModels(), st.geminiModel].filter((m) => m && m !== GEMINI_AUTO))].map((m) => [
              m,
              m.replace(/^gemini-/, "").replace(/-/g, " ") + (m.includes("-lite") ? " · more per day" : ""),
            ]),
          ]
            .map(([v, l]) => `<option value="${esc(v)}" ${st.geminiModel === v ? "selected" : ""}>${esc(l)}</option>`)
            .join("")}
        </select>
      </label>
    </article>

    ${extraServicesCard(st)}

    <article class="card">
      <h3>🤖 Claude AI <span class="badge">optional · paid</span></h3>
      <p class="muted">Backup when Gemini is unavailable (or leave empty to stay free). Best quality for handwriting and idioms.
      Pay-per-use key from
      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>; stored only on this device.</p>
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
    </article>

    <article class="card">
      <h3>📅 Daily practice</h3>
      <label class="field">Words to memorise per day
        <input type="number" min="3" max="50" data-setting="dailyCount" value="${st.dailyCount}" />
      </label>
      <label class="field">Today’s words come from ${sourceSelect("dailySource", st.dailySource)}</label>
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

    ${grammar.prefsCard()}
    ${gkui.prefsCard()}
    ${QPARTS.map((q) => q.ui.prefsCard()).join("")}

    <article class="card">
      <h3>🔔 Daily notification</h3>
      <p class="muted">Get <b>2 words for today</b> as a phone notification, rotating through every word of the chosen source.</p>
      <label class="toggle"><input type="checkbox" data-notify="enabled" ${st.notify.enabled ? "checked" : ""} /> Send me 2 words every day</label>
      <div class="two">
        <label class="field">After
          <select data-notify="hour">${Array.from({ length: 17 }, (_, i) => i + 6)
            .map((h) => `<option value="${h}" ${Number(st.notify.hour) === h ? "selected" : ""}>${h <= 12 ? h : h - 12}:00 ${h < 12 ? "am" : "pm"}</option>`)
            .join("")}</select>
        </label>
        <label class="field">Words from
          <select data-notify="source">${Object.entries(store.SOURCES)
            .map(([k, l]) => `<option value="${k}" ${st.notify.source === k ? "selected" : ""}>${l}</option>`)
            .join("")}</select>
        </label>
      </div>
      <p class="small" id="notifyStatus">${esc(ui.notifyStatus || "")}</p>
      <button class="btn small" type="button" data-action="test-notify">🔔 Send test notification</button>
    </article>

    <article class="card">
      <h3>☁️ Google Drive</h3>
      <p class="muted">Your master list is saved in a <b>${drive.FOLDER_NAME}</b> folder in your Drive: <code>${drive.JSON_NAME}</code>, <code>${drive.GRAMMAR_JSON}</code>, <code>${drive.GK_JSON}</code>, <code>${drive.MATHS_JSON}</code> and <code>${drive.REASONING_JSON}</code> (used by the app)
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
      <h3>🗂️ Vocabulary data <span class="badge">separate backup</span></h3>
      <div class="row wrap">
        <button class="btn small" type="button" data-action="export-json">⬇ Download backup</button>
        <label class="btn small">⬆ Restore backup<input type="file" accept="application/json,.json" data-input="import" hidden /></label>
        <button class="btn small danger" type="button" data-action="reset">Erase data on this device</button>
      </div>
    </article>
    ${grammar.dataCard()}
    ${gkui.dataCard()}
    ${QPARTS.map((q) => q.ui.dataCard()).join("")}
    <article class="card about">
      <img src="./icon.svg" alt="" width="52" height="52" />
      <h3>${esc(brand.name)}</h3>
      <p class="muted small">${esc(brand.tagline)}</p>
      ${madeBy()}
      <p class="muted small">Version ${esc(typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev")}<br />
      Word frequency data from SCOWL (© Kevin Atkinson)</p>
    </article>`;
}

// ---------- overlays (word details, editor, flashcards) ----------
function openOverlay(html, { tall = false, full = false } = {}) {
  const o = $("#overlay");
  const wasOpen = o.classList.contains("open");
  o.innerHTML = `<div class="sheet ${tall ? "tall" : ""} ${full ? "full" : ""} ${wasOpen ? "no-anim" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  o.classList.add("open");
  document.body.classList.add("no-scroll");
}
function closeOverlay() {
  const o = $("#overlay");
  o.classList.remove("open");
  o.innerHTML = "";
  document.body.classList.remove("no-scroll");
  ui.session = null;
  cropper.onCloseOverlay();
  prepare.onCloseOverlay();
  grammar?.onCloseOverlay();
  gkui?.onCloseOverlay();
  for (const q of QPARTS) q.ui.onCloseOverlay();
}

function showWord(id) {
  const w = store.byId(id);
  if (!w) return;
  const next = stage(w) === "new" ? "not started" : new Date(`${w.due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  openOverlay(`
    <div class="sheet-bar"><span class="badge ${stage(w)}">${STAGE_LABEL[stage(w)]}</span><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
    ${wordHead(w, { big: true })}
    ${wordDetails(w)}
    <p class="muted small">Next review: ${esc(next)} · Reviewed ${plural(w.reviews, "time")} · ${
      w.bank ? "From the built-in Word Bank" : `Difficulty ${w.difficulty}/5 · Added ${esc(w.addedAt.slice(0, 10))}`
    }</p>
    ${
      w.bank
        ? `<div class="row wrap">
            <button class="btn small" type="button" data-action="star" data-id="${w.id}">${w.starred ? "★ Unstar" : "☆ Star"}</button>
            ${
              buildIndex(store.liveWords()).has(wordKey(w.word))
                ? `<span class="badge mastered">In your list</span>`
                : `<button class="btn small primary" type="button" data-action="add-to-mine" data-id="${w.id}">＋ Add to my words</button>`
            }
          </div>`
        : `<div class="row wrap">
      <button class="btn small" type="button" data-action="star" data-id="${w.id}">${w.starred ? "★ Unstar" : "☆ Star"}</button>
      <button class="btn small" type="button" data-action="edit-word" data-id="${w.id}">✎ Edit</button>
      ${
        hasAI(settings())
          ? `<button class="btn small" type="button" data-action="enrich-one" data-id="${w.id}">🤖 ${needsEnrichment(w) ? "Fill" : "Refresh"} with AI</button>`
          : needsEnrichment(w)
            ? `<button class="btn small" type="button" data-action="enrich-one" data-id="${w.id}">📖 Fill from dictionary</button>`
            : ""
      }
      <button class="btn small danger" type="button" data-action="delete-word" data-id="${w.id}">Delete</button>
    </div>`
    }`);
}

/** Full card for one word in a layer above everything (flashcards, practice…); closing returns to where you were. */
function showInfo(id) {
  const w = store.byId(id);
  if (!w) return toast("That word is no longer in your list.");
  const layer = $("#info");
  const next = stage(w) === "new" ? "not started" : new Date(`${w.due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const inMine = buildIndex(store.liveWords()).has(wordKey(w.word));
  const weak = store.get().practice.weak[w.id];
  layer.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Details for ${esc(w.word)}">
    <div class="sheet-bar">
      <span>${w.bank ? `<span class="badge bank">Word Bank</span> ` : ""}<span class="badge ${stage(w)}">${STAGE_LABEL[stage(w)]}</span></span>
      <button class="icon-btn" type="button" data-action="close-info" aria-label="Close">✕</button>
    </div>
    ${wordHead(w, { big: true })}
    ${wordDetails(w)}
    <p class="muted small">Next review: ${esc(next)} · Reviewed ${plural(w.reviews, "time")}${
      weak ? ` · Practice: ${weak.right} right, ${weak.wrong} wrong${weak.need ? " (still weak)" : ""}` : ""
    }</p>
    <div class="row wrap">
      ${w.bank && !inMine ? `<button class="btn small primary" type="button" data-action="info-add" data-id="${esc(w.id)}">＋ Add to my words</button>` : ""}
      ${w.bank && inMine ? `<span class="badge mastered">In your list</span>` : ""}
      <button class="btn small" type="button" data-action="close-info">Back</button>
    </div>
  </div>`;
  layer.classList.add("open");
}

function closeInfo() {
  const layer = $("#info");
  layer.classList.remove("open");
  layer.innerHTML = "";
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
      ${!w ? `<p class="muted small center">Tip: just type the word in the Add tab and the app fills everything in.</p>` : ""}
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
      ${wordHead(w, { big: true, info: ss.revealed })}
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
  if (!ss.revealed && ss.autoSpeak) speak(w.word, w.audio);
}

// ---------- quiz ----------
const QUIZ_LABELS = {
  meaning: "Choose the correct meaning",
  hindi: "सही हिंदी अर्थ चुनें",
  reverse: "Which word means…",
  blank: "Fill in the blank",
  synonym: "Choose the closest synonym",
  antonym: "Choose the opposite (antonym)",
};

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Build one multiple-choice question; wrong options come from the same pool, same part of speech first. */
function makeQuestion(w, kind, pool) {
  const pos = (x) => String(x.pos || "").toLowerCase().split(/[ ,/]/)[0];
  const others = shuffle(pool.filter((o) => o.id !== w.id)).sort((a, b) => Number(pos(b) === pos(w)) - Number(pos(a) === pos(w)));
  const pick = (field, n = 3) => [...new Set(others.map((o) => o[field]).filter((x) => x && x !== w[field]))].slice(0, n);
  const build = (correct, wrongs) => {
    if (!correct || wrongs.length < 3) return null;
    const options = shuffle([correct, ...wrongs.slice(0, 3)]);
    return { options, answer: options.indexOf(correct) };
  };
  const head = `<span class="qword">${esc(w.word)}</span>${w.pos ? ` <span class="pos">${esc(w.pos)}</span>` : ""}`;
  const own = new Set([w.word, ...w.synonyms, ...w.antonyms].map((x) => x.toLowerCase()));
  const outsiders = () => [...new Set(others.flatMap((o) => [o.word, ...o.synonyms]).filter((x) => !own.has(x.toLowerCase())))];
  let b = null;
  let prompt = head;
  if (kind === "meaning") b = build(w.meaning, pick("meaning"));
  if (kind === "hindi") b = build(w.hindi, pick("hindi"));
  if (kind === "reverse") {
    b = build(w.word, pick("word"));
    prompt = `<span class="qmeaning">${esc(w.meaning)}</span>`;
  }
  if (kind === "blank") {
    const sentence = w.sentences.map((x) => blankOut(x, w.word)).find(Boolean);
    if (sentence) {
      b = build(w.word, pick("word"));
      prompt = `<span class="qsentence">${sentence}</span>`;
    }
  }
  if (kind === "synonym" && w.synonyms.length) b = build(shuffle(w.synonyms)[0], outsiders());
  if (kind === "antonym" && w.antonyms.length) b = build(shuffle(w.antonyms)[0], [...w.synonyms, ...outsiders()]);
  return b && { ...b, prompt, kind, label: QUIZ_LABELS[kind], wordId: w.id, word: w.word, meaning: w.meaning, hindi: w.hindi };
}

const ALL_KINDS = ["meaning", "hindi", "reverse", "blank", "synonym", "antonym"];

/** Question for the word at the current position (tries other types when a word lacks the data). */
function questionFor(q, pool, retry = false) {
  while (q.i < q.queue.length) {
    const w = pool.find((x) => x.id === q.queue[q.i]) || store.byId(q.queue[q.i]);
    const kinds = q.kind === "mixed" || retry ? shuffle(ALL_KINDS) : [q.kind, ...shuffle(ALL_KINDS)];
    const made = w && kinds.map((k) => makeQuestion(w, k, pool)).find(Boolean);
    if (made) return { ...made, retry };
    // Not enough details for any question: skip it, but count it as asked so it can't hold up coverage.
    if (w) store.update((s) => (s.practice = markAsked(s.practice, w.id)), { touchesData: false });
    q.queue.splice(q.i, 1);
  }
  return null;
}

function startQuiz(kind, { weakOnly = false } = {}) {
  const st = settings();
  const source = st.practiceSource;
  const pool = store.wordsFor(source).filter((w) => w.meaning);
  if (pool.length < 4) return toast("Need at least 4 words with meanings for practice.");
  const size = Number(st.practiceSize) || 20;
  let ids;
  if (weakOnly) {
    ids = shuffle(weakWords(pool, store.get().practice).map((w) => w.id)).slice(0, size);
  } else {
    ids = pickSession(pool, store.get().practice, source, size).ids;
  }
  ui.quiz = { kind, source, queue: ids, i: 0, picked: null, score: 0, answered: 0, wrong: [], requeued: new Set(), pool };
  ui.quiz.current = questionFor(ui.quiz, pool);
  if (!ui.quiz.current) {
    ui.quiz = null;
    return toast("Not enough word details for this question type yet.");
  }
  render();
}

// ---------- add pipeline ----------
function setBusy(text) {
  ui.busy = text;
  if (view === "add") render();
}

/**
 * Build the review list. Repeats and words already in the master list are left out (only counted);
 * forms of a saved word ("mitigated" vs "mitigate") are shown but unticked.
 * @returns {{items: object[], skipped: string[]}}
 */
function prepareCandidates(records, { typed = false, levels = null } = {}) {
  const index = buildIndex(store.liveWords());
  const seen = new Set();
  const items = [];
  const skipped = [];
  for (const rec of records) {
    const key = wordKey(rec.word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const ex = findExisting(key, index);
    if (ex?.exact) {
      skipped.push(ex.match.word);
      continue;
    }
    const easy = typed && levels ? isEasy(key, levels) : false;
    const status = ex ? "similar" : "new";
    items.push({ rec, status, similarTo: ex?.match.word, easy, selected: status === "new" && (typed || !easy) });
  }
  items.sort((a, b) => Number(a.status === "similar") - Number(b.status === "similar"));
  return { items, skipped };
}

/** Open the review screen, or just report when everything was already saved. */
function showCandidates(records, opts = {}) {
  const { items, skipped } = prepareCandidates(records, opts);
  if (!items.length) {
    ui.candidates = null;
    toast(skipped.length ? (skipped.length === 1 ? `“${skipped[0]}” is already in your master list ✓` : `All ${skipped.length} words are already in your master list ✓`) : "No words found. Try a clearer photo, or type the words.", 6000);
    return;
  }
  ui.candidates = { items, skipped, typed: Boolean(opts.typed), ai: opts.ai || null };
}

async function handleFiles(files) {
  if (!files.length) return;
  const s = settings();
  const source = files.map((f) => f.name).join(", ").slice(0, 120);
  setBusy("Preparing your files…");
  let aiInfo = null;
  try {
    let records = null;
    if (hasAI(s)) {
      try {
        // Step 1: list every word (short reply, so even a 200-word list comes back complete).
        const sources = await filesToSources(files);
        const listed = await aiList(s, sources, setBusy);
        const listNote = fallbackNote(listed.skipped, listed.provider);
        aiInfo = { usedBy: [listed.provider], notes: listNote ? [listNote] : [], failed: 0 };
        if (!listed.words.length) throw new AllProvidersFailed([{ name: listed.provider, reason: "found no words" }]);
        const index = buildIndex(store.liveWords());
        // Drop pronunciations/labels the AI sometimes lists as words ("UT-er", "Utter (verb)"), then repeats.
        const seen = new Set();
        const items = listed.words
          .map((w) => ({ ...w, word: cleanHeadword(w.word) }))
          .filter((w) => {
            const k = w.word && wordKey(w.word);
            return k && !seen.has(k) && seen.add(k);
          });
        if (!items.length) throw new AllProvidersFailed([{ name: listed.provider, reason: "found no words" }]);
        const fresh = items.filter((w) => !findExisting(w.word, index)?.exact);
        const dups = items.filter((w) => findExisting(w.word, index)?.exact);
        // Step 2: word cards for the new ones, 25 at a time. Words already saved are only listed.
        const cards = fresh.length ? await aiEnrichAll(s, fresh, setBusy) : { words: [], notes: [], failed: 0, usedBy: [] };
        aiInfo = {
          usedBy: [...new Set([...aiInfo.usedBy, ...cards.usedBy])],
          notes: [...aiInfo.notes, ...cards.notes],
          failed: cards.failed,
        };
        records = [...cards.words, ...dups].map((r) => ({ ...r, source }));
        if (cards.failed) records = await freeLookup(records, await loadLevels());
      } catch (e) {
        if (!(e instanceof AllProvidersFailed)) throw e;
        aiInfo = { usedBy: [], notes: [e.message], failed: 0 };
      }
    }
    if (!records) {
      const text = await filesToText(files, setBusy);
      setBusy("Picking out the difficult words…");
      const levels = await loadLevels();
      // A numbered vocabulary list keeps every headword; any other text keeps only the hard words.
      const list = parseVocabList(text)
        .map((e) => ({ ...e, word: cleanHeadword(e.word) }))
        .filter((e) => e.word);
      records = list.length
        ? list.map((e) => ({ word: e.word, context: e.context, difficulty: difficultyFromLevel(levelOf(e.word, levels)), source }))
        : candidatesFromText(text, levels).map((c) => ({
            word: c.word,
            context: c.context,
            difficulty: difficultyFromLevel(c.level),
            source,
          }));
      records = await freeLookup(records, levels);
    }
    ui.busy = null;
    showCandidates(records, { ai: aiInfo });
  } catch (e) {
    ui.busy = null;
    toast(e.message || String(e), 6000);
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
    let records = null;
    let aiInfo = null;
    if (hasAI(s) && fresh.length) {
      const cards = await aiEnrichAll(s, fresh.map((word) => ({ word })), setBusy);
      aiInfo = cards;
      records = cards.words.map((r) => ({ ...r, source: "Typed" }));
      if (cards.failed) records = await freeLookup(records, levels);
    }
    if (!records) {
      records = fresh.map((w) => ({ word: w, difficulty: difficultyFromLevel(levelOf(w, levels)), source: "Typed" }));
      records = await freeLookup(records, levels);
    }
    ui.busy = null;
    showCandidates([...records, ...dupRecords], { typed: true, levels, ai: aiInfo });
  } catch (e) {
    ui.busy = null;
    toast(e.message || String(e), 6000);
  }
  if (view === "add") render();
}

// Longer scans are shown for review first and looked up only for the words you keep.
const FREE_LOOKUP_UPFRONT = 40;

/** Free-dictionary lookup for the review screen (skipped for very long lists; see add-selected). */
async function freeLookup(records, levels) {
  const index = buildIndex(store.liveWords());
  const todo = records.filter((r) => !r.meaning && !findExisting(r.word, index)?.exact);
  if (!todo.length || todo.length > FREE_LOOKUP_UPFRONT) return records;
  const { records: filled, quotaHit } = await enrichFree(todo, { tamil: settings().tamil, levels }, setBusy);
  if (quotaHit) toast("Free Hindi translation limit reached for today — tap “Fill missing” tomorrow.", 6000);
  const byKey = new Map(filled.map((r) => [wordKey(r.word), r]));
  return records.map((r) => byKey.get(wordKey(r.word)) ?? r);
}

/** Copy looked-up fields onto a saved word without losing its history or your own edits. */
function mergeDetails(w, r, { overwrite }) {
  const next = { ...w };
  for (const k of ["pos", "meaning", "hindi", "tamil", "ipa", "say", "audio", "examTip", "sentences", "synonyms", "antonyms"]) {
    const v = r[k];
    const has = Array.isArray(v) ? v.length : Boolean(v);
    const cur = Array.isArray(w[k]) ? w[k].length : Boolean(w[k]);
    if (has && (overwrite || !cur)) next[k] = v;
  }
  if (!w.context && r.context) next.context = r.context;
  return next;
}

function noteFallback(res) {
  const note = fallbackNote(res.skipped, res.provider);
  if (note) toast(note, 7000);
}

async function enrich(ids) {
  let words = ids.map(store.byId).filter(Boolean);
  if (!words.length) return;
  if (hasAI(settings())) {
    const progress = (msg) => toast(msg, 120000);
    progress(`AI is filling in ${plural(words.length, "word")}…`);
    try {
      const cards = await aiEnrichAll(
        settings(),
        words.map((w) => ({ word: w.word, context: w.context })),
        progress,
      );
      let n = 0;
      const left = [];
      words.forEach((w, i) => {
        const r = cards.words[i];
        if (r?.meaning) (store.saveWord(mergeDetails(w, r, { overwrite: true })), (n += 1));
        else left.push(w);
      });
      toast([`Updated ${plural(n, "word")} with AI ✓`, ...cards.notes].join(" · "), 7000);
      if (!left.length) return;
      words = left.map((w) => store.byId(w.id)).filter(Boolean); // the rest go to the free dictionaries
    } catch (e) {
      return toast(e.message || String(e), 6000);
    }
  }
  // Free dictionaries (no AI key, or every AI option failed).
  toast(`Looking up ${plural(words.length, "word")} in free dictionaries…`, 120000);
  try {
    const levels = await loadLevels();
    const { records, quotaHit } = await enrichFree(words, { tamil: settings().tamil, levels });
    let n = 0;
    records.forEach((r, i) => {
      const merged = mergeDetails(words[i], r, { overwrite: false });
      if (JSON.stringify(merged) !== JSON.stringify(words[i])) (store.saveWord(merged), (n += 1));
    });
    const missing = records.filter((r) => !r.meaning).length;
    toast(
      `Updated ${plural(n, "word")} ✓` +
        (missing ? ` · ${missing} not found (idioms/rare words — add them via Edit)` : "") +
        (quotaHit ? " · Hindi limit reached, try again tomorrow" : ""),
      6000,
    );
  } catch (e) {
    toast(e.message, 6000);
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
    else if (s.dirty || gs.get().dirty || gk.get().dirty || QPARTS.some((q) => q.store.get().dirty)) (text = "Unsynced"), (cls = "warn");
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
      // Grammar has its own file in the same folder (only created once grammar has been used).
      const g = gs.get();
      const gIds = { folderId: newIds.folderId, fileId: g.drive.fileId, sheetId: g.drive.sheetId };
      const gPulled = await drive.pull(gIds, drive.GRAMMAR_JSON);
      if (gPulled.data) gs.importData(gPulled.data);
      if (gPulled.data || gs.get().rules.length || Object.keys(gs.get().book).length) {
        const gPayload = gs.exportData();
        const gNew = await drive.push(gPayload, rulesToCSV(gPayload.rules), gPulled.ids, { jsonName: drive.GRAMMAR_JSON, sheetName: drive.GRAMMAR_SHEET });
        gs.update(
          (st) => {
            st.drive = { fileId: gNew.fileId, sheetId: gNew.sheetId, lastSync: new Date().toISOString() };
            st.dirty = false;
          },
          { touchesData: false },
        );
      }
      // GK too: its own file, only created once GK has been used.
      const k = gk.get();
      const kIds = { folderId: newIds.folderId, fileId: k.drive.fileId, sheetId: k.drive.sheetId };
      const kPulled = await drive.pull(kIds, drive.GK_JSON);
      if (kPulled.data) gk.importData(kPulled.data);
      if (kPulled.data || gk.get().items.length || Object.keys(gk.get().bank).length) {
        const kPayload = gk.exportData();
        const kNew = await drive.push(kPayload, itemsToCSV(kPayload.items.filter((i) => !i.deleted)), kPulled.ids, { jsonName: drive.GK_JSON, sheetName: drive.GK_SHEET });
        gk.update(
          (st) => {
            st.drive = { fileId: kNew.fileId, sheetId: kNew.sheetId, lastSync: new Date().toISOString() };
            st.dirty = false;
          },
          { touchesData: false },
        );
      }
      // Maths and Reasoning: a file each, only created once that part has been used.
      for (const q of QPARTS) {
        const qst = q.store;
        const m = qst.get();
        const mIds = { folderId: newIds.folderId, fileId: m.drive.fileId, sheetId: m.drive.sheetId };
        const mPulled = await drive.pull(mIds, q.json);
        if (mPulled.data) qst.importData(mPulled.data);
        if (mPulled.data || qst.get().items.length || Object.keys(qst.get().bank).length) {
          const mPayload = qst.exportData();
          const mNew = await drive.push(mPayload, qItemsToCSV(mPayload.items.filter((i) => !i.deleted)), mPulled.ids, { jsonName: q.json, sheetName: q.sheet });
          qst.update(
            (st) => {
              st.drive = { fileId: mNew.fileId, sheetId: mNew.sheetId, lastSync: new Date().toISOString() };
              st.dirty = false;
            },
            { touchesData: false },
          );
        }
      }
      ui.syncState = "ok";
      if (interactive) toast("Saved to Google Drive ✓");
    } catch (e) {
      ui.syncState = e.needsAuth ? "idle" : "error";
      ui.syncError = e.message;
      if (interactive || !e.needsAuth) toast(e.message, 5000);
    } finally {
      syncing = null;
      updateSyncChip();
      if (["settings", "today", "words", "home", "g-today", "g-rules", "k-today", "k-topics", "m-today", "m-topics", "r-today", "r-topics"].includes(view)) render();
    }
  })();
  return syncing;
}

let autoSyncTimer;
function scheduleAutoSync() {
  const s = store.get();
  const anyDirty = () => store.get().dirty || gs.get().dirty || gk.get().dirty || QPARTS.some((q) => q.store.get().dirty);
  if (!s.settings.autoSync || !anyDirty() || !drive.isConnected()) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => anyDirty() && sync(), 2500);
}

// ---------- the Grammar Rules part ----------
const grammar = createGrammarUI({
  $,
  esc,
  toast,
  plural,
  render: () => render(),
  go: (v) => go(v),
  view: () => view,
  openOverlay,
  closeOverlay,
  settings,
  download,
  keyPicker,
  aiBanner,
  afterChange: () => {
    updateSyncChip();
    scheduleAutoSync();
  },
});

// ---------- photos and PDFs: the crop tool and the "crop before reading" step (every part) ----------
const cropper = createCropper({ $, esc, openOverlay });
const prepare = createPrepare({
  esc,
  plural,
  toast,
  openOverlay,
  closeOverlay,
  cropper,
  settings,
  setSkip: (skip) => store.update((s) => (s.settings.cropStep = !skip), { touchesData: false }),
});

// ---------- the GK part ----------
const gkui = createGkUI({
  $,
  esc,
  toast,
  plural,
  render: () => render(),
  go: (v) => go(v),
  view: () => view,
  openOverlay,
  closeOverlay,
  settings,
  download,
  keyPicker,
  aiBanner,
  areaNotice: () => areaui.notice(), // "you're in a new district" (areaui is made just below)
  afterChange: () => {
    updateSyncChip();
    scheduleAutoSync();
  },
});

// GK → 📍 My Area: exam notes about where you are.
const areaui = createAreaUI(
  { $, esc, toast, plural, render: () => render(), go: (v) => go(v), view: () => view, openOverlay, closeOverlay, settings, keyPicker, afterChange: () => (updateSyncChip(), scheduleAutoSync()) },
  gkui,
);

// ---------- the Maths and Reasoning parts (one module, two instances) ----------
const quantCtx = {
  $,
  cropper,
  esc,
  toast,
  plural,
  render: () => render(),
  go: (v) => go(v),
  view: () => view,
  openOverlay,
  closeOverlay,
  settings,
  download,
  keyPicker,
  aiBanner,
  afterChange: () => {
    updateSyncChip();
    scheduleAutoSync();
  },
};
onSaveError((e, name) =>
  toast(`⚠️ ${name} couldn't be saved — the phone's storage for this app is full. Remove some figure photos, or download a backup.`, 10000),
);
const QPARTS = [
  {
    section: "maths",
    prefix: "m",
    store: mathsStore,
    json: drive.MATHS_JSON,
    sheet: drive.MATHS_SHEET,
    ui: createQuantUI(quantCtx, {
      store: mathsStore,
      prefix: "m",
      subject: "Quant",
      title: "Maths",
      icon: "🔢",
      slug: "maths",
      otherTitle: "🧩 Reasoning",
      examples: "e.g. Time and Work · Profit & Loss · Mensuration · Number series",
      defaultTopic: "Percentage",
    }),
  },
  {
    section: "reasoning",
    prefix: "r",
    store: reasonStore,
    json: drive.REASONING_JSON,
    sheet: drive.REASONING_SHEET,
    ui: createQuantUI(quantCtx, {
      store: reasonStore,
      prefix: "r",
      subject: "Reasoning",
      title: "Reasoning",
      icon: "🧩",
      slug: "reasoning",
      otherTitle: "🔢 Maths",
      examples: "e.g. Syllogism · Circular seating · Blood relations · Coding-decoding",
      defaultTopic: "Syllogism",
    }),
  },
];

// ---------- the five parts: Vocabulary, Grammar, GK, Maths and Reasoning ----------
const SECTION_TABS = {
  vocab: [
    ["today", "☀️", "Today"],
    ["add", "➕", "Add"],
    ["practice", "🎯", "Practice"],
    ["words", "📚", "Words"],
    ["settings", "⚙️", "Settings"],
  ],
  grammar: [
    ["g-today", "☀️", "Today"],
    ["g-add", "➕", "Add"],
    ["g-practice", "🎯", "Practice"],
    ["g-rules", "📗", "Rules"],
    ["settings", "⚙️", "Settings"],
  ],
  gk: [
    ["k-today", "☀️", "Today"],
    ["k-add", "➕", "Add"],
    ["k-practice", "🎯", "Practice"],
    ["k-topics", "🗂️", "Topics"],
    ["settings", "⚙️", "Settings"],
  ],
  maths: [
    ["m-today", "☀️", "Today"],
    ["m-add", "➕", "Add"],
    ["m-practice", "🎯", "Practice"],
    ["m-topics", "🗂️", "Topics"],
    ["settings", "⚙️", "Settings"],
  ],
  reasoning: [
    ["r-today", "☀️", "Today"],
    ["r-add", "➕", "Add"],
    ["r-practice", "🎯", "Practice"],
    ["r-topics", "🗂️", "Topics"],
    ["settings", "⚙️", "Settings"],
  ],
};
const VOCAB_VIEWS = new Set(["today", "add", "practice", "words"]);
const sectionOf = (v) =>
  v.startsWith("g-") ? "grammar" : v.startsWith("k-") ? "gk" : v.startsWith("m-") ? "maths" : v.startsWith("r-") ? "reasoning" : VOCAB_VIEWS.has(v) ? "vocab" : null;
// "quant" was the combined Maths & Reasoning part; it now opens Maths.
const START_VIEW = { vocab: "today", grammar: "g-today", gk: "k-today", maths: "m-today", quant: "m-today", reasoning: "r-today" };

function renderChrome() {
  const sec = view === "home" ? null : ui.section;
  const bar = $(".tabbar");
  bar.hidden = !sec;
  if (sec && bar.dataset.sec !== sec) {
    bar.dataset.sec = sec;
    bar.innerHTML = SECTION_TABS[sec]
      .map(([v, ico, label]) => `<button type="button" data-nav="${v}"><span class="ico" aria-hidden="true">${ico}</span><span>${label}</span></button>`)
      .join("");
  }
  for (const b of bar.querySelectorAll("[data-nav]")) b.classList.toggle("active", b.dataset.nav === view);
  for (const b of document.querySelectorAll(".section-switch [data-sec]")) b.classList.toggle("active", b.dataset.sec === sec);
}

/** The start screen: choose Vocabulary, Grammar, GK, Maths or Reasoning. */
function viewHome() {
  const st = settings();
  const words = store.liveWords().length;
  const vPool = store.wordsFor(st.dailySource);
  const vStats = stats(vPool);
  const wotd = vPool.length ? store.byId(store.todaysPlan().wotd) : null;
  const gPool = gs.rulesFor(gs.get().prefs.dailySource);
  const gStats = stats(gPool);
  const rotd = grammar.ruleOfTheDay();
  const kPool = gk.itemsFor(gk.get().prefs.dailySource);
  const kStats = stats(kPool);
  const qotd = gkui.questionOfTheDay();
  const quantCard = (q) => {
    const st = q.store;
    const pool = st.itemsFor(st.get().prefs.dailySource);
    const day = q.ui.cardOfTheDay();
    return `<button class="home-card ${q.section}" type="button" data-nav="${q.prefix}-today">
        <span class="home-ico">${q.section === "maths" ? "🔢" : "🧩"}</span>
        <span class="home-main">
          <b>${q.section === "maths" ? "Maths" : "Reasoning"}</b>
          <span>${plural(st.liveItems().length, "card")} of your own · ${st.bookItems().length} in the Formula Book</span>
          <span class="small">${stats(pool).due} due today · 🔥 ${streak(st.get().activity)}${day ? ` · Today: <i>${esc(day.q.length > 60 ? `${day.q.slice(0, 58)}…` : day.q)}</i>` : ""}</span>
        </span>
        <span class="home-go" aria-hidden="true">›</span>
      </button>`;
  };
  return `
    <section class="home">
      <h1>What would you like to study?</h1>
      <button class="home-card vocab" type="button" data-nav="today">
        <span class="home-ico">📘</span>
        <span class="home-main">
          <b>Vocabulary</b>
          <span>${plural(words, "word")} of your own · ${store.bankWords().length} in the Word Bank</span>
          <span class="small">${vStats.due} due today · 🔥 ${streak(store.get().activity)}${wotd ? ` · Word of the Day: <i>${esc(wotd.word)}</i>` : ""}</span>
        </span>
        <span class="home-go" aria-hidden="true">›</span>
      </button>
      <button class="home-card grammar" type="button" data-nav="g-today">
        <span class="home-ico">📗</span>
        <span class="home-main">
          <b>Grammar Rules</b>
          <span>${plural(gs.liveRules().length, "rule")} of your own · ${gs.bookRules().length} in the Rule Book</span>
          <span class="small">${gStats.due} due today · 🔥 ${streak(gs.get().activity)}${rotd ? ` · Rule of the Day: <i>${esc(rotd.title)}</i>` : ""}</span>
        </span>
        <span class="home-go" aria-hidden="true">›</span>
      </button>
      <button class="home-card gk" type="button" data-nav="k-today">
        <span class="home-ico">🌍</span>
        <span class="home-main">
          <b>General Knowledge</b>
          <span>${plural(gk.liveItems().length, "question")} of your own · ${gk.bankItems().length} in the Question Bank</span>
          <span class="small">${kStats.due} due today · 🔥 ${streak(gk.get().activity)}${qotd ? ` · Today: <i>${esc(qotd.q.length > 60 ? `${qotd.q.slice(0, 58)}…` : qotd.q)}</i>` : ""}</span>
        </span>
        <span class="home-go" aria-hidden="true">›</span>
      </button>
      ${QPARTS.map(quantCard).join("")}
      <label class="field small">When the app opens
        <select data-setting="startSection">
          ${[
            ["ask", "Show this screen"],
            ["vocab", "Go straight to Vocabulary"],
            ["grammar", "Go straight to Grammar"],
            ["gk", "Go straight to GK"],
            ["maths", "Go straight to Maths"],
            ["reasoning", "Go straight to Reasoning"],
            ["last", "Where I left off"],
          ]
            .map(([v, l]) => `<option value="${v}" ${st.startSection === v ? "selected" : ""}>${l}</option>`)
            .join("")}
        </select>
      </label>
      ${madeBy()}
    </section>`;
}

// ---------- routing & events ----------
const VIEWS = {
  home: viewHome,
  today: viewToday,
  add: viewAdd,
  practice: viewPractice,
  words: viewWords,
  settings: viewSettings,
  ...grammar.views,
  ...gkui.views,
  ...areaui.views,
  ...Object.assign({}, ...QPARTS.map((q) => q.ui.views)),
};

function render() {
  const main = $("#view");
  const searchFocused = document.activeElement?.id === "search";
  main.innerHTML = VIEWS[view]();
  const anyAdding = ui.busy || ui.candidates || grammar.gui.busy || grammar.gui.candidates || gkui.gui.busy || gkui.gui.candidates || QPARTS.some((q) => q.ui.gui.busy || q.ui.gui.candidates);
  if (["settings", "add", "g-add", "k-add", "m-add", "r-add"].includes(view) && !anyAdding) {
    checkKeysInBackground();
  }
  renderChrome();
  if (searchFocused) {
    const input = $("#search");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  updateSyncChip();
}

function go(v) {
  if (!VIEWS[v]) v = "home";
  if (view === "add" && v !== "add" && $("#typed")) ui.typedDraft = $("#typed").value;
  if (view === "g-add" && v !== "g-add" && $("#gTyped")) grammar.gui.typedDraft = $("#gTyped").value;
  if (view === "k-add" && v !== "k-add" && $("#kTyped")) gkui.gui.typedDraft = $("#kTyped").value;
  if (view === "k-add" && v !== "k-add" && $("#kTopic")) gkui.gui.topicDraft = $("#kTopic").value;
  for (const q of QPARTS) {
    const add = `${q.prefix}-add`;
    if (view === add && v !== add && $(`#${q.prefix}Typed`)) q.ui.gui.typedDraft = $(`#${q.prefix}Typed`).value;
    if (view === add && v !== add && $(`#${q.prefix}Topic`)) q.ui.gui.topicDraft = $(`#${q.prefix}Topic`).value;
  }
  const sec = sectionOf(v);
  if (sec && sec !== ui.section) ui.section = sec;
  if (sec && settings().lastSection !== sec) store.update((s) => (s.settings.lastSection = sec), { touchesData: false });
  if (updatePending && safeToReload() && updateNow()) return;
  view = v;
  render();
  window.scrollTo(0, 0);
  history.replaceState(null, "", `#${v}`);
}

const actions = {
  install: async () => {
    if (await install.prompt()) toast(`Installing… ${brand.shortName || brand.name} will appear on your home screen.`);
  },
  "dismiss-install": () => {
    install.dismiss();
    toast("Hidden. You can still install from Settings.");
    render();
  },
  speak: (el) => speak(el.dataset.text, el.dataset.audio),
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
    if (w.bank) store.updateWord(w.id, (x) => ({ ...x, starred: !x.starred }));
    else store.saveWord({ ...w, starred: !w.starred });
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
    store.updateWord(id, (w) => review(w, g, today));
    store.update((s) => {
      if (s.daily?.date === today) s.daily.done[id] = g;
      if (!s.activity.includes(today)) s.activity.push(today);
    });
    ss.results[id] = g;
    ss.i += 1;
    ss.revealed = false;
    renderSession();
  },
  "start-quiz": (el) => startQuiz(el.dataset.kind, { weakOnly: el.dataset.weak === "1" }),
  "end-quiz": () => {
    const q = ui.quiz;
    // Finishing early still shows the summary for the questions answered.
    if (q && q.answered && q.i < q.queue.length) {
      q.queue = q.queue.slice(0, q.picked != null ? q.i + 1 : q.i);
      q.i = q.queue.length;
      return render();
    }
    ui.quiz = null;
    render();
  },
  pick: (el) => {
    const q = ui.quiz;
    const cur = q.current;
    q.picked = Number(el.dataset.i);
    q.answered += 1;
    const correct = q.picked === cur.answer;
    if (correct) q.score += 1;
    else {
      q.wrong.push(cur.wordId);
      q.queue = requeue(q.queue, q.i, cur.wordId, q.requeued); // ask again a few questions later
    }
    // The answer also counts as a revision: wrong → back tomorrow; right on a due word → moves on.
    const w = store.byId(cur.wordId);
    const revised = w && practiceReview(w, correct);
    if (revised) store.updateWord(cur.wordId, () => revised);
    store.update((s) => {
      s.practice = recordAnswer(s.practice, q.source, cur.wordId, correct);
      const today = todayISO();
      if (!s.activity.includes(today)) s.activity.push(today);
      if (revised && s.daily?.date === today && s.daily.ids.includes(cur.wordId) && !s.daily.done[cur.wordId]) s.daily.done[cur.wordId] = correct ? "good" : "again";
    });
    render();
  },
  "next-q": () => {
    const q = ui.quiz;
    q.i += 1;
    q.picked = null;
    // A word already asked earlier in this session is a retry of a wrong answer.
    q.current = q.i < q.queue.length ? questionFor(q, q.pool, q.queue.slice(0, q.i).includes(q.queue[q.i])) : null;
    render();
  },
  typed: () => handleTyped(),
  "cancel-candidates": () => {
    ui.candidates = null;
    render();
  },
  "select-all": () => {
    for (const it of ui.candidates.items) it.selected = it.status === "new";
    render();
  },
  "add-gemini-key": () => {
    const input = $("#newGeminiKey");
    const key = input.value.trim();
    if (!looksLikeGeminiKey(key)) return toast("That doesn't look like a Gemini key (they start with AQ. or AIza…).");
    if (geminiKeysOf(settings()).includes(key)) return toast("That key is already added.");
    store.update((s) => (s.settings.geminiKeys = [...geminiKeysOf(s.settings), key]), { touchesData: false });
    const n = geminiKeysOf(settings()).length;
    toast(`Gemini key ${n} added — testing it…`);
    render();
    testKey(key).then((r) => {
      toast(`Gemini key ${n}: ${r.message}`, 7000);
      render();
    });
  },
  "remove-gemini-key": (el) => {
    const i = Number(el.dataset.i);
    if (!confirm(`Remove Gemini key ${i + 1}?`)) return;
    store.update(
      (s) => {
        const keys = geminiKeysOf(s.settings);
        if (keys[i] === s.settings.geminiKeyPick) s.settings.geminiKeyPick = "";
        s.settings.geminiKeys = keys.filter((_, j) => j !== i);
      },
      { touchesData: false },
    );
    render();
  },
  "add-extra-ai": async () => {
    const key = $("#newExtraKey").value.trim();
    const provider = ui.extraProvider;
    const base = provider === "custom" ? ($("#newExtraBase")?.value || "").trim() : "";
    if (!/^\S{12,}$/.test(key)) return toast("Paste the full API key first.");
    if (provider === "custom" && !/^https:\/\/\S+$/.test(base)) return toast("Enter the service's API address (starting with https://).");
    if (extraServicesOf(settings()).some((e) => e.key === key)) return toast("That key is already added.");
    const entry = { id: Math.random().toString(36).slice(2, 10), provider, key, base, model: "auto" };
    store.update((s) => (s.settings.extraAIs = [...(s.settings.extraAIs || []), entry]), { touchesData: false });
    toast(`${SERVICES[provider].label} added — testing the key…`);
    render();
    ui.extraStatus[entry.id] = await testService(entry);
    toast(`${SERVICES[provider].label}: ${ui.extraStatus[entry.id].message}`, 7000);
    render();
  },
  "test-extra-ai": async (el) => {
    const entry = extraServicesOf(settings()).find((e) => e.id === el.dataset.id);
    if (!entry) return;
    toast("Testing…");
    ui.extraStatus[entry.id] = await testService(entry);
    toast(ui.extraStatus[entry.id].message, 6000);
    render();
  },
  "remove-extra-ai": (el) => {
    const id = el.dataset.id;
    if (!confirm("Remove this AI service?")) return;
    store.update(
      (s) => {
        s.settings.extraAIs = (s.settings.extraAIs || []).filter((e) => e.id !== id);
        if (s.settings.aiPick === `extra:${id}`) s.settings.aiPick = "";
      },
      { touchesData: false },
    );
    render();
  },
  info: (el) => showInfo(el.dataset.id),
  "close-info": () => closeInfo(),
  "info-add": (el) => {
    const n = store.addBankWordToMine(el.dataset.id);
    toast(n ? "Added to your words ✓" : "Already in your words.");
    showInfo(el.dataset.id);
  },
  "set-daily-source": (el) => {
    store.update((s) => (s.settings.dailySource = el.dataset.src), { touchesData: false });
    toast(`Today's words now come from ${store.SOURCES[el.dataset.src]}.`);
    render();
  },
  "use-bank": () => {
    store.update((s) => (s.settings.dailySource = "bank"), { touchesData: false });
    toast("Today’s words now come from the Word Bank. Change it any time on Today or in Settings.", 5000);
    render();
  },
  "add-to-mine": (el) => {
    const n = store.addBankWordToMine(el.dataset.id);
    toast(n ? "Added to your words ✓" : "Already in your words.");
    showWord(el.dataset.id);
  },
  "words-tab": (el) => {
    ui.wordsTab = el.dataset.tab;
    ui.filter = "all";
    render();
  },
  "test-notify": async () => {
    try {
      if (!("Notification" in window)) throw new Error("This browser can't show notifications.");
      if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") {
        throw new Error("Notifications are blocked. Allow them for this site in your browser settings.");
      }
      await notify.showNow(notify.wordsForDay(store.wordsFor(settings().notify.source)));
    } catch (err) {
      toast(err.message, 6000);
    }
  },
  "select-hard": () => {
    for (const it of ui.candidates.items) it.selected = it.status === "new" && (it.rec.difficulty ?? 3) >= 3;
    render();
  },
  "select-none": () => {
    for (const it of ui.candidates.items) it.selected = false;
    render();
  },
  "add-selected": async () => {
    let recs = ui.candidates.items.filter((i) => i.selected).map((i) => i.rec);
    if (recs.some((r) => !r.meaning)) {
      const cands = ui.candidates;
      setBusy("Looking up your words…");
      try {
        const levels = await loadLevels();
        const { records, quotaHit } = await enrichFree(recs, { tamil: settings().tamil, levels }, setBusy);
        recs = records;
        if (quotaHit) toast("Free Hindi translation limit reached for today — tap “Fill missing” tomorrow.", 6000);
      } catch {
        /* add them without details; "Fill missing" can retry later */
      }
      ui.busy = null;
      ui.candidates = cands;
    }
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
  "export-json": () => {
    const data = store.exportData();
    download(`vocabvault-backup-${todayISO()}.json`, JSON.stringify(data, null, 1), "application/json");
    const own = store.liveWords().length;
    const bankN = Object.keys(data.bank).length;
    toast(`Backup saved: ${plural(own, "of your own word")}${bankN ? ` + progress on ${plural(bankN, "Word Bank word")}` : ""}. Word Bank words are built into the app on every device.`, 7000);
  },
  reset: () => {
    if (!confirm("Erase all words on this device? (Your Google Drive copy is not touched.)")) return;
    store.resetAll();
    render();
    toast("Local data erased.");
  },
};

Object.assign(actions, cropper.actions, prepare.actions, grammar.actions, gkui.actions, areaui.actions, ...QPARTS.map((q) => q.ui.actions));

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
  if (e.target.id === "info") return closeInfo();
  if (e.target.id === "overlay") actions.close();
});

// Photos and PDFs picked on any Add screen go through the crop step first, then on to that screen.
const FILE_INPUTS = {
  files: (f) => handleFiles(f),
  "g-files": (f) => grammar.addFiles(f),
  "k-files": (f) => gkui.addFiles(f),
  "k-chat-files": (f) => gkui.chatFiles(f),
  ...Object.fromEntries(QPARTS.flatMap((q) => [[`${q.prefix}-files`, (f) => q.ui.addFiles(f)], [`${q.prefix}-chat-files`, (f) => q.ui.chatFiles(f)]])),
};
document.addEventListener(
  "change",
  async (e) => {
    const t = e.target;
    const send = t.type === "file" && FILE_INPUTS[t.dataset.input];
    if (!send) return;
    e.stopImmediatePropagation();
    const files = [...t.files];
    t.value = "";
    if (!files.length) return;
    const ready = await prepare.prepareFiles(files);
    if (ready?.length) send(ready);
  },
  true,
);

document.addEventListener("change", async (e) => {
  if (prepare.onChange(e)) return;
  if (await grammar.onChange(e)) return;
  if (await gkui.onChange(e)) return;
  if (areaui.onChange(e)) return;
  for (const q of QPARTS) if (await q.ui.onChange(e)) return;
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
      const r = store.importData(JSON.parse(await f.text()), { markDirty: true, applyPrefs: true });
      const parts = [
        `Backup had ${plural(r.inBackup, "of your own word")}${r.inBackup ? `: ${r.added} new, ${r.updated} updated, ${r.inBackup - r.added - r.updated} already here` : ""}.`,
        r.bankProgress ? `Word Bank progress restored for ${plural(r.bankProgress, "word")}.` : "",
        r.prefsApplied ? `Today's words now come from ${store.SOURCES[store.get().settings.dailySource]}.` : "",
      ];
      toast(`✓ Restored. ${parts.filter(Boolean).join(" ")}`, 8000);
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
  if (t.dataset.notify) {
    const k = t.dataset.notify;
    const v = t.type === "checkbox" ? t.checked : k === "hour" ? Number(t.value) : t.value;
    store.update((s) => (s.settings.notify = { ...s.settings.notify, [k]: v }), { touchesData: false });
    if (k === "enabled") {
      if (v) {
        try {
          const res = await notify.enable();
          toast(res === "scheduled" ? "Daily words notification is on ✓" : "Notifications allowed ✓ (see the note below)");
        } catch (err) {
          store.update((s) => (s.settings.notify.enabled = false), { touchesData: false });
          toast(err.message, 6000);
        }
      } else {
        await notify.disable();
        toast("Daily notification turned off.");
      }
    } else toast("Saved");
    await refreshNotify();
    render();
    return;
  }
  if (t.dataset.keypick != null) {
    const v = t.value;
    const keys = geminiKeysOf(settings());
    store.update(
      (s) => {
        s.settings.geminiKeyPick = v.startsWith("g:") ? keys[Number(v.slice(2))] || "" : "";
        s.settings.aiPick = v.startsWith("x:") ? `extra:${v.slice(2)}` : "";
      },
      { touchesData: false },
    );
    const p = pickedAI(settings());
    toast(p?.kind === "extra" ? `Using ${serviceName(settings(), p.entry)} only.` : p ? `Using Gemini key ${Number(v.slice(2)) + 1} only.` : "Auto: all AIs are used in order.");
    render();
    return;
  }
  if (t.dataset.extraProvider != null) {
    ui.extraProvider = t.value;
    render();
    return;
  }
  if (t.dataset.extraModel != null) {
    const id = t.dataset.extraModel;
    const model = t.value.trim() || "auto";
    store.update((s) => (s.settings.extraAIs = (s.settings.extraAIs || []).map((e) => (e.id === id ? { ...e, model } : e))), {
      touchesData: false,
    });
    toast(model === "auto" ? "Model: auto" : `Model set to ${model}`);
    return;
  }
  if (t.dataset.setting) {
    const k = t.dataset.setting;
    let v = t.type === "checkbox" ? t.checked : t.value.trim();
    if (k === "dailyCount") v = Math.min(50, Math.max(3, Number(v) || 10));
    if (k === "practiceSize") v = Number(v) || 20;
    store.update((s) => (s.settings[k] = v), { touchesData: false });
    if (k === "googleClientId") drive.disconnect();
    toast("Saved");
    if (["dailyCount", "googleClientId", "voice", "apiKey", "dailySource", "practiceSource", "startSection"].includes(k)) render();
    return;
  }
  if (t.id === "sort") {
    ui.sort = t.value;
    render();
  }
});

document.addEventListener("input", (e) => {
  if (grammar.onInput(e)) return;
  if (gkui.onInput(e)) return;
  if (QPARTS.some((q) => q.ui.onInput(e))) return;
  if (e.target.id === "search") {
    ui.search = e.target.value;
    render();
  }
});

document.addEventListener("submit", (e) => {
  if (grammar.onSubmit(e)) return;
  if (gkui.onSubmit(e)) return;
  if (QPARTS.some((q) => q.ui.onSubmit(e))) return;
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
  if (e.key === "Escape" && $("#info").classList.contains("open")) return closeInfo();
  if (e.key === "Escape" && $("#overlay").classList.contains("open")) actions.close();
  if (ui.session && !e.target.closest("input,textarea")) {
    if (e.key === " " && !ui.session.revealed) (e.preventDefault(), actions.reveal());
    const map = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
    if (ui.session.revealed && map[e.key]) actions.grade({ dataset: { g: map[e.key] } });
  }
});

// ---------- daily notification schedule ----------
let notifyTimer;
async function refreshNotify() {
  const n = settings().notify;
  try {
    await notify.writeSchedule(store.wordsFor(n.source), n);
    const cap = await notify.capability();
    ui.notifyStatus = !n.enabled
      ? ""
      : cap.permission !== "granted"
        ? "⚠️ Notifications are not allowed for this site yet."
        : cap.periodic && cap.periodicAllowed
          ? "✅ On. Your phone will show today's 2 words once a day, some time after the chosen hour (the exact time is decided by Chrome)."
          : "ℹ️ Allowed, but background delivery needs the app installed to your home screen (Chrome on Android: ⋮ → Add to Home screen / Install app). Until then you'll see the 2 words on the Today screen.";
  } catch {
    ui.notifyStatus = "";
  }
  const el = document.getElementById("notifyStatus");
  if (el) el.textContent = ui.notifyStatus;
}
const scheduleNotifyRefresh = () => {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(refreshNotify, 1500);
};

gs.subscribe(() => {
  updateSyncChip();
  scheduleAutoSync();
});

store.subscribe(() => {
  updateSyncChip();
  scheduleAutoSync();
  scheduleNotifyRefresh();
});

// ---------- start ----------
// First screen: an explicit link (#g-rules, a notification…) wins; a plain open follows the start setting.
{
  const initial = location.hash.slice(1);
  let firstOpen = true;
  try {
    firstOpen = !sessionStorage.getItem("vv-opened");
    sessionStorage.setItem("vv-opened", "1");
  } catch {
    /* private mode */
  }
  const explicit = new URLSearchParams(location.search).has("open") || (VIEWS[initial] && !(firstOpen && ["", "today"].includes(initial)));
  if (explicit && VIEWS[initial]) view = initial;
  else {
    const st = settings();
    const start = st.startSection || "ask";
    view = START_VIEW[start] ?? (start === "last" ? START_VIEW[st.lastSection] || "today" : "home");
  }
  // "quant" was the combined Maths & Reasoning part.
  ui.section = sectionOf(view) || (settings().lastSection === "quant" ? "maths" : settings().lastSection) || "vocab";
  history.replaceState(null, "", `${location.pathname}#${view}`);
}
applyBrand(brand);

// ---------- staying on the newest version ----------
const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
let updatePending = false;

/** Nothing in progress that a reload would interrupt. */
const safeToReload = () =>
  !ui.busy && !ui.session && !ui.quiz && !ui.candidates && !grammar.busy() && !gkui.busy() && !areaui.busy() && !prepare.busy() && !QPARTS.some((q) => q.ui.busy()) && !$("#overlay").classList.contains("open");

/** Reload into the newest version, keeping typed words. Returns true if the page is reloading. */
function updateNow() {
  const typed = $("#typed")?.value ?? ui.typedDraft;
  const gTyped = $("#gTyped")?.value ?? grammar.gui.typedDraft;
  const kTyped = $("#kTyped")?.value ?? gkui.gui.typedDraft;
  const mTyped = $("#mTyped")?.value ?? QPARTS[0].ui.gui.typedDraft;
  const rTyped = $("#rTyped")?.value ?? QPARTS[1].ui.gui.typedDraft;
  return reloadForUpdate({ typed, gTyped, kTyped, mTyped, rTyped, view });
}

async function checkForUpdate() {
  if (APP_VERSION === "dev") return;
  const live = await liveVersion();
  if (!live || live === APP_VERSION) return;
  updatePending = true;
  if (safeToReload()) updateNow();
}
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && checkForUpdate());
setInterval(checkForUpdate, 30 * 60 * 1000);
// Vite reports a missing file from an older version here; reload instead of failing.
window.addEventListener("vite:preloadError", (e) => {
  if (updateNow()) e.preventDefault();
});
window.addEventListener("unhandledrejection", (e) => {
  if (isStaleFileError(e.reason) && updateNow()) e.preventDefault();
});

{
  // Back from an automatic update: put typed words back (the screen is kept by the address's #hash).
  const { draft, updated } = takeDraft();
  if (draft?.typed) ui.typedDraft = draft.typed;
  if (draft?.gTyped) grammar.gui.typedDraft = draft.gTyped;
  if (draft?.kTyped) gkui.gui.typedDraft = draft.kTyped;
  if (draft?.mTyped) QPARTS[0].ui.gui.typedDraft = draft.mTyped;
  if (draft?.rTyped) QPARTS[1].ui.gui.typedDraft = draft.rTyped;
  if (updated) setTimeout(() => toast("✨ Updated to the latest version. If you were adding a photo or PDF, pick it again.", 6000), 600);
}

let booted = false;
$("#view").innerHTML = `<section class="card center busy"><div class="spinner" aria-hidden="true"></div><p>Loading…</p></section>`;
// The Word Bank (1000+ words) loads as a separate chunk; the app renders once it's ready.
Promise.all([loadBank(), loadRuleBook(), gkui.loadBank(), QPARTS[0].ui.loadBook()])
  // Maths and Reasoning used to be one part: move any reasoning cards saved there to Reasoning (once; then a no-op).
  .then(() => {
    const moved = mathsStore.handOver() + reasonStore.handOver();
    if (moved) setTimeout(() => toast(`Maths and Reasoning are now separate parts — ${plural(moved, "card")} moved to the right one.`, 7000), 800);
  })
  .catch(() => toast("Couldn't load the built-in Word Bank, Rule Book, Question Bank or Formula Book. Check your connection and reopen the app."))
  .finally(() => {
    booted = true;
    render();
    refreshNotify();
  });
if (drive.isConnected()) sync();
window.addEventListener("online", () => scheduleAutoSync());
window.speechSynthesis?.getVoices(); // warm up the voice list

// Show/hide the Install option when Chrome offers it (only on screens that have it, and after the first render).
install.init(() => {
  if (booted && (view === "today" || view === "settings")) render();
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
