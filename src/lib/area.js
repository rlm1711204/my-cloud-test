// "My Area": exam notes about the place you are in, at four levels — your town / taluk, district, state and region
// (zonal council) — sorted into subjects (history, geography & rivers, soils & agriculture, economy, polity…) and tagged
// by exam depth (SSC → UPSC → RBI). This file is pure (unit-tested): place names from a geocoder's address, the four
// levels, the AI instruction and the copy-paste prompt, reading a pasted answer, and turning notes into GK questions.
import { PLACES } from "./gk-taxonomy.js";
import { questionSimilarity } from "./gk.js";

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const str = (v, max = 600) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The four levels, smallest first. */
export const LEVELS = [
  { key: "local", icon: "📍", label: "Town / taluk", kind: "town or taluk" },
  { key: "district", icon: "🏘️", label: "District", kind: "district" },
  { key: "state", icon: "🗺️", label: "State", kind: "state" },
  { key: "region", icon: "🧭", label: "Region", kind: "region of India" },
];

/** Exam depth, in the order notes are shown inside each subject. */
export const EXAMS = {
  SSC: "SSC CGL / CHSL and state PSC prelims: direct one-line static facts — who, what, where, when, firsts, names, numbers",
  UPSC: "UPSC Prelims and Mains: deeper facts and links — significance, causes and effects, geographical reasons, issues, schemes, landmark sites or cases",
  RBI: "RBI Grade B / NABARD (ESI and ARD): economy, agriculture and rural development, banking, cooperatives, MSMEs, infrastructure — with numbers where known",
};
export const EXAM_TAGS = Object.keys(EXAMS);

/** Subjects of the notes: [name, icon, what to cover]. */
export const SECTIONS = [
  ["History", "🏛️", "dynasties and rulers, battles, inscriptions and archaeological sites, colonial period, freedom struggle events"],
  ["Art & Culture", "🎭", "temples and architecture, festivals, dance, music, literature, crafts and GI-tagged products, UNESCO sites"],
  ["Personalities", "👤", "freedom fighters, rulers, poets, reformers, scientists and others born or active here"],
  ["Geography & Rivers", "🏞️", "location and borders, relief (hills, plateaus, passes, coast), rivers and their origin and tributaries, dams, lakes, waterfalls, climate and rainfall, minerals, ports"],
  ["Agriculture & Soils", "🌾", "soil types, fertile tracts, major crops and seasons, irrigation (canals, tanks), horticulture, plantations, livestock, fisheries"],
  ["Economy & Industry", "🏭", "industries and clusters, major companies and PSUs, power plants, ports, transport corridors, tourism, GI products, economic rank"],
  ["Banking & Rural Development", "🏦", "regional rural bank, lead bank, cooperative banks, NABARD and SHG work, financial inclusion, rural schemes, MGNREGA, credit flow"],
  ["Polity & Governance", "⚖️", "formation and administration, Lok Sabha / Assembly seats, local bodies, special constitutional provisions, scheduled areas, landmark cases, inter-state issues"],
  ["Environment & Ecology", "🌿", "national parks, wildlife sanctuaries, tiger / elephant reserves, biosphere reserves, Ramsar sites, endemic species, environmental issues"],
  ["Science, Energy & Defence", "🚀", "ISRO / DRDO / BARC centres, nuclear, wind and solar plants, defence bases, research institutes"],
  ["Current Affairs", "📰", "events of the last two years: projects, schemes, awards, records, disasters, news (give the year)"],
];
export const SECTION_NAMES = SECTIONS.map((s) => s[0]);
const GROUPS = [
  ["History", "Art & Culture", "Personalities", "Polity & Governance", "Current Affairs"],
  ["Geography & Rivers", "Agriculture & Soils", "Economy & Industry", "Banking & Rural Development", "Environment & Ecology", "Science, Energy & Defence"],
];
export const sectionGroups = () => GROUPS.map((g) => [...g]);

/** A heading from a pasted answer → one of SECTION_NAMES, or "" if it isn't one. Order matters ("Rural economy" is banking). */
export function sectionOf(heading) {
  const h = String(heading || "").toLowerCase();
  const tests = [
    ["Current Affairs", /current|recent|news|latest/],
    ["Agriculture & Soils", /agri|soil|crop|farm|irrigat/],
    ["Art & Culture", /\bart\b|\bculture|heritage|temple|festival|craft/],
    ["Personalities", /personalit|famous|people|persons/],
    ["Banking & Rural Development", /bank|rural|financ|credit|co-?operative/],
    ["Environment & Ecology", /environ|ecolog|wildlife|forest|biodivers|sanctuar/],
    ["Science, Energy & Defence", /scien|energy|defen[cs]e|space|tech|power plant/],
    ["Economy & Industry", /econom|industr|trade|business|infrastruct|touris/],
    ["Polity & Governance", /polit|govern|administ|constitution/],
    ["Geography & Rivers", /geograph|river|physical|climate|relief|terrain/],
    ["History", /histor/],
  ];
  return tests.find(([, re]) => re.test(h))?.[0] || "";
}

// ---------- the place ----------
const ZONES = [
  ["North India", "Northern Zonal Council", ["Haryana", "Himachal Pradesh", "Punjab", "Rajasthan", "Delhi", "Chandigarh", "Jammu and Kashmir", "Ladakh"]],
  ["Central India", "Central Zonal Council", ["Chhattisgarh", "Madhya Pradesh", "Uttar Pradesh", "Uttarakhand"]],
  ["East India", "Eastern Zonal Council", ["Bihar", "Jharkhand", "Odisha", "West Bengal"]],
  ["West India", "Western Zonal Council", ["Goa", "Gujarat", "Maharashtra", "Dadra and Nagar Haveli and Daman and Diu"]],
  ["South India", "Southern Zonal Council", ["Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Telangana", "Puducherry"]],
  ["North-East India", "North Eastern Council", ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura"]],
  ["India's island territories", "", ["Andaman and Nicobar Islands", "Lakshadweep"]],
];
const normState = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(the|state of|union territory of|nct of)\b/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/^orissa$/, "odisha")
    .replace(/^pondicherry$/, "puducherry")
    .replace(/^nationalcapitalterritoryofdelhi$|^newdelhi$/, "delhi");

/** The region (zonal council) a state of India belongs to: {name, detail} or null. */
export function regionOf(state) {
  const k = normState(state);
  if (!k) return null;
  for (const [name, council, states] of ZONES) {
    if (states.some((s) => normState(s) === k)) return { name, detail: `${council ? `${council}: ` : ""}${states.join(", ")}` };
  }
  return null;
}

const tidy = (s) => str(s, 80).replace(/\s+(district|taluk|tehsil|mandal|division)$/i, "");

/** A place from an OpenStreetMap (Nominatim) address. */
export function placeFromNominatim(addr = {}) {
  const town = addr.city || addr.town || addr.municipality || addr.village || addr.hamlet || addr.suburb || "";
  const area = addr.suburb || addr.neighbourhood || addr.city_district || "";
  const taluk = addr.county || addr.subdistrict || "";
  return makePlace({ town, area, taluk, district: addr.state_district || "", state: addr.state || addr.region || "", country: addr.country || "" });
}

/** A place from BigDataCloud's free reverse geocoder (the fallback). */
export function placeFromBigDataCloud(j = {}) {
  const admin = j.localityInfo?.administrative || [];
  const find = (re) => admin.find((a) => re.test(`${a.name} ${a.description || ""}`))?.name || "";
  return makePlace({
    town: j.city || j.locality || "",
    area: j.locality && j.locality !== j.city ? j.locality : "",
    taluk: find(/taluk|tehsil|mandal|subdistrict/i),
    district: find(/district/i),
    state: j.principalSubdivision || "",
    country: j.countryName || "",
  });
}

/** A place typed by hand: "Palayamkottai, Tirunelveli, Tamil Nadu" (town, district, state — any may be left out). */
export function placeFromText(text) {
  const parts = String(text || "")
    .split(/[,\n]/)
    .map((p) => str(p, 80))
    .filter(Boolean);
  const last = parts.at(-1) || "";
  const country = /^india$/i.test(last) ? parts.pop() : "";
  const state = parts.length >= 2 && regionOf(parts.at(-1)) ? parts.pop() : "";
  const [town = "", district = ""] = parts;
  return makePlace({ town, district, state, country: country || (state ? "India" : "") });
}

/**
 * The place, with a name for each level. `local` is the town (with its taluk or neighbourhood); when the town and the
 * district have the same name (Chennai, Tirunelveli), the town level is about the neighbourhood / taluk and the city.
 */
export function makePlace({ town = "", area = "", taluk = "", district = "", state = "", country = "", region = "", regionDetail = "" } = {}) {
  const d = tidy(district) || tidy(taluk);
  const t = str(town, 80);
  const tk = tidy(taluk);
  const same = (x, y) => Boolean(x) && String(x).toLowerCase() === String(y || "").toLowerCase();
  const ar = str(area, 60);
  let local = t;
  if (same(t, d)) {
    // A district headquarters: the town level is the neighbourhood (or taluk) you are in, so it isn't the district again.
    local = ar && !same(ar, t) ? `${ar}, ${t}` : tk && !same(tk, t) ? `${tk} taluk` : `${t} city`;
  } else if (t && tk && !same(tk, t) && !same(tk, d)) local = `${t} (${tk} taluk)`;
  else if (t && ar && !same(ar, t)) local = `${ar}, ${t}`;
  if (!local && tk && !same(tk, d)) local = `${tk} taluk`;
  const r = region ? { name: str(region, 80), detail: str(regionDetail, 300) } : regionOf(state);
  const inIndia = /india/i.test(country) || Boolean(regionOf(state)) || !country;
  return {
    local: str(local, 100),
    district: d,
    state: str(state, 80),
    region: r?.name || (!inIndia ? str(country, 80) : ""),
    regionDetail: r?.detail || "",
    country: str(country, 60) || (inIndia ? "India" : ""),
  };
}

/** The levels that have a name: [{key, icon, label, kind, name}]. */
export function levelsOf(place) {
  return LEVELS.map((l) => ({ ...l, name: levelName(place, l.key) })).filter((l) => l.name);
}

export function levelName(place, key) {
  if (!place) return "";
  if (key === "local") return place.local;
  if (key === "district") return place.district ? `${place.district} district` : "";
  if (key === "state") return place.state;
  return place.region;
}

/** "Palayamkottai › Tirunelveli › Tamil Nadu › South India" */
export const placeTrail = (place) => [place.local, place.district, place.state, place.region].filter(Boolean).join(" › ");
export const placeTitle = (place) => place.local || place.district || place.state || place.region || "Your area";

// ---------- asking the AI ----------
/** Where the level sits, so the AI talks about the right place (there are many towns with the same name). */
function whereIs(place, key) {
  const up = [];
  if (key === "local" && place.district) up.push(`${place.district} district`);
  if ((key === "local" || key === "district") && place.state) up.push(place.state);
  if (key !== "region" && place.country) up.push(place.country);
  return up.length ? `${levelName(place, key)} (in ${up.join(", ")})` : levelName(place, key);
}

const SCOPE = {
  local: "Only facts about this town / taluk itself and its immediate surroundings. Many towns have few exam facts — then give fewer notes; never pad with guesses or with facts about the whole district or state.",
  district: "Facts about the district as a whole (its towns, rivers, sites, industries, people). Leave out facts that are really about the whole state.",
  state: "Facts about the state as a whole: its history, geography, rivers, soils, economy, polity and culture. Mention districts only for important facts.",
  region: "Facts about the region as a whole, and comparisons and links between its states: physiography, river systems and basins, monsoon and climate, soils and crops, inter-state river disputes, the zonal council, regional history, culture and economy.",
};
const WANT = { local: 24, district: 36, state: 50, region: 40 };

export function areaSystem() {
  return [
    "You are a GK coach for an Indian aspirant preparing for SSC, UPSC Civil Services and RBI Grade B / NABARD.",
    "You write exam notes about a place: short, factual, one fact per note. Be strictly factual: never invent names,",
    "dates, numbers or places; skip anything you are not sure of. Prefer facts that are asked in exams.",
    "Each note gets an exam tag:",
    ...Object.entries(EXAMS).map(([k, v]) => `- ${k}: ${v}`),
    "Each note also gets one exam-style question (q) with its short answer (a) and exactly 3 believable but clearly wrong options.",
  ].join("\n");
}

/** The instruction for one level and one group of subjects. */
export function areaInstruction(place, key, sections, now = new Date()) {
  const n = Math.round((WANT[key] || 30) * (sections.length / SECTION_NAMES.length));
  const region = key === "region" && place.regionDetail ? ` (${place.regionDetail})` : "";
  return (
    `Place: ${whereIs(place, key)}${region} — level: ${LEVELS.find((l) => l.key === key)?.kind || key}.\n` +
    `${SCOPE[key] || ""}\n` +
    `Write up to about ${n} notes about it, covering these subjects (use these exact names in \`section\`):\n` +
    sections.map((name) => `- ${name}: ${SECTIONS.find((s) => s[0] === name)?.[2] || ""}`).join("\n") +
    `\nInside each subject give SSC-level notes first, then UPSC, then RBI. Skip a subject if there is nothing exam-worthy. ` +
    `For Current Affairs, today is ${now.toISOString().slice(0, 10)}: only events of the last two years, with \`year\`; otherwise year = 0.`
  );
}

const s = (description) => ({ type: "string", description });
export const AREA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "exam", "note", "q", "a", "options", "year"],
        properties: {
          section: { type: "string", enum: SECTION_NAMES, description: "The subject." },
          exam: { type: "string", enum: EXAM_TAGS, description: "SSC, UPSC or RBI." },
          note: s("The fact, in 1–2 short lines."),
          q: s("An exam-style question on this fact."),
          a: s("Its short answer."),
          options: { type: "array", items: { type: "string" }, description: "Exactly 3 believable WRONG options." },
          year: { type: "integer", description: "For Current Affairs: year of the event. Otherwise 0." },
        },
      },
    },
  },
};

/** The prompt to copy into the Gemini or ChatGPT app for one level; its answer is pasted back (readAreaNotes). */
export function buildAreaPrompt(place, key, now = new Date()) {
  return `I am preparing for SSC, UPSC Civil Services and RBI Grade B. Make exam notes about ${whereIs(place, key)}${
    key === "region" && place.regionDetail ? ` (${place.regionDetail})` : ""
  }.
${SCOPE[key] || ""}
Be strictly factual — never invent names, dates or numbers; skip what you are not sure of.

Use these headings, in this order (skip one only if there is nothing exam-worthy):
${SECTIONS.map(([name, icon, what]) => `## ${name} — ${what}`).join("\n")}

Under each heading, one fact per line. Start each line with its exam tag — SSC facts first, then UPSC, then RBI:
- [SSC] = a direct one-line fact (who / what / where / when / first)
- [UPSC] = a deeper fact or link (significance, cause, geography reason, issue)
- [RBI] = economy, agriculture, rural development or banking angle, with numbers
Under each fact add one exam question with its answer and 3 wrong options. For Current Affairs (today is ${now
    .toISOString()
    .slice(0, 10)}, last two years only) put the year after the tag.

Format exactly like this:
## History
- [SSC] <fact>
  Q: <question> | A: <answer> | Wrong: <option>; <option>; <option>
- [UPSC] <fact>
  Q: <question> | A: <answer> | Wrong: <option>; <option>; <option>
## Current Affairs
- [UPSC] (${now.getFullYear()}) <fact>
  Q: <question> | A: <answer> | Wrong: <option>; <option>; <option>

Aim for about ${WANT[key] || 30} facts in all. No introduction, no closing remarks.`;
}

// ---------- notes ----------
export function makeNote(x = {}) {
  const exam = EXAM_TAGS.find((t) => t === String(x.exam || "").toUpperCase().trim()) || "SSC";
  const section = SECTION_NAMES.includes(x.section) ? x.section : sectionOf(x.section) || "History";
  const a = str(x.a, 200);
  const options = [...new Set((Array.isArray(x.options) ? x.options : []).map((o) => str(o, 120)).filter((o) => o && o.toLowerCase() !== a.toLowerCase()))].slice(0, 3);
  const year = Math.round(Number(x.year)) || 0;
  return {
    id: x.id || uid(),
    section,
    exam,
    note: str(x.note, 400),
    q: str(x.q, 300),
    a,
    options,
    year: section === "Current Affairs" && year >= 1990 && year <= 2100 ? year : 0,
  };
}

/** Keep real notes, drop repeats; sorted by subject, then SSC → UPSC → RBI (stable inside). */
export function cleanNotes(list) {
  const out = [];
  for (const x of list.map(makeNote)) {
    if (x.note.length < 8) continue;
    if (out.some((y) => questionSimilarity(y.note, x.note) >= 0.8)) continue;
    out.push(x);
  }
  const order = (n) => SECTION_NAMES.indexOf(n.section) * 10 + EXAM_TAGS.indexOf(n.exam);
  return out.map((n, i) => [n, i]).sort((a, b) => order(a[0]) - order(b[0]) || a[1] - b[1]).map(([n]) => n);
}

/** Read the Gemini / ChatGPT app's answer to buildAreaPrompt: "## Section", "- [SSC] fact", "Q: … | A: … | Wrong: a; b; c". */
export function readAreaNotes(text) {
  const notes = [];
  let section = "";
  let last = null;
  const clean = (l) => l.replace(/\*\*|__/g, "").replace(/`/g, "").trim();
  const readQ = (body) => {
    const parts = body.split(/\s*\|\s*/);
    const q = { q: "", a: "", options: [] };
    for (const p of parts) {
      const m = /^(Q|A|Ans(?:wer)?|Wrong|Not|Options?|Wrong options?)\s*[:.-]\s*(.*)$/i.exec(p.trim());
      if (!m) {
        if (!q.q) q.q = p.trim();
        continue;
      }
      const k = m[1].toLowerCase();
      if (k === "q") q.q = m[2];
      else if (k.startsWith("a")) q.a = m[2];
      else q.options = m[2].split(/\s*[;/]\s*/).filter(Boolean);
    }
    return q;
  };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = clean(raw);
    if (!line) continue;
    const head = /^(#{1,4})\s*(.+?)\s*:?$/.exec(line) || (/^\*\*.+\*\*:?$/.test(raw.trim()) ? [null, "", line.replace(/:$/, "")] : null);
    if (head) {
      const sec = sectionOf(head[2].split(/\s[—–-]\s/)[0]);
      if (sec) section = sec;
      last = null;
      continue;
    }
    const qm = /^(?:[-*•]\s*)?(?:Q\d*|Question)\s*[:.]\s*(.+)$/i.exec(line);
    if (qm && last) {
      Object.assign(last, readQ(`Q: ${qm[1]}`));
      continue;
    }
    const am = /^(?:[-*•]\s*)?(A|Ans|Answer)\s*[:.]\s*(.+)$/i.exec(line);
    if (am && last) {
      const r = readQ(`A: ${am[2]}`);
      last.a = r.a;
      if (r.options.length) last.options = r.options;
      continue;
    }
    const wm = /^(?:[-*•]\s*)?(Wrong|Not|Options?)\s*[:.]\s*(.+)$/i.exec(line);
    if (wm && last) {
      last.options = wm[2].split(/\s*[;/]\s*/).filter(Boolean);
      continue;
    }
    const bm = /^(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line);
    const body = bm ? bm[1] : line.length > 25 && section ? line : "";
    if (!body) continue;
    let rest = body;
    let exam = "";
    const tag = /^\[?\s*(SSC|UPSC|RBI)\s*\]?\s*[:\-–]?\s*/i.exec(rest);
    if (tag) (exam = tag[1].toUpperCase()), (rest = rest.slice(tag[0].length));
    let year = 0;
    const ym = /^\(?((?:19|20)\d\d)\)?\s*[:\-–]?\s*/.exec(rest);
    if (ym && section === "Current Affairs") (year = Number(ym[1])), (rest = rest.slice(ym[0].length));
    last = { section: section || "History", exam: exam || "SSC", note: rest, q: "", a: "", options: [], year };
    notes.push(last);
  }
  return cleanNotes(notes);
}

// ---------- into GK questions ----------
/**
 * GK question inputs (for gk-store addItems) from the notes of one level, filed under their own head:
 * Places Visited › <place> › <level> (e.g. "Places Visited › Palayamkottai, Tirunelveli › Tamil Nadu"), not under the
 * common subjects. The subject and exam tag go in the tags. Notes with a question become questions (the note is the
 * explanation); notes without one become facts to remember.
 */
export function notesToGkInputs(notes, levelTitle, placeName) {
  return notes.map((n) => {
    const base = {
      category: PLACES,
      sub: str(levelTitle, 80),
      place: str(placeName || levelTitle, 100),
      year: 0,
      tags: ["My area", n.section, n.exam],
      source: `My area · ${str(levelTitle, 80)}`,
      difficulty: n.exam === "SSC" ? 2 : n.exam === "UPSC" ? 4 : 3,
    };
    const note = n.year ? `(${n.year}) ${n.note}` : n.note;
    return n.q && n.a ? { ...base, q: n.q, a: n.a, options: n.options, explain: note } : { ...base, q: note, a: "" };
  });
}
