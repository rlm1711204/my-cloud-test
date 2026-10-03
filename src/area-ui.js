// GK → 📍 My Area: exam notes about the place you are in. Asks for the location (or a typed place), confirms the four
// levels (town / taluk, district, state, region), then writes notes for each level with AI — or gives a prompt to copy
// into the Gemini / ChatGPT app and reads its answer back. Notes are grouped by subject and tagged SSC / UPSC / RBI;
// any level can be saved to the GK questions or practised straight away.
import * as gk from "./lib/gk-store.js";
import { EXAM_TAGS, SECTIONS, buildAreaPrompt, cleanNotes, levelsOf, makePlace, notesToGkInputs, placeTitle, placeTrail, readAreaNotes, regionOf } from "./lib/area.js";
import { areaNotes } from "./lib/area-ai.js";
import { currentPosition, findPlace, placeAt } from "./lib/locate.js";
import { AllProvidersFailed, hasAI } from "./lib/engine.js";

const EXAM_HINT = { SSC: "one-line facts", UPSC: "deeper links", RBI: "economy & rural angle" };

export function createAreaUI(ctx, gkui) {
  const { $, esc, toast, plural, render, go, openOverlay, settings, keyPicker } = ctx;
  const gui = {
    busy: null, // text while locating or writing notes
    draft: null, // {place, id?}: the place being confirmed or edited
    asked: false, // the location was asked for once this session
    level: null,
    exam: "all",
    pasteFor: null, // level whose paste box is open
    pasteDraft: "",
    making: false,
  };
  const view = () => ctx.view();
  const redraw = () => view() === "k-area" && render();
  const setBusy = (t) => {
    gui.busy = t;
    redraw();
  };

  // ---------- finding the place ----------
  async function locate() {
    setBusy("Finding where you are…");
    try {
      const pos = await currentPosition();
      setBusy("Looking up the place name…");
      const place = await placeAt(pos);
      gui.draft = { place };
    } catch (e) {
      toast(e.message || String(e), 8000);
    }
    gui.busy = null;
    if (view() !== "k-area") go("k-area");
    else render();
  }

  async function findTyped() {
    const text = ($("#areaTyped")?.value || "").trim();
    if (!text) return toast("Type a place first, e.g. Palayamkottai, Tirunelveli.");
    setBusy(`Looking up “${text.slice(0, 50)}”…`);
    try {
      gui.draft = { place: await findPlace(text) };
    } catch (e) {
      toast(e.message || String(e), 6000);
    }
    gui.busy = null;
    render();
  }

  function confirmPlace() {
    const v = (id) => ($(`#${id}`)?.value || "").replace(/\s+/g, " ").trim();
    const state = v("areaState");
    const region = v("areaRegion");
    const r = regionOf(state);
    const old = gui.draft?.place || {};
    const place = {
      ...makePlace({ district: v("areaDistrict"), state, country: old.country || "India", region: region || r?.name || "", regionDetail: r && (!region || region === r.name) ? r.detail : "" }),
      local: v("areaLocal"),
    };
    if (!place.local && !place.district && !place.state) return toast("Fill in at least one level (town, district or state).");
    const editing = gui.draft?.id;
    gui.draft = null;
    let area;
    if (editing) {
      gk.editAreaPlace(editing, place);
      area = gk.currentArea();
    } else area = gk.saveAreaPlace(place);
    ctx.afterChange();
    gui.level = levelsOf(area.place)[0]?.key || null;
    const missing = levelsOf(area.place).filter((l) => !area.levels[l.key]?.notes?.length);
    if (hasAI(settings()) && missing.length) makeNotes(area.id, missing.map((l) => l.key));
    else render();
  }

  // ---------- writing notes ----------
  async function makeNotes(id, keys) {
    if (gui.making) return;
    gui.making = true;
    let done = 0;
    for (const key of keys) {
      const area = gk.get().areas.find((a) => a.id === id);
      if (!area) break;
      const lvl = levelsOf(area.place).find((l) => l.key === key);
      if (!lvl) continue;
      gui.level ??= key;
      setBusy(`Writing notes on ${lvl.name}…`);
      try {
        const res = await areaNotes(settings(), area.place, key, (t) => setBusy(t));
        gk.setAreaNotes(id, key, res.notes, res.provider);
        done += 1;
        if (res.messages.length) toast(res.messages.join(" "), 7000);
      } catch (e) {
        toast(
          e instanceof AllProvidersFailed ? `Couldn't write notes on ${lvl.name}: ${e.message}. Try “Copy prompt for Gemini” instead.` : e.message || String(e),
          9000,
        );
        if (e instanceof AllProvidersFailed) break;
      }
    }
    gui.making = false;
    gui.busy = null;
    if (done) ctx.afterChange();
    redraw();
  }

  async function copyPrompt(key) {
    const area = gk.currentArea();
    if (!area) return;
    const text = buildAreaPrompt(area.place, key);
    gui.pasteFor = key;
    try {
      await navigator.clipboard.writeText(text);
      toast("Prompt copied ✓ — paste it in Gemini or ChatGPT, then paste its answer here", 6000);
      render();
      $("#areaPasteCard")?.scrollIntoView({ block: "start" });
    } catch {
      render();
      openOverlay(`
        <div class="sheet-bar"><h3>Copy this prompt</h3><button class="icon-btn" type="button" data-action="close" aria-label="Close">✕</button></div>
        <p class="muted small">Press and hold in the box → Select all → Copy. Then paste it in Gemini or ChatGPT.</p>
        <textarea id="areaPromptText" rows="14" readonly>${esc(text)}</textarea>`);
      $("#areaPromptText")?.select();
    }
  }

  function readPaste() {
    const area = gk.currentArea();
    const key = gui.pasteFor;
    const text = $("#areaPaste")?.value || "";
    if (!area || !key) return;
    gui.pasteDraft = text;
    const notes = readAreaNotes(text);
    if (!notes.length) return toast("No notes found. Paste the app's whole answer (lines starting with “- [SSC]”, “- [UPSC]” or “- [RBI]”).", 8000);
    const before = area.levels[key]?.notes || [];
    const merged = cleanNotes([...before, ...notes]);
    gk.setAreaNotes(area.id, key, merged, area.levels[key]?.by && before.length ? area.levels[key].by : "Gemini app (pasted)");
    ctx.afterChange();
    gui.pasteFor = null;
    gui.pasteDraft = "";
    gui.level = key;
    toast(`${plural(merged.length - before.length, "note")} added ✓ (${notes.filter((n) => n.q && n.a).length} with a question)`, 5000);
    render();
  }

  /** Save a level's notes as GK questions; returns the ids of its questions (new or already saved). */
  function saveLevel(key, { quiet = false } = {}) {
    const area = gk.currentArea();
    const lvl = area && levelsOf(area.place).find((l) => l.key === key);
    const notes = area?.levels[key]?.notes || [];
    if (!lvl || !notes.length) return [];
    const { added, skipped } = gk.addItems(notesToGkInputs(notes, lvl.name, placeTitle(area.place)));
    ctx.afterChange();
    if (!quiet)
      toast(`${plural(added.length, "question")} saved under 📍 Places Visited › ${placeTitle(area.place)} ✓${skipped.length ? ` (${skipped.length} already there)` : ""} — they come back in Today's revision and Practice.`, 7000);
    const byQ = new Map(gk.liveItems().map((i) => [i.q, i]));
    return [...added.map((i) => i.id), ...skipped.map((s) => s.id || byQ.get(s.q)?.id).filter(Boolean)];
  }

  // ---------- screens ----------
  const busyCard = () => `<section class="card center busy"><div class="spinner" aria-hidden="true"></div><p>${esc(gui.busy)}</p></section>`;
  const back = `<p class="small"><a href="#" data-nav="k-today">‹ GK</a></p>`;

  function viewIntro() {
    if (!gui.asked && !gui.busy) {
      gui.asked = true;
      setTimeout(locate, 0); // "when I open it, it first asks for the location"
    }
    return `${back}
      <section class="hero">
        <h1>📍 Know your area</h1>
        <p>Exam notes about the place you are in — your <b>town</b>, <b>district</b>, <b>state</b> and <b>region</b> — sorted into
        history, art & culture, geography & rivers, soils & agriculture, economy, banking & rural development, polity,
        environment, science and current affairs. Every note is tagged <b>SSC</b>, <b>UPSC</b> or <b>RBI</b>.</p>
      </section>
      ${gui.busy ? busyCard() : ""}
      <article class="card">
        <button class="btn primary block" type="button" data-action="area-locate">📍 Use my location</button>
        <p class="muted small">Your location is sent once to OpenStreetMap only to find the place name. Only the place names are saved.</p>
        <label class="field">Or type a place
          <input id="areaTyped" type="text" placeholder="e.g. Palayamkottai, Tirunelveli, Tamil Nadu" autocomplete="off" /></label>
        <button class="btn block" type="button" data-action="area-find">🔎 Find this place</button>
      </article>
      ${placesList()}`;
  }

  function viewConfirm() {
    const p = gui.draft.place || {};
    const r = regionOf(p.state);
    const field = (id, icon, label, value, hint = "") =>
      `<label class="field">${icon} ${label}<input id="${id}" type="text" value="${esc(value || "")}" autocomplete="off" />${hint ? `<span class="muted small">${hint}</span>` : ""}</label>`;
    return `${back}
      <h1>${gui.draft.id ? "Edit the place" : "Is this your area?"}</h1>
      <p class="muted">Check the names (correct any that are wrong). Notes are made for each level that has a name.</p>
      <article class="card">
        ${field("areaLocal", "📍", "Town / taluk", p.local, "Leave empty to skip this level.")}
        ${field("areaDistrict", "🏘️", "District", p.district)}
        ${field("areaState", "🗺️", "State", p.state)}
        ${field("areaRegion", "🧭", "Region", p.region, r ? esc(r.detail) : "e.g. South India — filled in from the state.")}
        <div class="stack">
          <button class="btn primary block" type="button" data-action="area-confirm">✓ ${hasAI(settings()) ? "Save and make notes" : "Save"}</button>
          <button class="btn block" type="button" data-action="area-cancel">Cancel</button>
          ${gui.draft.id ? `<button class="btn small danger" type="button" data-action="area-delete">Delete this place and its notes</button>` : ""}
        </div>
      </article>`;
  }

  function placesList() {
    const areas = gk.get().areas;
    if (!areas.length) return "";
    return `<article class="card"><h3>Your places</h3><ul class="word-list">${areas
      .map((a) => `<li data-action="area-open" data-id="${esc(a.id)}"><div><b>${esc(placeTitle(a.place))}</b><span class="muted small block">${esc(placeTrail(a.place))}</span></div><span>›</span></li>`)
      .join("")}</ul></article>`;
  }

  function noteLi(n) {
    return `<li><span class="badge exam ${n.exam.toLowerCase()}">${n.exam}</span>${n.year ? ` <b>${n.year}</b> ·` : ""} ${esc(n.note)}${
      n.q && n.a
        ? `<details class="area-q"><summary>❓ ${esc(n.q)}</summary><p>✓ <b>${esc(n.a)}</b>${n.options.length ? ` <span class="muted small">· Not: ${esc(n.options.join(" · "))}</span>` : ""}</p></details>`
        : ""
    }</li>`;
  }

  function pasteCard(lvl) {
    return `<article class="card" id="areaPasteCard">
      <h3>📥 Paste the answer for ${esc(lvl.name)}</h3>
      <ol class="steps small"><li>Paste the copied prompt in <a href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a> or
        <a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a> and send.</li><li>Copy its <b>whole</b> answer and paste it here.</li></ol>
      <textarea id="areaPaste" rows="8" placeholder="## History&#10;- [SSC] …&#10;  Q: … | A: … | Wrong: …; …; …">${esc(gui.pasteDraft)}</textarea>
      <div class="row wrap"><button class="btn primary" type="button" data-action="area-read-paste">Read the notes</button>
        <button class="btn" type="button" data-action="area-copy" data-key="${lvl.key}">📋 Copy the prompt again</button>
        <button class="btn ghost" type="button" data-action="area-paste-close">Close</button></div>
    </article>`;
  }

  function viewLevel(area, lvl) {
    const ai = hasAI(settings());
    const data = area.levels[lvl.key];
    const all = data?.notes || [];
    const notes = gui.exam === "all" ? all : all.filter((n) => n.exam === gui.exam);
    const tools = `
      ${ai ? `<button class="btn small" type="button" data-action="area-make" data-key="${lvl.key}" ${gui.making ? "disabled" : ""}>🤖 ${all.length ? "Remake" : "Make notes"} with AI</button>` : ""}
      <button class="btn small" type="button" data-action="area-copy" data-key="${lvl.key}">📋 Copy prompt for Gemini</button>
      ${gui.pasteFor === lvl.key ? "" : `<button class="btn small" type="button" data-action="area-paste-open" data-key="${lvl.key}">📥 Paste answer</button>`}`;
    if (!all.length) {
      return `<article class="card">
          <h2>${lvl.icon} ${esc(lvl.name)}</h2>
          <p class="muted">No notes yet on ${esc(lvl.name)}.${ai ? "" : " Copy the prompt, ask Gemini or ChatGPT, and paste the answer back — no AI key needed."}</p>
          <div class="row wrap">${tools}</div>
        </article>
        ${gui.pasteFor === lvl.key ? pasteCard(lvl) : ""}`;
    }
    const sections = SECTIONS.map(([name, icon]) => [name, icon, notes.filter((n) => n.section === name)]).filter(([, , list]) => list.length);
    const withQ = all.filter((n) => n.q && n.a).length;
    return `<article class="card">
        <h2>${lvl.icon} ${esc(lvl.name)}</h2>
        <p class="muted small">${plural(all.length, "note")} in ${plural(new Set(all.map((n) => n.section)).size, "subject")}${data.by ? ` · by ${esc(data.by)}` : ""} · ${esc(
          new Date(data.madeAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        )}</p>
        <div class="row wrap">
          ${withQ ? `<button class="btn small primary" type="button" data-action="area-quiz" data-key="${lvl.key}">🎯 Quiz me (${withQ})</button>` : ""}
          <button class="btn small" type="button" data-action="area-save" data-key="${lvl.key}">➕ Save under Places Visited</button>
        </div>
        <details class="area-tools"><summary class="small">More: remake, prompt, paste</summary><div class="row wrap">${tools}</div></details>
      </article>
      ${gui.pasteFor === lvl.key ? pasteCard(lvl) : ""}
      ${
        sections.length
          ? sections
              .map(
                ([name, icon, list]) => `<details class="card area-sec" open><summary><span>${icon} <b>${esc(name)}</b></span><span class="muted small">${list.length}</span></summary>
                  <ul class="area-notes">${list.map(noteLi).join("")}</ul></details>`,
              )
              .join("")
          : `<p class="muted center">No ${esc(gui.exam)} notes at this level.</p>`
      }
      <p class="muted small center">Written by AI — check any fact you plan to rely on against NCERT, the state's official website or a standard book.</p>`;
  }

  function viewArea() {
    if (gui.draft) return viewConfirm();
    const area = gk.currentArea();
    if (!area) return viewIntro();
    const levels = levelsOf(area.place);
    if (!levels.some((l) => l.key === gui.level)) gui.level = (levels.find((l) => area.levels[l.key]?.notes?.length) || levels[0])?.key || null;
    const lvl = levels.find((l) => l.key === gui.level);
    const all = levels.flatMap((l) => area.levels[l.key]?.notes || []);
    const levelNotes = area.levels[gui.level]?.notes || [];
    const missing = levels.filter((l) => !area.levels[l.key]?.notes?.length);
    const ai = hasAI(settings());
    const areas = gk.get().areas;
    return `${back}
      <section class="today-head"><div><p class="eyebrow">📍 My Area</p><h1>${esc(placeTitle(area.place))}</h1>
        <p class="muted small">${esc(placeTrail(area.place))}</p></div></section>
      <div class="row wrap">
        <button class="btn small" type="button" data-action="area-locate">📍 Where am I now?</button>
        <button class="btn small" type="button" data-action="area-edit">✏️ Edit place</button>
        ${
          areas.length > 1
            ? `<select data-input="area-pick" aria-label="Your places">${areas.map((a) => `<option value="${esc(a.id)}" ${a.id === area.id ? "selected" : ""}>${esc(placeTitle(a.place))}</option>`).join("")}<option value="">＋ Another place…</option></select>`
            : `<button class="btn small" type="button" data-action="area-new">＋ Another place</button>`
        }
      </div>
      ${gui.busy ? busyCard() : ""}
      ${ai && missing.length && !gui.making ? `<button class="btn primary block" type="button" data-action="area-make-all">🤖 Make notes for ${missing.length === levels.length ? `all ${levels.length} levels` : plural(missing.length, "remaining level")}</button>` : ""}
      ${ai && !gui.making ? keyPicker() : ""}
      <div class="seg area-levels" style="grid-template-columns: repeat(${levels.length}, 1fr)" role="tablist">${levels
        .map(
          (l) =>
            `<button type="button" class="${l.key === gui.level ? "active" : ""}" data-action="area-level" data-key="${l.key}"><span>${l.icon} ${esc(l.label)}</span><small>${
              area.levels[l.key]?.notes?.length || "–"
            }</small></button>`,
        )
        .join("")}</div>
      ${
        levelNotes.length
          ? `<div class="chips"><span class="chip-label">Exam</span>${[["all", `All (${levelNotes.length})`], ...EXAM_TAGS.map((t) => [t, `${t} (${levelNotes.filter((n) => n.exam === t).length})`])]
              .map(([k, l]) => `<button type="button" class="chip ${gui.exam === k ? "on" : ""}" data-action="area-exam" data-exam="${k}" title="${esc(EXAM_HINT[k] || "every note")}">${l}</button>`)
              .join("")}</div>`
          : ""
      }
      ${lvl ? viewLevel(area, lvl) : ""}
      ${all.length ? "" : placesList()}`;
  }

  // ---------- actions ----------
  const actions = {
    "area-locate": () => locate(),
    "area-find": () => findTyped(),
    "area-confirm": () => confirmPlace(),
    "area-cancel": () => {
      gui.draft = null;
      render();
    },
    "area-edit": () => {
      const area = gk.currentArea();
      if (area) gui.draft = { place: { ...area.place }, id: area.id };
      render();
    },
    "area-delete": () => {
      const id = gui.draft?.id;
      if (!id || !confirm("Delete this place and all its notes? (Questions already saved to your GK stay.)")) return;
      gk.deleteArea(id);
      ctx.afterChange();
      gui.draft = null;
      gui.level = null;
      render();
    },
    "area-new": () => {
      gui.asked = true; // don't ask for the location again by itself
      gk.showArea("__new__");
      render();
    },
    "area-open": (el) => {
      gk.showArea(el.dataset.id);
      gui.level = null;
      render();
    },
    "area-level": (el) => {
      gui.level = el.dataset.key;
      render();
    },
    "area-exam": (el) => {
      gui.exam = el.dataset.exam;
      render();
    },
    "area-make": (el) => {
      const area = gk.currentArea();
      if (area) makeNotes(area.id, [el.dataset.key]);
    },
    "area-make-all": () => {
      const area = gk.currentArea();
      if (area) makeNotes(area.id, levelsOf(area.place).filter((l) => !area.levels[l.key]?.notes?.length).map((l) => l.key));
    },
    "area-copy": (el) => copyPrompt(el.dataset.key),
    "area-paste-open": (el) => {
      gui.pasteFor = el.dataset.key;
      render();
      $("#areaPasteCard")?.scrollIntoView({ block: "start" });
    },
    "area-paste-close": () => {
      gui.pasteFor = null;
      render();
    },
    "area-read-paste": () => readPaste(),
    "area-save": (el) => saveLevel(el.dataset.key),
    "area-quiz": (el) => {
      const ids = saveLevel(el.dataset.key, { quiet: true });
      const qids = ids.filter((id) => gk.byId(id)?.a);
      if (!qids.length) return toast("No questions at this level yet.");
      gkui.quizOn(qids);
    },
  };

  function onChange(e) {
    const t = e.target;
    if (t.dataset?.input !== "area-pick") return false;
    if (t.value) {
      gk.showArea(t.value);
      gui.level = null;
    } else gk.showArea("__new__");
    gui.asked = true;
    render();
    return true;
  }

  return {
    gui,
    views: { "k-area": viewArea },
    actions,
    onChange,
    busy: () => Boolean(gui.busy || gui.draft || gui.pasteFor),
  };
}
