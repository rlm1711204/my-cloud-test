// The built-in GK Question Bank: parser for the plain-text format in src/data/gk*.js, a checker that finds
// mistakes in that text (run by the tests on every build), and a lazy loader.
import { CA_TOPICS, SEP, TAXONOMY } from "./gk-taxonomy.js";
import { makeItem } from "./gk.js";

export const BANK_PREFIX = "qb:";
export const isBankId = (id) => String(id).startsWith(BANK_PREFIX);

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

/** Parse Question Bank text. Returns {items, problems}. */
export function parseBank(text) {
  const items = [];
  const problems = [];
  const seen = new Set();
  let category = "";
  let sub = "";
  let cur = null;
  const finish = () => {
    if (!cur) return;
    if (!cur.a) problems.push(`"${cur.q.slice(0, 50)}": no A: line`);
    if (cur.options.length < 3) problems.push(`"${cur.q.slice(0, 50)}": needs 3 wrong options`);
    if (cur.options.includes(cur.a)) problems.push(`"${cur.q.slice(0, 50)}": the answer is also a wrong option`);
    items.push(cur);
    cur = null;
  };
  String(text)
    .split("\n")
    .forEach((raw, n) => {
      const line = raw.trim();
      if (!line || line.startsWith("//")) return;
      const at = `line ${n + 1}`;
      if (line.startsWith("## ")) {
        finish();
        [category, sub] = line.slice(3).split(/\s*(?:›|>)\s*/);
        if (!TAXONOMY[category] || !(sub in TAXONOMY[category].subs)) problems.push(`${at}: unknown chapter "${line.slice(3)}"`);
        return;
      }
      const m = /^([A-Z]):\s*(.*)$/.exec(line);
      if (!m) return problems.push(`${at}: not understood: ${line.slice(0, 60)}`);
      const [, tag, body] = m;
      if (tag === "Q") {
        finish();
        const id = BANK_PREFIX + slug(body);
        if (seen.has(id)) problems.push(`${at}: duplicate question "${body.slice(0, 50)}"`);
        seen.add(id);
        cur = { id, q: body, a: "", options: [], trick: "", explain: "", category, sub, difficulty: 3 };
        return;
      }
      if (!cur) return problems.push(`${at}: "${tag}:" before any Q: line`);
      if (tag === "A") cur.a = body;
      else if (tag === "O") cur.options = body.split(/\s*;\s*/).filter(Boolean);
      else if (tag === "T") cur.trick = body;
      else if (tag === "E") cur.explain = body;
      else if (tag === "D") cur.difficulty = Number(body) || 3;
      else problems.push(`${at}: unknown letter "${tag}:"`);
    });
  finish();
  return { items, problems };
}

let bank = null;
let loading = null;

/** Load the Question Bank (four lazily loaded parts). Resolves the parsed items. */
export function loadBank() {
  if (bank) return Promise.resolve(bank);
  loading ??= Promise.all([import("../data/gk1.js"), import("../data/gk2.js"), import("../data/gk3.js"), import("../data/gk4.js")]).then(
    (parts) => {
      bank = parseBank(parts.map((p) => p.default).join("\n")).items;
      return bank;
    },
  );
  return loading;
}

export const bankLoaded = () => bank;

/** A bank question shaped like the learner's own, with their progress on it. */
export function bankRecord(entry, progress = {}, rank = 0) {
  return {
    ...makeItem({
      ...entry,
      ...progress,
      id: entry.id,
      source: "Question Bank",
      addedAt: `9${String(rank).padStart(4, "0")}`,
      updatedAt: progress.updatedAt || "0",
    }),
    bank: true,
  };
}

export { SEP, CA_TOPICS };
