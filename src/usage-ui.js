// Settings → 📊 AI limits & usage: for every key and service, what is known about its allowance today.
// Gemini doesn't report what is left, so for Gemini this is the app's own count, plus the limit Google names when one is
// reached. Services that send rate-limit headers (and let the browser read them) show their own remaining numbers.
import { PACIFIC, nextMidnight, serviceId, usageOf } from "./lib/usage.js";
import { geminiKeysOf, keyStatus } from "./lib/gemini.js";
import { extraServicesOf, serviceName } from "./lib/compat.js";

const MYMEMORY_FREE_CHARS = 5000; // MyMemory: free anonymous use, characters a day

export function createUsageUI({ esc, plural, render, toast, settings }) {
  const checked = new Map(); // service id -> {at, text} from a "Check" tap (OpenRouter's key endpoint)
  const time = (t) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const n = (v) => Number(v).toLocaleString("en-IN");
  const fmtWait = (ms) => (ms < 90e3 ? `${Math.ceil(ms / 1000)} s` : ms < 90 * 60e3 ? `${Math.round(ms / 60e3)} min` : `${Math.round(ms / 36e5)} h`);

  /** The lines for one key or service. */
  function lines(id, { tz = "", models = true } = {}) {
    const u = usageOf(id, tz);
    const out = [];
    const used = u.today.requests;
    const byModel = Object.entries(u.today.models);
    out.push(
      `<b>Today:</b> ${plural(used, "request")}${
        models && byModel.length > 1 ? ` <span class="muted">(${byModel.map(([m, c]) => `${esc(m.replace(/^gemini-/, ""))} ${c}`).join(" · ")})</span>` : ""
      }`,
    );
    // 1. Numbers the service itself sent in its reply headers.
    if (u.live && Date.now() - u.live.at < 24 * 36e5) {
      for (const l of u.live.limits) {
        const reset = l.resetMs != null ? Math.max(0, l.resetMs - (Date.now() - u.live.at)) : null;
        out.push(
          `<b>Left:</b> ${n(l.remaining)}${l.limit != null ? ` of ${n(l.limit)}` : ""} ${esc(l.label)}${
            reset ? ` <span class="muted">· resets in ${fmtWait(reset)}</span>` : ""
          } <span class="muted small">(as of ${time(u.live.at)})</span>`,
        );
      }
    }
    // 2. Limits the service named when one was reached.
    for (const l of u.limits) {
      const usedOfModel = l.model === "any" ? used : u.today.models[l.model] || 0;
      const left = l.per === "day" && l.what === "requests" ? Math.max(0, l.value - usedOfModel) : null;
      out.push(
        `<b>Limit${l.model !== "any" ? ` (${esc(l.model.replace(/^gemini-/, ""))})` : ""}:</b> ${n(l.value)} ${l.what} a ${l.per}${
          left != null ? ` → about <b>${n(left)} left</b> today` : ""
        }`,
      );
    }
    // 3. Reached today.
    if (u.hit) {
      const wait = u.hit.until && u.hit.until > Date.now() ? ` · try again in ${fmtWait(u.hit.until - Date.now())}` : "";
      out.push(`<span class="warn">⛔ Limit reached at ${time(u.hit.at)}${u.hit.model ? ` (${esc(u.hit.model)})` : ""}${wait}</span>`);
    }
    return { out, u };
  }

  function card(st) {
    const rows = [];
    const reset = nextMidnight(PACIFIC);
    // Gemini keys
    geminiKeysOf(st).forEach((k, i) => {
      const { out, u } = lines(serviceId("gemini", k), { tz: PACIFIC });
      const ks = keyStatus(k);
      const state =
        ks.state === "resting" ? `<span class="badge learning">resting until ${time(ks.until)}</span>` : ks.state === "invalid" ? `<span class="badge easy">not working</span>` : "";
      if (!u.live && !u.limits.length) {
        out.push(`<span class="muted">Google doesn't tell apps how much is left. The exact daily limits for your key are on its
          <a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noopener">rate-limits page</a> and in
          <a href="https://aistudio.google.com/" target="_blank" rel="noopener">AI Studio</a>. When a limit is reached, the number Google gives is shown here.</span>`);
      }
      out.push(`<span class="muted small">Gemini's daily count restarts at ${time(reset)} (midnight Pacific time).</span>`);
      rows.push(row(`✨ Gemini key ${i + 1} <code>${esc(k.slice(0, 4))}…${esc(k.slice(-4))}</code> ${state}`, out));
    });
    // Other free services
    for (const e of extraServicesOf(st)) {
      const id = serviceId(e.provider, e.key);
      const { out, u } = lines(id);
      if (!u.live && !u.limits.length) out.push(`<span class="muted">No limit figures received yet — they appear after the next request if ${esc(serviceName(st, e))} shares them.</span>`);
      const c = checked.get(id);
      if (c) out.push(c.text);
      const btn = e.provider === "openrouter" ? `<button class="btn small" type="button" data-action="usage-check" data-id="${esc(e.id)}">Check credits</button>` : "";
      rows.push(row(`🧩 ${esc(serviceName(st, e))} <code>${esc(e.key.slice(0, 4))}…${esc(e.key.slice(-4))}</code>`, out, btn));
    }
    // Claude
    if (st.apiKey) {
      const { out, u } = lines(serviceId("claude", st.apiKey), { models: false });
      if (!u.live) out.push(`<span class="muted">Claude is paid per use: see your balance in the <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener">Anthropic Console</a>.</span>`);
      rows.push(row("🤖 Claude", out));
    }
    // Free services without keys
    const mm = usageOf("mymemory");
    const left = Math.max(0, MYMEMORY_FREE_CHARS - mm.today.chars);
    rows.push(
      row("🔤 Hindi / Tamil meanings <span class=\"muted small\">(MyMemory)</span>", [
        mm.hit
          ? `<span class="warn">⛔ Today's free translations are used up — meanings resume tomorrow.</span>`
          : `<b>Today:</b> ${n(mm.today.chars)} characters → about <b>${n(left)}</b> of ${n(MYMEMORY_FREE_CHARS)} left`,
      ]),
    );
    rows.push(row("📖 Free dictionaries", [`<span class="muted">No daily limit.</span>`]));
    return `<article class="card" id="usageCard">
      <div class="row between"><h3>📊 AI limits & usage</h3><button class="icon-btn small" type="button" data-action="usage-refresh" aria-label="Refresh">⟳</button></div>
      <p class="muted small">Counted on this phone. When one key or service runs out, the app moves to the next one by itself.</p>
      <ul class="usage-list">${rows.join("")}</ul>
    </article>`;
  }

  const row = (title, items, extra = "") => `<li><div class="usage-title">${title}</div>${items.map((x) => `<div class="small">${x}</div>`).join("")}${extra ? `<div class="row">${extra}</div>` : ""}</li>`;

  /** OpenRouter tells a key's credit use and limit on request (this doesn't use any allowance). */
  async function checkOpenRouter(entry) {
    const id = serviceId(entry.provider, entry.key);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${entry.key}` } });
      if (!res.ok) throw new Error(`OpenRouter answered ${res.status}`);
      const d = (await res.json()).data || {};
      const parts = [];
      if (d.is_free_tier != null) parts.push(d.is_free_tier ? "free tier (no credits bought)" : "has bought credits");
      if (d.usage != null) parts.push(`credits used: $${Number(d.usage).toFixed(2)}`);
      if (d.limit != null) parts.push(`credit limit: $${Number(d.limit).toFixed(2)}`);
      if (d.limit_remaining != null) parts.push(`left: $${Number(d.limit_remaining).toFixed(2)}`);
      checked.set(id, { at: Date.now(), text: `<b>OpenRouter says:</b> ${esc(parts.join(" · ") || "no details")}` });
    } catch (e) {
      toast(`Couldn't check: ${e.message}`, 5000);
    }
    render();
  }

  return {
    card,
    actions: {
      "usage-refresh": () => render(),
      "usage-check": (el) => {
        const entry = extraServicesOf(settings()).find((x) => x.id === el.dataset.id);
        if (entry) checkOpenRouter(entry);
      },
    },
  };
}
