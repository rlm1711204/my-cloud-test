// Figures for maths questions are small SVG drawings, often written by an AI. Before one is saved or shown it is
// rebuilt here from an allowlist of drawing elements and attributes — no scripts, event handlers, links, styles or
// foreign content can survive — and black/white colours become the theme colour so figures work in dark mode.
// Works without a DOM (string tokenizer), so it is unit-tested. Pure.

const ELEMENTS = new Set(["svg", "g", "line", "polyline", "polygon", "path", "circle", "ellipse", "rect", "text", "tspan", "title", "defs", "marker"]);
// Elements dropped together with everything inside them.
const DROP_WITH_CONTENT = new Set(["script", "style", "foreignobject", "iframe", "object", "embed", "image", "a", "use", "animate", "set", "animatetransform", "animatemotion", "metadata", "switch"]);
const ATTRS = new Set([
  "viewbox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "width", "height",
  "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "fill-opacity", "stroke-opacity", "opacity",
  "font-size", "font-style", "font-weight", "text-anchor", "dominant-baseline", "transform", "class", "id",
  "marker-start", "marker-mid", "marker-end", "refx", "refy", "markerwidth", "markerheight", "orient", "markerunits", "dx", "dy",
]);
// Case-sensitive SVG attribute names to write back.
const CASE = { viewbox: "viewBox", refx: "refX", refy: "refY", markerwidth: "markerWidth", markerheight: "markerHeight", markerunits: "markerUnits" };
const TAG_CASE = {};
const MAX_LEN = 16000;
const MAX_NODES = 500;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s) =>
  String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

const DARK = /^(#000(000)?|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|#111(111)?|#222(222)?|#333(333)?)$/i;
const LIGHT = /^(#fff(fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i;

function cleanValue(name, value, tag) {
  const v = unesc(value).trim();
  if (/javascript:|data:|expression\(|@import|<|>/i.test(v)) return null;
  if (/url\(/i.test(v) && !/^url\(#[\w-]+\)$/.test(v)) return null; // only references to markers in the same figure
  if (name === "fill" || name === "stroke") {
    if (DARK.test(v)) return "currentColor";
    if (LIGHT.test(v)) return tag === "text" || tag === "tspan" ? "currentColor" : "none";
  }
  if (name === "class") return v.replace(/[^\w -]/g, "").slice(0, 60);
  return v.slice(0, 2000);
}

/** A safe SVG string for a figure, or "" if there is nothing usable. */
export function sanitizeSvg(input) {
  let src = String(input ?? "").trim();
  if (!src) return "";
  const start = src.search(/<svg[\s>]/i);
  const end = src.toLowerCase().lastIndexOf("</svg>");
  if (start < 0 || end < start) return "";
  src = src.slice(start, end + 6).replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[^>]*>/gi, "");
  if (src.length > MAX_LEN * 2) return "";
  const out = [];
  const stack = [];
  let skip = 0; // inside a dropped element
  let nodes = 0;
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const [, closing, rawTag, rawAttrs, selfClose, text] = m;
    if (text !== undefined) {
      if (!skip && stack.length && ["text", "tspan", "title"].includes(stack.at(-1))) out.push(esc(unesc(text)));
      continue;
    }
    const tag = rawTag.toLowerCase().replace(/^svg:/, "");
    if (closing) {
      if (skip) {
        if (DROP_WITH_CONTENT.has(tag)) skip -= 1;
        continue;
      }
      if (ELEMENTS.has(tag) && stack.at(-1) === tag) {
        stack.pop();
        out.push(`</${TAG_CASE[tag] || tag}>`);
      }
      continue;
    }
    if (skip || DROP_WITH_CONTENT.has(tag)) {
      if (DROP_WITH_CONTENT.has(tag) && !selfClose) skip += 1;
      continue;
    }
    if (!ELEMENTS.has(tag)) continue; // unknown element: drop the tag, keep going
    if (!stack.length && tag !== "svg") continue;
    if (++nodes > MAX_NODES) break;
    const attrs = [];
    const ar = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let a;
    while ((a = ar.exec(rawAttrs || ""))) {
      const name = a[1].toLowerCase();
      if (!ATTRS.has(name)) continue; // on*, href, style, xmlns:* … are never kept
      const value = cleanValue(name, a[2] ?? a[3] ?? a[4] ?? "", tag);
      if (value === null) continue;
      attrs.push(`${CASE[name] || name}="${esc(value)}"`);
    }
    if (tag === "svg" && !stack.length) {
      // The root: keep the coordinate system, let CSS size it.
      const get = (n) => attrs.find((x) => x.startsWith(`${n}="`))?.slice(n.length + 2, -1);
      const w = parseFloat(get("width"));
      const h = parseFloat(get("height"));
      const kept = attrs.filter((x) => !/^(width|height)=/.test(x));
      if (!get("viewBox") && w > 0 && h > 0) kept.push(`viewBox="0 0 ${w} ${h}"`);
      out.push(`<svg xmlns="http://www.w3.org/2000/svg" ${kept.join(" ")}>`);
      stack.push("svg");
      continue;
    }
    out.push(`<${tag}${attrs.length ? " " + attrs.join(" ") : ""}${selfClose ? "/" : ""}>`);
    if (!selfClose) stack.push(tag);
  }
  if (!out.length || nodes < 2) return "";
  while (stack.length) out.push(`</${stack.pop()}>`);
  const svg = out.join("");
  return svg.length <= MAX_LEN && /viewBox="/.test(svg) ? svg : "";
}

/** A photo of a figure the learner attached: a small JPEG / PNG / WebP data URL, or "". */
export function cleanImage(src) {
  const s = String(src ?? "");
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 160000 ? s : "";
}
