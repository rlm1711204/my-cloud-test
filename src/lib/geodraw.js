// Exact geometry figures from a short construction description ("DRAW" lines), so figures never depend on an AI's
// guessed coordinates. The AI (or a person) only says WHAT is in the figure:
//
//   circle O r=5
//   point P outside O dist=13
//   tangents T S from P to O
//   segment O T, O P
//   right O T P
//   label O T "5"
//
// and this file computes every point (tangent points, feet of perpendiculars, centres, intersections…), fits the
// figure to the box, places the labels where they don't collide, and draws a clean SVG. Anything it cannot
// understand is reported as an error, so a wrong figure is never shown. Pure; unit-tested.

const W = 240;
const H = 170;
const PAD = 24;

// ---------- vectors ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const dist = (a, b) => len(sub(a, b));
const unit = (a) => {
  const n = len(a) || 1;
  return [a[0] / n, a[1] / n];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const rot = (a, deg) => {
  const t = (deg * Math.PI) / 180;
  return [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
};
const polar = (c, r, deg) => [c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] + r * Math.sin((deg * Math.PI) / 180)];
const mid = (a, b) => mul(add(a, b), 0.5);
const foot = (p, a, b) => {
  const ab = sub(b, a);
  return add(a, mul(ab, dot(sub(p, a), ab) / dot(ab, ab)));
};
function lineX(p1, p2, p3, p4) {
  const d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
  if (Math.abs(d) < 1e-9) throw new GeoError("those lines are parallel — they don't meet");
  const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d;
  return add(p1, mul(sub(p2, p1), t));
}
/** Where the line from p in direction u meets a circle: [near, far] (or [] if it misses). */
function lineCircle(p, u, c, r) {
  const f = sub(p, c);
  const b = 2 * dot(u, f);
  const cc = dot(f, f) - r * r;
  const disc = b * b - 4 * cc;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  return [(-b - s) / 2, (-b + s) / 2].map((t) => add(p, mul(u, t)));
}
const circumcentre = (a, b, c) => {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) throw new GeoError("those points are in a straight line");
  const s = (p) => p[0] * p[0] + p[1] * p[1];
  return [(s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d, (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d];
};
const incentre = (a, b, c) => {
  const [la, lb, lc] = [dist(b, c), dist(a, c), dist(a, b)];
  const s = la + lb + lc;
  return [(la * a[0] + lb * b[0] + lc * c[0]) / s, (la * a[1] + lb * b[1] + lc * c[1]) / s];
};

export class GeoError extends Error {}

// ---------- reading the description ----------
const NAME = /^[A-Z][0-9]*'*$/;
const NUM = /^-?\d+(?:\.\d+)?$/;

function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|“([^”]*)”|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[4] === undefined) out.push({ quoted: m[1] ?? m[2] ?? m[3] });
    else for (const piece of m[4].replace(/[∠△⊙°,()]/g, " ").split(/\s+/).filter(Boolean)) out.push(piece);
  }
  return out;
}

/** Split a command line into names (A, B, O, T1…), key=value pairs, numbers, words and the quoted text. */
function parts(tokens, known) {
  const names = [];
  const kv = {};
  const nums = [];
  const words = [];
  let text = null;
  for (const t of tokens) {
    if (typeof t === "object") {
      text ??= t.quoted;
      continue;
    }
    const eq = /^([A-Za-z][\w']*)\s*[=:]\s*(.+)$/.exec(t);
    if (eq && !/^\d/.test(eq[1])) {
      kv[eq[1]] = eq[2];
      continue;
    }
    if (NUM.test(t)) {
      nums.push(Number(t));
      continue;
    }
    if (/^\d+:\d+$/.test(t)) {
      kv.ratio = t;
      continue;
    }
    if (NAME.test(t)) {
      names.push(t);
      continue;
    }
    // "AB" or "ABC" (several one-letter names written together)
    if (/^(?:[A-Z][0-9]*'*){2,4}$/.test(t) && !known.has(t)) {
      names.push(...t.match(/[A-Z][0-9]*'*/g));
      continue;
    }
    words.push(t.toLowerCase());
  }
  return { names, kv, nums, words, text };
}

const numKV = (kv, ...keys) => {
  for (const k of keys) {
    const hit = Object.keys(kv).find((x) => x.toLowerCase() === k.toLowerCase());
    if (hit !== undefined) {
      const v = parseFloat(kv[hit]);
      if (Number.isFinite(v)) return v;
    }
  }
  return undefined;
};

// ---------- building the figure ----------
function solveTriangle(p, kv, words) {
  // Sides: c = |p0 p1|, a = |p1 p2|, b = |p0 p2|; angles at p0, p1, p2.
  const key = (x, y) => [x + y, y + x];
  const side = (x, y) => numKV(kv, ...key(x, y));
  let [c, a, b] = [side(p[0], p[1]), side(p[1], p[2]), side(p[0], p[2])];
  const ang = p.map((n) => numKV(kv, n, `angle${n}`));
  const right = words.findIndex((w) => /^right/.test(w)) >= 0;
  const rightAt = right ? (p.indexOf(words._rightAt) >= 0 ? p.indexOf(words._rightAt) : 1) : -1;
  if (words.includes("equilateral")) [ang[0], ang[1], ang[2]] = [60, 60, 60];
  if (rightAt >= 0) ang[rightAt] = 90;
  if (words.includes("isosceles")) {
    if (ang[0] !== undefined) ang[1] = ang[2] = (180 - ang[0]) / 2;
    else if (ang[1] !== undefined || ang[2] !== undefined) {
      ang[1] = ang[2] = ang[1] ?? ang[2];
      ang[0] = 180 - 2 * ang[1];
    } else [ang[0], ang[1], ang[2]] = [50, 65, 65];
  }
  const sides = () => [c, a, b];
  const known = ang.filter((x) => x !== undefined).length;
  const rad = (d) => (d * Math.PI) / 180;
  if ([c, a, b].every((x) => x > 0)) {
    // three sides
  } else if (known >= 2) {
    const i = ang.findIndex((x) => x === undefined);
    if (i >= 0) ang[i] = 180 - ang.reduce((s, x) => s + (x ?? 0), 0);
    if (ang.some((x) => !(x > 0))) throw new GeoError("those angles don't make a triangle");
    // law of sines; scale from any side given
    const opp = [a, b, c]; // side opposite p0, p1, p2
    const k = opp.map((s, j) => (s > 0 ? s / Math.sin(rad(ang[j])) : null)).find((x) => x) ?? 10 / Math.sin(rad(ang[0]));
    [a, b, c] = ang.map((x) => k * Math.sin(rad(x)));
  } else if (known === 1) {
    const j = ang.findIndex((x) => x !== undefined);
    const opp = [a, b, c];
    // the two sides next to the known angle
    const adj = [opp[(j + 1) % 3], opp[(j + 2) % 3]];
    if (adj[0] > 0 && adj[1] > 0) {
      opp[j] = Math.sqrt(adj[0] ** 2 + adj[1] ** 2 - 2 * adj[0] * adj[1] * Math.cos(rad(ang[j])));
      [a, b, c] = opp;
    } else if (ang[j] === 90 && opp.filter((x) => x > 0).length >= 2) {
      if (!(opp[j] > 0)) opp[j] = Math.hypot(adj[0], adj[1]);
      else {
        const k = adj[0] > 0 ? 1 : 0;
        adj[1 - k] = Math.sqrt(opp[j] ** 2 - adj[k] ** 2);
        opp[(j + 1) % 3] = adj[0];
        opp[(j + 2) % 3] = adj[1];
      }
      [a, b, c] = opp;
    } else {
      const rest = (180 - ang[j]) / 2;
      const others = [rest + 6, rest - 6];
      const full = [...ang];
      full[(j + 1) % 3] = others[0];
      full[(j + 2) % 3] = others[1];
      const s0 = opp.map((s, i) => (s > 0 ? s / Math.sin(rad(full[i])) : null)).find((x) => x) ?? 10 / Math.sin(rad(full[0]));
      [a, b, c] = full.map((x) => s0 * Math.sin(rad(x)));
    }
  } else {
    const full = [62, 54, 64];
    const opp = [a, b, c];
    if (opp.filter((x) => x > 0).length === 2) {
      // two sides: put a 60° angle between them
      const j = opp.findIndex((x) => !(x > 0));
      const adj = [opp[(j + 1) % 3], opp[(j + 2) % 3]];
      opp[j] = Math.sqrt(adj[0] ** 2 + adj[1] ** 2 - adj[0] * adj[1]);
      [a, b, c] = opp;
    } else {
      const k = opp.map((s, i) => (s > 0 ? s / Math.sin(rad(full[i])) : null)).find((x) => x) ?? 10 / Math.sin(rad(full[0]));
      [a, b, c] = full.map((x) => k * Math.sin(rad(x)));
    }
  }
  if (!(a > 0 && b > 0 && c > 0) || a + b <= c + 1e-9 || a + c <= b + 1e-9 || b + c <= a + 1e-9) throw new GeoError("those sides don't make a triangle");
  // p1 at the origin, p2 on the x-axis, p0 above.
  const x = (c * c + a * a - b * b) / (2 * a);
  const y = Math.sqrt(Math.max(0, c * c - x * x));
  return { [p[1]]: [0, 0], [p[2]]: [a, 0], [p[0]]: [x, y], sides: sides() };
}

class Figure {
  constructor() {
    this.pts = new Map(); // name -> [x, y]
    this.circles = new Map(); // centre name -> r
    this.items = []; // drawing commands
    this.hidden = new Set();
    this.noDot = new Set();
    this.tickCount = 0;
    this.base = 10; // a typical length, for default sizes
  }
  has(n) {
    return this.pts.has(n);
  }
  p(n) {
    const v = this.pts.get(n);
    if (!v) throw new GeoError(`point ${n} is not defined yet`);
    return v;
  }
  set(n, v, { dot = false } = {}) {
    if (!v || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) throw new GeoError(`could not work out point ${n}`);
    this.pts.set(n, v);
    if (dot) this.items.push({ t: "dot", n });
  }
  circleR(n) {
    const r = this.circles.get(n);
    if (!r) throw new GeoError(`circle ${n} is not defined yet`);
    return r;
  }
  seg(a, b, o = {}) {
    this.p(a);
    this.p(b);
    if (!this.items.some((i) => i.t === "seg" && ((i.a === a && i.b === b) || (i.a === b && i.b === a)) && !o.dash)) this.items.push({ t: "seg", a, b, ...o });
  }
}

const need = (names, n, what) => {
  if (names.length < n) throw new GeoError(`${what} needs ${n} point name${n > 1 ? "s" : ""}`);
  return names.slice(0, n);
};

function run(fig, line) {
  const tokens = tokenize(line.replace(/^\s*(?:draw|fig|figure)\s*[:\-–]\s*/i, ""));
  if (!tokens.length) return;
  let cmd = String(tokens[0]).toLowerCase().replace(/[^a-z-]/g, "");
  const { names, kv, nums, words, text } = parts(tokens.slice(1), fig.pts);
  const at = numKV(kv, "at", "angle", "deg") ?? (words.includes("at") ? nums[0] : undefined);
  const aliases = { triangle: "triangle", tri: "triangle", circle: "circle", segment: "segment", segments: "segment", join: "segment", seg: "segment", side: "segment", sides: "segment", radius: "segment", chord: "chord", chords: "chord" };
  cmd = aliases[cmd] ?? cmd;

  switch (cmd) {
    case "triangle": {
      const p = need(names, 3, "triangle");
      const ri = words.findIndex((w) => /^right/.test(w));
      if (ri >= 0) words._rightAt = names[3] ?? kv[Object.keys(kv).find((k) => k.toLowerCase() === "right")] ?? p[1];
      const t = solveTriangle(p, kv, words);
      // keep any triangle already placed (a second triangle sharing points is placed on its own)
      if (p.every((n) => !fig.has(n))) for (const n of p) fig.set(n, t[n]);
      else if (p.some((n) => !fig.has(n))) throw new GeoError("a triangle must use three new points or three existing ones");
      fig.base = Math.max(...t.sides);
      fig.items.push({ t: "poly", ns: p });
      if (words._rightAt && p.includes(words._rightAt)) {
        const i = p.indexOf(words._rightAt);
        fig.items.push({ t: "right", a: p[(i + 1) % 3], b: p[i], c: p[(i + 2) % 3] });
      }
      return;
    }
    case "circle": {
      const [o] = need(names, 1, "circle");
      let r = numKV(kv, "r", "radius");
      if (names[1] && (words.includes("through") || words.includes("passing"))) {
        if (!fig.has(o)) throw new GeoError(`centre ${o} is not defined yet`);
        r = dist(fig.p(o), fig.p(names[1]));
      }
      if (!fig.has(o)) fig.set(o, [0, 0]);
      r ??= fig.base / 2 || 5;
      if (!fig.circles.size && !fig.items.length) fig.base = 2 * r;
      fig.circles.set(o, r);
      fig.items.push({ t: "circle", c: o, dash: words.includes("dashed") });
      fig.items.push({ t: "dot", n: o });
      return;
    }
    case "point":
    case "points": {
      const onIdx = words.indexOf("on");
      const circle = names.find((n) => fig.circles.has(n) && names.indexOf(n) > 0);
      if (words.includes("outside") || words.includes("external")) {
        const [pn, o] = need(names, 2, "point … outside");
        const d = numKV(kv, "dist", "d", "distance", `${pn}${o}`, `${o}${pn}`) ?? nums[0] ?? fig.circleR(o) * 2.6;
        if (d <= fig.circleR(o)) throw new GeoError(`${pn} must be farther than the radius from ${o}`);
        fig.set(pn, polar(fig.p(o), d, at ?? 0));
        return;
      }
      if (onIdx >= 0 && circle) {
        const ps = names.filter((n) => n !== circle);
        const angles = at !== undefined && ps.length === 1 ? [at] : nums.length >= ps.length ? nums : ps.map((_, i) => 110 + (360 / ps.length) * i);
        ps.forEach((n, i) => fig.set(n, polar(fig.p(circle), fig.circleR(circle), angles[i])));
        return;
      }
      if (onIdx >= 0 && names.length >= 3) {
        // point P on A B ratio 1:2   /   point P on A B (middle)
        const [pn, a, b] = names;
        const [m, n] = (kv.ratio || "1:1").split(":").map(Number);
        fig.set(pn, add(fig.p(a), mul(sub(fig.p(b), fig.p(a)), m / (m + n))));
        return;
      }
      if (names.length === 1 && nums.length >= 2) {
        fig.set(names[0], [nums[0], nums[1]]);
        return;
      }
      throw new GeoError("point: say where it is (on a circle, outside a circle, on a segment, or x y)");
    }
    case "diameter": {
      const [a, b] = need(names, 2, "diameter");
      const o = names[2] && fig.circles.has(names[2]) ? names[2] : [...fig.circles.keys()][0];
      if (!o) throw new GeoError("diameter: draw the circle first");
      const t = at ?? 0;
      fig.set(a, polar(fig.p(o), fig.circleR(o), t + 180));
      fig.set(b, polar(fig.p(o), fig.circleR(o), t));
      fig.seg(a, b);
      return;
    }
    case "chord": {
      const ns = names.filter((n) => !fig.circles.has(n) || fig.has(n) === false);
      for (let i = 0; i + 1 < ns.length; i += 2) fig.seg(ns[i], ns[i + 1]);
      return;
    }
    case "midpoint": {
      const [m, a, b] = need(names, 3, "midpoint");
      fig.set(m, mid(fig.p(a), fig.p(b)), { dot: true });
      return;
    }
    case "foot":
    case "altitude":
    case "perpendicular": {
      // foot D from A to B C
      const [d, a, b, c] = need(names, 4, cmd);
      fig.set(d, foot(fig.p(a), fig.p(b), fig.p(c)));
      fig.seg(a, d, { dash: true });
      fig.items.push({ t: "right", a, b: d, c: dist(fig.p(d), fig.p(b)) > 1e-6 ? b : c });
      return;
    }
    case "median": {
      const [d, a, b, c] = need(names, 4, "median");
      fig.set(d, mid(fig.p(b), fig.p(c)));
      fig.seg(a, d, { dash: true });
      fig.tickCount += 1;
      fig.items.push({ t: "ticks", a: b, b: d, n: fig.tickCount }, { t: "ticks", a: d, b: c, n: fig.tickCount });
      return;
    }
    case "bisector": {
      const [d, a, b, c] = need(names, 4, "bisector");
      const [A, B, C] = [fig.p(a), fig.p(b), fig.p(c)];
      const k = dist(A, B) / (dist(A, B) + dist(A, C));
      fig.set(d, add(B, mul(sub(C, B), k)));
      fig.seg(a, d, { hl: true });
      fig.items.push({ t: "arc", a: b, b: a, c: d, n: 1 }, { t: "arc", a: d, b: a, c, n: 1 });
      return;
    }
    case "divide": {
      const [d, a, b] = need(names, 3, "divide");
      const [m, n] = (kv.ratio || `${nums[0] ?? 1}:${nums[1] ?? 1}`).split(":").map(Number);
      if (!(m > 0 && n > 0)) throw new GeoError("divide: give a ratio like 2:3");
      fig.set(d, add(fig.p(a), mul(sub(fig.p(b), fig.p(a)), m / (m + n))), { dot: true });
      return;
    }
    case "centroid":
    case "incentre":
    case "incenter":
    case "circumcentre":
    case "circumcenter":
    case "orthocentre":
    case "orthocenter":
    case "incircle":
    case "circumcircle": {
      const [o, a, b, c] = need(names, 4, cmd);
      const [A, B, C] = [fig.p(a), fig.p(b), fig.p(c)];
      const kind = cmd.replace("center", "centre");
      let v;
      if (kind === "centroid") v = mul(add(add(A, B), C), 1 / 3);
      else if (kind === "incentre" || kind === "incircle") v = incentre(A, B, C);
      else if (kind === "circumcentre" || kind === "circumcircle") v = circumcentre(A, B, C);
      else v = lineX(A, foot(A, B, C), B, foot(B, A, C));
      fig.set(o, v, { dot: true });
      if (kind === "incircle" || (kind === "incentre" && words.includes("circle"))) {
        fig.circles.set(o, dist(v, foot(v, B, C)));
        fig.items.push({ t: "circle", c: o, dash: true });
      }
      if (kind === "circumcircle" || (kind === "circumcentre" && words.includes("circle"))) {
        fig.circles.set(o, dist(v, A));
        fig.items.push({ t: "circle", c: o, dash: true });
      }
      return;
    }
    case "intersect":
    case "meet": {
      const [x, a, b, c, d] = need(names, 5, cmd);
      fig.set(x, lineX(fig.p(a), fig.p(b), fig.p(c), fig.p(d)), { dot: true });
      return;
    }
    case "tangents":
    case "tangent": {
      if (words.includes("at") || (names.length === 2 && fig.circles.has(names[1]) && fig.has(names[0]) && !words.includes("from"))) {
        // tangent at T (of O): the tangent line
        const t = names[0];
        const o = names.find((n) => fig.circles.has(n)) ?? [...fig.circles.keys()][0];
        if (!o) throw new GeoError("tangent: draw the circle first");
        const T = fig.p(t);
        const u = unit(rot(sub(T, fig.p(o)), 90));
        const r = fig.circleR(o);
        fig.items.push({ t: "line", from: add(T, mul(u, -1.6 * r)), to: add(T, mul(u, 1.6 * r)), hl: true });
        fig.items.push({ t: "right", a: o, b: t, cAt: add(T, mul(u, r)) });
        return;
      }
      // tangents T S from P to O
      const fromIdx = tokens.findIndex((x) => String(x).toLowerCase() === "from");
      const o = names.find((n) => fig.circles.has(n));
      const p = names.find((n, i) => fig.has(n) && !fig.circles.has(n) && i > 0) ?? names.find((n) => fig.has(n) && !fig.circles.has(n));
      const touch = names.filter((n) => n !== o && n !== p && !fig.has(n));
      if (!o) throw new GeoError("tangents: draw the circle first");
      if (!p) throw new GeoError("tangents: the outside point is not defined yet — add “point P outside O dist=…” first");
      if (!touch.length) throw new GeoError("tangents: name the touching point(s), e.g. “tangents T S from P to O”");
      void fromIdx;
      const O = fig.p(o);
      const P = fig.p(p);
      const r = fig.circleR(o);
      const d = dist(O, P);
      if (d <= r) throw new GeoError(`${p} is not outside circle ${o}`);
      const th = (Math.acos(r / d) * 180) / Math.PI;
      const base = (Math.atan2(P[1] - O[1], P[0] - O[0]) * 180) / Math.PI;
      const pts = [polar(O, r, base + th), polar(O, r, base - th)];
      touch.slice(0, 2).forEach((n, i) => {
        fig.set(n, pts[i]);
        fig.seg(p, n, { hl: true });
      });
      return;
    }
    case "secant": {
      // secant A B from P to O (at=angle off the line PO)
      const o = names.find((n) => fig.circles.has(n));
      const p = names.find((n) => fig.has(n) && !fig.circles.has(n));
      const [a, b] = names.filter((n) => n !== o && n !== p && !fig.has(n));
      if (!o || !p || !b) throw new GeoError("secant: write it as “secant A B from P to O”");
      const u = unit(rot(sub(fig.p(o), fig.p(p)), at ?? 18));
      const hits = lineCircle(fig.p(p), u, fig.p(o), fig.circleR(o));
      if (hits.length < 2) throw new GeoError("secant: that line misses the circle");
      fig.set(a, hits[0]);
      fig.set(b, hits[1]);
      fig.seg(p, b);
      return;
    }
    case "extend":
    case "produce": {
      // extend A B to D (by=0.6)
      const [a, b, d] = need(names, 3, cmd);
      const k = numKV(kv, "by", "k") ?? nums[0] ?? 0.5;
      fig.set(d, add(fig.p(b), mul(sub(fig.p(b), fig.p(a)), k)));
      fig.seg(b, d, { dash: true });
      return;
    }
    case "parallel": {
      // parallel E through D to B C meets A C
      const [e, d, b, c, x, y] = need(names, 6, "parallel");
      const D = fig.p(d);
      fig.set(e, lineX(D, add(D, sub(fig.p(c), fig.p(b))), fig.p(x), fig.p(y)));
      fig.seg(d, e, { hl: true });
      return;
    }
    case "square":
    case "rectangle":
    case "parallelogram":
    case "rhombus":
    case "trapezium":
    case "trapezoid": {
      const ns = need(names, 4, cmd);
      const w = numKV(kv, "w", "l", "length", "base", "side", "a", "bottom") ?? nums[0] ?? 8;
      let h = numKV(kv, "h", "b", "breadth", "height", "width") ?? nums[1] ?? (cmd === "square" || cmd === "rhombus" ? w : w * 0.6);
      if (cmd === "square") h = w;
      const ang = numKV(kv, "angle") ?? 65;
      let pts;
      if (cmd === "parallelogram" || cmd === "rhombus") {
        const s = cmd === "rhombus" ? w : h / Math.sin((ang * Math.PI) / 180);
        const v = polar([0, 0], s, ang);
        pts = [[0, 0], [w, 0], add([w, 0], v), v];
      } else if (cmd === "trapezium" || cmd === "trapezoid") {
        const top = numKV(kv, "top") ?? nums[1] ?? w * 0.6;
        const ht = numKV(kv, "height", "h") ?? nums[2] ?? w * 0.45;
        const off = (w - top) / 2;
        pts = [[0, 0], [w, 0], [w - off, ht], [off, ht]];
      } else pts = [[0, 0], [w, 0], [w, h], [0, h]];
      ns.forEach((n, i) => fig.set(n, pts[i]));
      fig.base = Math.max(w, h);
      fig.items.push({ t: "poly", ns });
      if (cmd === "square" || cmd === "rectangle") ns.forEach((n, i) => fig.items.push({ t: "right", a: ns[(i + 3) % 4], b: n, c: ns[(i + 1) % 4] }));
      return;
    }
    case "regular":
    case "polygon":
    case "pentagon":
    case "hexagon": {
      if (cmd === "polygon" && names.every((n) => fig.has(n))) {
        fig.items.push({ t: "poly", ns: names, hl: words.includes("highlight") });
        return;
      }
      const ns = names.length >= 3 ? names : need(names, 3, cmd);
      ns.forEach((n, i) => fig.set(n, polar([0, 0], 5, 270 - 180 / ns.length - (360 / ns.length) * i)));
      fig.base = 10;
      fig.items.push({ t: "poly", ns });
      return;
    }
    case "segment":
    case "dashed":
    case "highlight": {
      const isCircle = names.length === 1 && fig.circles.has(names[0]);
      if (cmd === "highlight" && isCircle) {
        const it = fig.items.find((i) => i.t === "circle" && i.c === names[0]);
        if (it) it.hl = true;
        return;
      }
      if (names.length < 2) throw new GeoError(`${cmd} needs two point names`);
      for (let i = 0; i + 1 < names.length; i += 2) {
        if (cmd === "highlight") {
          const it = fig.items.find((x) => x.t === "seg" && ((x.a === names[i] && x.b === names[i + 1]) || (x.a === names[i + 1] && x.b === names[i])));
          if (it) it.hl = true;
          else fig.seg(names[i], names[i + 1], { hl: true });
        } else fig.seg(names[i], names[i + 1], { dash: cmd === "dashed" || words.includes("dashed"), hl: words.includes("highlight") });
      }
      return;
    }
    case "line":
    case "ray": {
      const [a, b] = need(names, 2, cmd);
      const A = fig.p(a);
      const B = fig.p(b);
      const u = unit(sub(B, A));
      const e = dist(A, B) * 0.5 + fig.base * 0.1;
      fig.items.push({ t: "line", from: cmd === "ray" ? A : add(A, mul(u, -e)), to: add(B, mul(u, e)), dash: words.includes("dashed") });
      return;
    }
    case "right": {
      if (names.length >= 3) fig.items.push({ t: "right", a: names[0], b: names[1], c: names[2] });
      else if (names.length === 1) fig.items.push({ t: "right", b: names[0], auto: true });
      else throw new GeoError("right: name the angle, e.g. “right A B C” (the right angle is at B)");
      return;
    }
    case "angle":
    case "arc": {
      if (names.length >= 3) fig.items.push({ t: "arc", a: names[0], b: names[1], c: names[2], label: text ?? "", hl: !words.includes("plain") });
      else if (names.length === 1) fig.items.push({ t: "arc", b: names[0], auto: true, label: text ?? "", hl: true });
      else throw new GeoError("angle: name the angle, e.g. angle A B C \"x\"");
      return;
    }
    case "equal":
    case "ticks": {
      if (names.length < 2) throw new GeoError("equal needs segments, e.g. equal A B, A C");
      fig.tickCount += 1;
      for (let i = 0; i + 1 < names.length; i += 2) fig.items.push({ t: "ticks", a: names[i], b: names[i + 1], n: fig.tickCount });
      return;
    }
    case "label":
    case "length": {
      if (text === null && nums.length) {
        fig.items.push({ t: "slabel", a: names[0], b: names[1], text: String(nums[0]) });
        return;
      }
      if (names.length >= 2) fig.items.push({ t: "slabel", a: names[0], b: names[1], text: text ?? "" });
      else if (names.length === 1) fig.items.push({ t: "plabel", n: names[0], text: text ?? names[0] });
      else throw new GeoError("label: name a segment or point, e.g. label A B \"6 cm\"");
      return;
    }
    case "hide":
      names.forEach((n) => fig.hidden.add(n));
      return;
    case "dot":
      names.forEach((n) => fig.items.push({ t: "dot", n }));
      return;
    case "note":
    case "text":
      if (text) fig.items.push({ t: "note", text });
      return;
    default:
      throw new GeoError(`unknown command “${tokens[0]}”`);
  }
}

// ---------- drawing ----------
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function distToSeg(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return dist(p, add(a, mul(ab, t)));
}

function render(fig) {
  // Bounding box of everything drawn.
  const pts = [...fig.pts.values()];
  const ext = [...pts];
  for (const [c, r] of fig.circles) {
    if (!fig.items.some((i) => i.t === "circle" && i.c === c)) continue;
    const C = fig.p(c);
    ext.push(add(C, [r, r]), add(C, [-r, -r]));
  }
  for (const i of fig.items) if (i.t === "line") ext.push(i.from, i.to);
  if (!ext.length) throw new GeoError("nothing to draw");
  const xs = ext.map((p) => p[0]);
  const ys = ext.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Room for long length labels at the sides and for notes under the figure.
  const longest = Math.max(0, ...fig.items.filter((i) => i.t === "slabel").map((i) => String(i.text).length));
  const padX = Math.max(PAD, 10 + longest * 3.6);
  const noteRoom = fig.items.filter((i) => i.t === "note").length * 14;
  const k = Math.min((W - 2 * padX) / Math.max(maxX - minX, 1e-6), (H - 2 * PAD - noteRoom) / Math.max(maxY - minY, 1e-6));
  const ox = (W - (maxX - minX) * k) / 2;
  const oy = (H - noteRoom - (maxY - minY) * k) / 2;
  const S = (p) => [ox + (p[0] - minX) * k, oy + (maxY - p[1]) * k];
  const P = (n) => S(fig.p(n));

  const out = [];
  const segs = []; // screen segments, for label placement
  const rings = []; // screen circles
  const labels = []; // placed label boxes [x, y]
  const stroke = (hl, dash, w = 2) => `fill="none" stroke="currentColor" stroke-width="${dash ? 1.5 : w}"${dash ? ' stroke-dasharray="4 3"' : ""}${hl ? ' class="hl"' : ""}`;

  for (const i of fig.items) {
    if (i.t === "circle") {
      const C = P(i.c);
      const r = fig.circleR(i.c) * k;
      rings.push([C, r]);
      out.push(`<circle cx="${f1(C[0])}" cy="${f1(C[1])}" r="${f1(r)}" ${stroke(i.hl, i.dash)}/>`);
    } else if (i.t === "poly") {
      const s = i.ns.map(P);
      s.forEach((a, j) => segs.push([a, s[(j + 1) % s.length]]));
      out.push(`<polygon points="${s.map((p) => `${f1(p[0])},${f1(p[1])}`).join(" ")}" ${stroke(i.hl)}/>`);
    } else if (i.t === "seg") {
      const [a, b] = [P(i.a), P(i.b)];
      segs.push([a, b]);
      out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" ${stroke(i.hl, i.dash)}/>`);
    } else if (i.t === "line") {
      const [a, b] = [S(i.from), S(i.to)];
      segs.push([a, b]);
      out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" ${stroke(i.hl, i.dash, 1.8)}/>`);
    }
  }
  // Neighbours of a point along drawn segments (for "right B" / "angle B" without the other two names).
  const neighbours = (n) => {
    const out2 = [];
    for (const i of fig.items) {
      if (i.t === "seg") {
        if (i.a === n) out2.push(i.b);
        if (i.b === n) out2.push(i.a);
      } else if (i.t === "poly") {
        const j = i.ns.indexOf(n);
        if (j >= 0) out2.push(i.ns[(j + i.ns.length - 1) % i.ns.length], i.ns[(j + 1) % i.ns.length]);
      }
    }
    return [...new Set(out2)];
  };
  const marksAt = new Map();
  const arcLabels = [];
  for (const i of fig.items) {
    if (i.t === "right") {
      let [a, b, c] = [i.a, i.b, i.c];
      if (i.auto) [a, c] = neighbours(b);
      if (!a || (!c && !i.cAt)) throw new GeoError(`right: can't tell which angle at ${i.b}`);
      const B = P(b);
      const u = unit(sub(P(a), B));
      const v = unit(sub(i.cAt ? S(i.cAt) : P(c), B));
      const s = 8;
      const p1 = add(B, mul(u, s));
      const p2 = add(p1, mul(v, s));
      const p3 = add(B, mul(v, s));
      out.push(`<path d="M${f1(p1[0])},${f1(p1[1])} L${f1(p2[0])},${f1(p2[1])} L${f1(p3[0])},${f1(p3[1])}" fill="none" stroke="currentColor" stroke-width="1.5"/>`);
    } else if (i.t === "arc") {
      let [a, b, c] = [i.a, i.b, i.c];
      if (i.auto) [a, c] = neighbours(b);
      if (!a || !c) throw new GeoError(`angle: can't tell which angle at ${i.b}`);
      const B = P(b);
      const n = (marksAt.get(b) || 0) + 1;
      marksAt.set(b, n);
      let a1 = Math.atan2(P(a)[1] - B[1], P(a)[0] - B[0]);
      let a2 = Math.atan2(P(c)[1] - B[1], P(c)[0] - B[0]);
      let d = (((a2 - a1) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (d > Math.PI) [a1, a2, d] = [a2, a1, 2 * Math.PI - d];
      const r = 12 + (n - 1) * 5;
      const q1 = [B[0] + r * Math.cos(a1), B[1] + r * Math.sin(a1)];
      const q2 = [B[0] + r * Math.cos(a2), B[1] + r * Math.sin(a2)];
      out.push(`<path d="M${f1(q1[0])},${f1(q1[1])} A${r},${r} 0 0 1 ${f1(q2[0])},${f1(q2[1])}" fill="none" stroke="currentColor" stroke-width="1.5"${i.hl ? ' class="hl"' : ""}/>`);
      if (i.label) arcLabels.push({ B, a1, d, r, text: String(i.label), hl: i.hl });
    } else if (i.t === "ticks") {
      const [a, b] = [P(i.a), P(i.b)];
      const m = mid(a, b);
      const u = unit(sub(b, a));
      const nrm = [-u[1], u[0]];
      for (let j = 0; j < i.n; j++) {
        const c = add(m, mul(u, (j - (i.n - 1) / 2) * 4));
        const p1 = add(c, mul(nrm, 5));
        const p2 = add(c, mul(nrm, -5));
        out.push(`<line x1="${f1(p1[0])}" y1="${f1(p1[1])}" x2="${f1(p2[0])}" y2="${f1(p2[1])}" stroke="currentColor" stroke-width="1.5"/>`);
      }
    } else if (i.t === "dot") {
      const p = P(i.n);
      out.push(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.5" fill="currentColor"/>`);
    }
  }

  // Labels: try directions around the spot and keep the one farthest from lines, circles and other labels.
  const clearance = (q, half = 5) => {
    let m = Infinity;
    for (const [a, b] of segs) m = Math.min(m, distToSeg(q, a, b));
    for (const [c, r] of rings) m = Math.min(m, Math.abs(dist(q, c) - r));
    for (const l of labels) m = Math.min(m, dist(q, l) * 0.8);
    for (const p of fig.pts.values()) m = Math.min(m, dist(q, S(p)) + 2);
    // stay inside the box (half = half the text's width)
    if (q[0] - half < 2 || q[0] + half > W - 2 || q[1] < 10 || q[1] > H - 4 - noteRoom) m -= 30;
    return m;
  };
  // Angle labels: inside the angle, nudged off any line that runs through it.
  for (const a of arcLabels) {
    const half = a.text.length * 3.2;
    let best = null;
    for (const dr of [11, 15, 20, 26]) {
      for (const dm of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        const m = a.a1 + a.d * dm;
        const lr = a.r + dr + Math.min(10, a.text.length * 1.5);
        const q = [a.B[0] + lr * Math.cos(m), a.B[1] + lr * Math.sin(m)];
        const sc = clearance(q, half) - dr * 0.15;
        if (!best || sc > best.sc) best = { q, sc };
      }
    }
    labels.push(best.q);
    out.push(`<text x="${f1(best.q[0])}" y="${f1(best.q[1] + 4)}" font-size="11" text-anchor="middle"${a.hl ? ' class="hl"' : ""}>${esc(a.text)}</text>`);
  }
  const place = (spot, r) => {
    let best = null;
    for (let j = 0; j < 16; j++) {
      const t = (j * Math.PI) / 8;
      const q = [spot[0] + r * Math.cos(t), spot[1] + r * Math.sin(t)];
      const s = clearance(q);
      if (!best || s > best.s) best = { q, s };
    }
    labels.push(best.q);
    return best.q;
  };
  const named = new Map(fig.items.filter((i) => i.t === "plabel").map((i) => [i.n, i.text]));
  for (const [n] of fig.pts) {
    if (fig.hidden.has(n)) continue;
    const q = place(P(n), 12);
    out.push(`<text x="${f1(q[0])}" y="${f1(q[1] + 4.5)}" font-size="13" text-anchor="middle">${esc(named.get(n) ?? n)}</text>`);
  }
  for (const i of fig.items) {
    if (i.t !== "slabel" || !i.text) continue;
    const [a, b] = [P(i.a), P(i.b)];
    const m = mid(a, b);
    const u = unit(sub(b, a));
    const nrm = [-u[1], u[0]];
    const half = String(i.text).length * 3.3;
    const off = 10 + Math.abs(u[1]) * half * 0.9; // farther out beside steep segments, where the text is wide
    const cands = [add(m, mul(nrm, off)), add(m, mul(nrm, -off)), add(m, mul(nrm, off + 6)), add(m, mul(nrm, -off - 6))];
    const q = cands.reduce((best, c) => (clearance(c, half) > clearance(best, half) ? c : best));
    labels.push(q);
    out.push(`<text x="${f1(q[0])}" y="${f1(q[1] + 4)}" font-size="12" text-anchor="middle" class="hl">${esc(i.text)}</text>`);
  }
  const notes = fig.items.filter((i) => i.t === "note");
  notes.forEach((i, j) => out.push(`<text x="${W / 2}" y="${H - 5 - (notes.length - 1 - j) * 14}" font-size="11" text-anchor="middle" class="hl">${esc(i.text)}</text>`));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${out.join("")}</svg>`;
}

/**
 * Turn DRAW lines into an exact figure. Returns {svg, errors}: svg is "" when anything could not be understood
 * (a wrong figure is never drawn). Lines may be separated by new lines or ";".
 */
export function drawFigure(spec) {
  const lines = String(spec || "")
    .split(/\n|;/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((l) => l && !/^#/.test(l));
  if (!lines.length) return { svg: "", errors: [] };
  const fig = new Figure();
  const errors = [];
  for (const l of lines.slice(0, 60)) {
    try {
      run(fig, l);
    } catch (e) {
      errors.push(`“${l}”: ${e instanceof GeoError ? e.message : "could not be drawn"}`);
    }
  }
  if (errors.length) return { svg: "", errors };
  try {
    return { svg: render(fig), errors: [] };
  } catch (e) {
    return { svg: "", errors: [e instanceof GeoError ? e.message : "could not be drawn"] };
  }
}

/** The constructed points and circles (for tests). Throws on the first error. */
export function construct(spec) {
  const fig = new Figure();
  for (const l of String(spec).split(/\n|;/).map((x) => x.trim()).filter(Boolean)) run(fig, l);
  return { pts: Object.fromEntries(fig.pts), circles: Object.fromEntries(fig.circles) };
}

const cache = new Map();
/** drawFigure, remembered (figures are drawn again on every screen). */
export function figureSvg(spec) {
  const key = String(spec || "");
  if (!key) return "";
  if (!cache.has(key)) {
    if (cache.size > 300) cache.clear();
    cache.set(key, drawFigure(key).svg);
  }
  return cache.get(key);
}

/** The DRAW language, for prompts. */
export const DRAW_GUIDE = `Describe the figure with DRAW lines — the app computes every point exactly, so never give coordinates. One command per line:
  triangle A B C                      (any triangle; add sides AB=6 BC=10 CA=9, or angles A=50 B=60, or "right at B", "isosceles", "equilateral")
  circle O r=5                        (or: circle O through A — centre O must exist)
  point P outside O dist=13           (a point outside circle O; optional at=30 for its direction in degrees)
  points A B C on O                   (points on circle O; optional angles: points A B C on O 100 210 330)
  diameter A B of O
  tangents T S from P to O            (tangent points T and S; draws PT and PS)
  tangent at T of O                   (the tangent line at T)
  secant A B from P to O              (a line from P cutting the circle at A, then B)
  midpoint M of A B · foot D from A to B C (perpendicular) · median D from A to B C · bisector D from A to B C
  centroid G of A B C · incentre I of A B C · circumcentre O of A B C · orthocentre H of A B C
  incircle I of A B C · circumcircle O of A B C
  divide D on A B ratio 2:3 · intersect P of A B and C D · extend B C to D · parallel E through D to B C meets A C
  square A B C D side=4 · rectangle A B C D l=6 b=4 · parallelogram A B C D base=6 height=4 · trapezium A B C D bottom=8 top=5 height=4
  segment A B, C D · dashed A B · line A B (extended) · polygon A B C D
  right A B C   (right-angle mark at B)   ·   angle A B C "x"   (arc at B with a label)   ·   equal A B, A C   (tick marks)
  label A B "6 cm"   (length on a segment)   ·   highlight A B   ·   hide P   ·   note "AB is a diameter"`;
