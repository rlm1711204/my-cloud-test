/* =====================================================================
 * charts.js — small, dependency-free charts drawn as SVG.
 *   Charts.columns(el, opts)  — column chart (1–3 series) with tap/hover tooltip
 *   Charts.barList(el, rows)  — ranked horizontal bars (spending by category)
 * Colours come from CSS variables so light/dark mode just works.
 * ===================================================================== */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const compact = (n) => {
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'Cr';
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(n >= 1e6 ? 0 : 1).replace(/\.0$/, '') + 'L';
    if (n >= 1e3) return '₹' + (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return '₹' + Math.round(n);
  };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /** Round numbers for the axis: 0 / 500 / 1,000 … */
  function niceMax(v) {
    if (v <= 0) return { max: 100, ticks: 4 };
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    // each top value paired with a tick count that gives round steps (e.g. 15K -> 0/5K/10K/15K)
    for (const [m, ticks] of [[1, 4], [1.5, 3], [2, 4], [2.5, 5], [3, 3], [4, 4], [5, 5], [6, 3], [8, 4], [10, 5]]) if (m * p >= v) return { max: m * p, ticks };
    return { max: 10 * p, ticks: 5 };
  }

  /** Column with a 4px rounded top and a square bottom sitting on the baseline. */
  function colPath(x, y, w, h) {
    if (h <= 0) return '';
    const r = Math.min(4, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  /**
   * opts = {
   *   labels: ['1','2',…],             x-axis labels
   *   titles: ['1 Sep',…],             (optional) tooltip headings
   *   series: [{ name, color: 'var(--c-spend)', values: [...] }],
   *   height: 200, labelEvery: 5
   * }
   */
  function columns(host, opts) {
    host.innerHTML = '';
    host.classList.add('chart');
    const series = opts.series;
    const n = opts.labels.length;
    const W = Math.max(280, host.clientWidth || 320);
    const H = opts.height || 200;
    const pad = { t: 12, r: 8, b: 26, l: 44 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    if (series.length > 1) {
      const lg = document.createElement('div');
      lg.className = 'legend';
      lg.innerHTML = series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');
      host.appendChild(lg);
    }

    const { max, ticks } = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': opts.aria || 'Chart' });
    host.appendChild(svg);

    // grid + y ticks
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i;
      const y = pad.t + ih - (v / max) * ih;
      el('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: i === 0 ? 'axis' : 'grid' }, svg);
      const t = el('text', { x: pad.l - 6, y: y + 4, 'text-anchor': 'end', class: 'tick' }, svg);
      t.textContent = compact(v);
    }

    const band = iw / n;
    const gap = 2; // surface gap between touching bars
    const groupW = Math.min(band * 0.72, 24 * series.length + gap * (series.length - 1));
    const barW = Math.max(2, (groupW - gap * (series.length - 1)) / series.length);
    const every = opts.labelEvery || Math.ceil(n / 8);

    for (let i = 0; i < n; i++) {
      const gx = pad.l + band * i + (band - groupW) / 2;
      series.forEach((s, si) => {
        const v = s.values[i] || 0;
        const h = (v / max) * ih;
        const d = colPath(gx + si * (barW + gap), pad.t + ih - h, barW, h);
        if (d) el('path', { d, fill: s.color, class: 'bar' }, svg);
      });
      if (i % every === 0 || i === n - 1) {
        const t = el('text', { x: pad.l + band * i + band / 2, y: H - 8, 'text-anchor': 'middle', class: 'tick' }, svg);
        t.textContent = opts.labels[i];
      }
    }

    // tooltip layer — the hit target is the whole column band, bigger than the bar
    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.hidden = true;
    host.appendChild(tip);
    const hl = el('rect', { y: pad.t, height: ih, width: band, class: 'hover-band', opacity: 0 }, svg);
    svg.insertBefore(hl, svg.firstChild);

    const show = (evt) => {
      const r = svg.getBoundingClientRect();
      const x = (evt.clientX - r.left) * (W / r.width);
      const i = Math.floor((x - pad.l) / band);
      if (i < 0 || i >= n) { hide(); return; }
      hl.setAttribute('x', pad.l + band * i);
      hl.setAttribute('opacity', 1);
      const head = (opts.titles && opts.titles[i]) || opts.labels[i];
      tip.innerHTML = `<b>${head}</b>` + series.map((s) => `<div>${series.length > 1 ? `<i style="background:${s.color}"></i>${s.name} ` : ''}<span>${inr(s.values[i] || 0)}</span></div>`).join('');
      tip.hidden = false;
      const hostR = host.getBoundingClientRect();
      const cx = r.left - hostR.left + (pad.l + band * i + band / 2) * (r.width / W);
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(host.clientWidth - tw, cx - tw / 2)) + 'px';
      tip.style.top = (r.top - hostR.top) + 'px';
    };
    const hide = () => { tip.hidden = true; hl.setAttribute('opacity', 0); };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  }

  /** rows = [{ label, icon, amount }] — biggest first. Values are labelled at the bar ends. */
  function barList(host, rows, opts) {
    opts = opts || {};
    host.innerHTML = '';
    if (!rows.length) { host.innerHTML = `<p class="empty">${opts.empty || 'Nothing here yet.'}</p>`; return; }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const max = rows[0].amount || 1;
    const color = opts.color || 'var(--c-spend)';
    host.innerHTML = rows.map((r) => {
      const pct = total ? Math.round((r.amount / total) * 100) : 0;
      return `<button class="barrow" data-cat="${r.label}" title="${r.label}: ${inr(r.amount)} (${pct}%)">
        <span class="bl-label"><span class="bl-ico">${r.icon || ''}</span>${r.label}</span>
        <span class="bl-track"><span class="bl-fill" style="width:${Math.max(1.5, (r.amount / max) * 100)}%;background:${color}"></span></span>
        <span class="bl-val">${inr(r.amount)} <small>${pct}%</small></span>
      </button>`;
    }).join('');
  }

  root.Charts = { columns, barList, inr, compact };
})(self);
