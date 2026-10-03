import { describe, expect, it } from "vitest";
import { construct, drawFigure } from "../src/lib/geodraw.js";
import { sanitizeSvg } from "../src/lib/svgsafe.js";

const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dot = (a, b, c, e) => (b[0] - a[0]) * (e[0] - c[0]) + (b[1] - a[1]) * (e[1] - c[1]); // AB · CE
const near = (x, y, eps = 1e-6) => expect(Math.abs(x - y)).toBeLessThan(eps);
const lineDist = (p, a, b) => Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / d(a, b);

describe("geometry engine: points are exact", () => {
  it("tangents from an outside point touch the circle at right angles", () => {
    const { pts, circles } = construct("circle O r=5\npoint P outside O dist=13\ntangents T S from P to O");
    const { O, P, T, S } = pts;
    near(d(O, T), circles.O);
    near(d(O, S), circles.O);
    near(dot(O, T, T, P), 0); // OT ⟂ TP
    near(d(P, T), 12);
    near(d(P, S), 12);
  });

  it("triangles from sides, angles or a right angle", () => {
    const t = construct("triangle A B C AB=6 BC=10 CA=9").pts;
    near(d(t.A, t.B), 6);
    near(d(t.B, t.C), 10);
    near(d(t.C, t.A), 9);
    const r = construct("triangle A B C right at B AB=6 BC=8").pts;
    near(dot(r.B, r.A, r.B, r.C), 0);
    near(d(r.A, r.C), 10);
    const g = construct("triangle P Q R angles P=50 Q=60").pts;
    const ang = (v, a, b) => (Math.acos(dot(v, a, v, b) / (d(v, a) * d(v, b))) * 180) / Math.PI;
    near(ang(g.P, g.Q, g.R), 50, 1e-6);
    near(ang(g.Q, g.P, g.R), 60, 1e-6);
  });

  it("centres of a triangle", () => {
    const base = "triangle A B C AB=7 BC=8 CA=9\n";
    const ic = construct(base + "incircle I of A B C");
    const { A, B, C, I } = ic.pts;
    for (const [p, q] of [[A, B], [B, C], [C, A]]) near(lineDist(I, p, q), ic.circles.I); // touches all three sides
    const cc = construct(base + "circumcentre O of A B C").pts;
    near(d(cc.O, cc.A), d(cc.O, cc.B));
    near(d(cc.O, cc.B), d(cc.O, cc.C));
    const h = construct(base + "orthocentre H of A B C").pts;
    near(dot(h.A, h.H, h.B, h.C), 0); // AH ⟂ BC
    near(dot(h.B, h.H, h.A, h.C), 0);
    const g = construct(base + "centroid G of A B C\nmedian D from A to B C").pts;
    near(d(g.A, g.G) / d(g.G, g.D), 2); // 2 : 1
  });

  it("feet, bisectors, ratios and parallels", () => {
    const f = construct("triangle A B C AB=6 BC=10 CA=9\nfoot D from A to B C").pts;
    near(dot(f.A, f.D, f.B, f.C), 0);
    const b = construct("triangle A B C AB=6 BC=10 CA=9\nbisector D from A to B C").pts;
    near(d(b.B, b.D) / d(b.D, b.C), 6 / 9); // BD/DC = AB/AC
    const p = construct("triangle A B C AB=8 AC=10 BC=12\ndivide D on A B ratio 2:3\nparallel E through D to B C meets A C").pts;
    near(d(p.A, p.D) / d(p.D, p.B), d(p.A, p.E) / d(p.E, p.C)); // BPT
    const s = construct("circle O r=5\ndiameter A B of O\npoint C on O at 120").pts;
    near(dot(s.C, s.A, s.C, s.B), 0); // angle in a semicircle
  });

  it("a secant from an outside point: PT² = PA × PB", () => {
    const { pts } = construct("circle O r=4\npoint P outside O dist=11\ntangents T from P to O\nsecant A B from P to O at=15");
    near(d(pts.P, pts.T) ** 2, d(pts.P, pts.A) * d(pts.P, pts.B), 1e-6);
  });
});

describe("geometry engine: drawing", () => {
  it("draws a safe figure with point labels, marks and lengths", () => {
    const { svg, errors } = drawFigure('DRAW: circle O r=5\nDRAW: point P outside O dist=13\nDRAW: tangents T from P to O\nDRAW: segment O T; dashed O P\nDRAW: right O T P\nDRAW: label O T "5"\nangle O P T "θ"');
    expect(errors).toEqual([]);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 240 170">/);
    for (const t of [">O<", ">P<", ">T<", ">5<", ">θ<"]) expect(svg).toContain(t);
    expect(sanitizeSvg(svg)).toBe(svg); // nothing to strip
  });
  it("accepts names written together and common symbols", () => {
    expect(drawFigure("triangle ABC right at B\nsegment BD\n").errors.length).toBe(1); // D was never defined
    expect(drawFigure("triangle ABC right-angled at B, AB=6, BC=8\nangle ∠BAC \"θ\"").errors).toEqual([]);
  });
  it("refuses to draw anything it doesn't understand", () => {
    const r = drawFigure("circle O r=5\nwibble the circle");
    expect(r.svg).toBe("");
    expect(r.errors[0]).toMatch(/unknown command/);
    expect(drawFigure("circle O r=5\ntangents T from P to O").errors[0]).toMatch(/outside point is not defined/);
    expect(drawFigure("triangle A B C AB=1 BC=2 CA=10").errors[0]).toMatch(/don't make a triangle/);
  });
});
