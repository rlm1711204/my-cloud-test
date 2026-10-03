// Maths written by AIs often comes as LaTeX ("\frac{a}{b}", "x^2", "$...$"). The app shows plain text, so turn it
// into readable maths: (a)/(b), x², √(x), ×, ÷, π. Pure; unit-tested.

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", n: "ⁿ", "-": "⁻", "+": "⁺" };
const SYMBOLS = [
  [/\\times/g, "×"],
  [/\\cdot/g, "·"],
  [/\\div/g, "÷"],
  [/\\pm/g, "±"],
  [/\\pi/g, "π"],
  [/\\theta/g, "θ"],
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\infty/g, "∞"],
  [/\\leq?/g, "≤"],
  [/\\geq?/g, "≥"],
  [/\\neq?/g, "≠"],
  [/\\approx/g, "≈"],
  [/\\Rightarrow|\\implies|\\to/g, "→"],
  [/\\therefore/g, "∴"],
  [/\\angle/g, "∠"],
  [/\\triangle/g, "△"],
  [/\\degree|\^\{?\\circ\}?/g, "°"],
  [/\\%/g, "%"],
  [/\\(?:left|right)/g, ""],
  [/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, "$1"],
  [/\\(sin|cos|tan|cot|sec|cosec|csc|log|ln)\b/g, "$1"],
  [/\\[,;!: ]/g, " "],
];

const sup = (s) => (/^[0-9n+-]+$/.test(s) ? [...s].map((c) => SUP[c]).join("") : `^(${s})`);

/** Plain, readable maths from LaTeX-ish text. Text without LaTeX is returned unchanged. */
export function plainMath(text) {
  let t = String(text ?? "");
  if (!/[\\^$]/.test(t)) return t;
  t = t.replace(/\$\$?([^$]*)\$\$?/g, "$1").replace(/\\\(|\\\)|\\\[|\\\]/g, "");
  for (let i = 0; i < 4 && /\\[dt]?frac\{/.test(t); i++) t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => `${wrap(a)}/${wrap(b)}`);
  t = t.replace(/\\sqrt\[(\d)\]\{([^{}]*)\}/g, (_, n, x) => `${n === "3" ? "∛" : `${n}√`}(${x})`).replace(/\\sqrt\{([^{}]*)\}/g, (_, x) => (/^\w+$/.test(x) ? `√${x}` : `√(${x})`));
  for (const [re, to] of SYMBOLS) t = t.replace(re, to);
  t = t.replace(/\^\{([^{}]*)\}/g, (_, e) => sup(e)).replace(/\^([0-9n])/g, (_, e) => SUP[e]);
  t = t.replace(/_\{?(\d+)\}?/g, (_, d) => [...d].map((c) => "₀₁₂₃₄₅₆₇₈₉"[c]).join(""));
  return t.replace(/[{}]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

const wrap = (x) => (/^[\w.²³]+$/.test(x.trim()) ? x.trim() : `(${x.trim()})`);
