// The GK topic tree as a structure of keys ("Polity", "Polity › Constitution", "Current Affairs › 2026",
// "Current Affairs › 2026 › Sports") and the logic for ticking / unticking any node for practice.
// Pure functions; unit-tested.
import { CA, SEP, SUBJECTS, topicKey } from "./gk-taxonomy.js";

/** Parent → children map for the topics that actually have questions. */
export function buildTree(items) {
  const children = new Map([["", new Set()]]);
  for (const it of items) {
    const parts = topicKey(it).split(SEP);
    let parent = "";
    for (let i = 1; i <= parts.length; i++) {
      const key = parts.slice(0, i).join(SEP);
      if (!children.has(parent)) children.set(parent, new Set());
      children.get(parent).add(key);
      if (!children.has(key)) children.set(key, new Set());
      parent = key;
    }
  }
  const order = (a, b) => {
    const [ta, tb] = [a.split(SEP), b.split(SEP)];
    if (ta.length === 1) return rank(ta[0]) - rank(tb[0]);
    if (ta[0] === CA && ta.length === 2) return Number(tb[1]) - Number(ta[1]) || a.localeCompare(b); // newest year first
    return a.localeCompare(b);
  };
  const out = new Map();
  for (const [k, set] of children) out.set(k, [...set].sort(order));
  return out;
}
const rank = (subject) => (subject === CA ? -1 : SUBJECTS.includes(subject) ? SUBJECTS.indexOf(subject) : 99);

export const labelOf = (key) => key.split(SEP).at(-1);
const ancestors = (key) => key.split(SEP).slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join(SEP));
const isUnder = (key, x) => key === x || key.startsWith(x + SEP);

/** "off" (left out), "some" (some topics inside are left out) or "on". */
export function nodeState(key, excluded) {
  if (excluded.some((x) => isUnder(key, x))) return "off";
  if (excluded.some((x) => isUnder(x, key))) return "some";
  return "on";
}

/** Tick or untick a node. Unticking a subject leaves out all of it; ticking one chapter inside a left-out
 * subject keeps the rest of that subject left out. Returns the new excluded list. */
export function toggle(key, excluded, tree) {
  let ex = [...excluded];
  const state = nodeState(key, ex);
  // Partly ticked → tick everything inside it.
  if (state === "some") return tidy(ex.filter((x) => !isUnder(x, key)), tree);
  if (state === "on") {
    // Leave it out: the node replaces anything inside it.
    ex = ex.filter((x) => !isUnder(x, key));
    ex.push(key);
    return tidy(ex, tree);
  }
  // Include it: open up any left-out ancestor into its other children, down to this node.
  for (const anc of [...ancestors(key), key]) {
    if (!ex.includes(anc)) continue;
    ex = ex.filter((x) => x !== anc);
    if (anc !== key) {
      const path = key;
      for (const child of tree.get(anc) || []) if (!isUnder(path, child)) ex.push(child);
    }
  }
  ex = ex.filter((x) => !isUnder(x, key));
  return tidy(ex, tree);
}

/** If every child of a node is left out, leave out the node itself instead (keeps the list short). */
function tidy(ex, tree) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [parent, kids] of tree) {
      if (!parent || !kids.length || ex.includes(parent)) continue;
      if (kids.every((k) => ex.includes(k))) {
        ex = ex.filter((x) => !isUnder(x, parent));
        ex.push(parent);
        changed = true;
      }
    }
  }
  return ex.sort();
}
