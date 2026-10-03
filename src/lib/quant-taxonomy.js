// Maths & Reasoning topics (subject → topic; each question also has a free "type", e.g. "Two workers together")
// and an offline keyword classifier used when no AI is available. Pure; unit-tested.

export const SEP = " › ";
export const QUANT = "Quant";
export const REASONING = "Reasoning";

/** Subjects with their topics. Each topic has keywords (regular expressions, case-insensitive) for the offline classifier. */
export const QTAXONOMY = {
  [QUANT]: {
    icon: "🔢",
    topics: {
      "Number System": "divisib|remainder|unit digit|unit's digit|prime|factors? of|number of factors|integers?|place value|face value|divided by|cyclicity",
      "HCF & LCM": "hcf|lcm|gcd|highest common|least common|h\\.c\\.f|l\\.c\\.m",
      "Simplification & Approximation": "simplif|approximat|bodmas|\\?\\s*=|square root|cube root|surds?|indices|exponent|value of",
      Percentage: "percent|%|per cent",
      "Profit & Loss": "profit|loss|cost price|selling price|marked price|discount|c\\.p|s\\.p|mrp|dishonest|shopkeeper|gain",
      "Simple & Compound Interest": "interest|principal|compound|per annum|p\\.a\\.|compounded|amount after",
      "Ratio & Proportion": "ratio|proportion|mean proportional|third proportional|in the ratio",
      Partnership: "partner|investment|invested|invests|share of (the )?profit",
      Averages: "average|mean of|batsman|innings",
      Ages: "ages?\\b|years ago|years hence|older|younger|born",
      "Mixtures & Alligation": "mixture|alligation|milk|water|solution of|concentration|replaced",
      "Time & Work": "work|days to (complete|finish)|efficien|men can|women can|wages|complete the job",
      "Pipes & Cisterns": "pipes?|cistern|tank|leak|fill(ed|s)? the",
      "Time, Speed & Distance": "speed|distance|km/h|kmph|km/hr|m/s|journey|travel|average speed|overtakes?",
      Trains: "trains?\\b|platform|pole|crosses a",
      "Boats & Streams": "boat|stream|upstream|downstream|current",
      Mensuration: "area|volume|perimeter|surface area|cylinder|cone|sphere|cuboid|rectangle|circle|radius|diameter|hemisphere|frustum|prism",
      Algebra: "equation|polynomial|identity|factori[sz]|linear|x\\s*\\+\\s*1/x|a\\s*\\+\\s*b|simultaneous",
      "Quadratic Equations": "quadratic|x²|x\\^2|roots|relationship between x and y|i\\.\\s*x",
      Geometry: "angle|triangle|parallel|chord|tangent|polygon|quadrilateral|similar triangles|congruent|centroid|circumcentre|incentre|orthocentre|median of|bisector",
      Trigonometry: "\\bsin|\\bcos|\\btan|\\bcot|\\bsec|cosec|trigonom|height and distance|elevation|depression",
      "Number Series": "number series|next term|missing number|wrong number|what will come|series",
      "Data Interpretation": "table|bar graph|pie chart|line graph|caselet|data interpretation|\\bdi\\b|chart",
      Probability: "probability|dice|coins?|cards?|drawn at random|chance|bag contains",
      "Permutation & Combination": "arrange|permutation|combination|how many ways|in how many|select|committee|\\bncr\\b|\\bnpr\\b|factorial",
      Statistics: "median|mode|standard deviation|variance|range of",
    },
  },
  [REASONING]: {
    icon: "🧩",
    topics: {
      Puzzles: "puzzle|floors?\\b|boxes|scheduled?|different months|different days|lives? on",
      "Seating Arrangement": "sitting|seated|sit\\b|facing|circular|square table|rectangular table|row\\b|immediate (left|right)|neighbou?r",
      Syllogism: "syllogism|conclusions?\\s+(i|ii|follow)|all .{1,30} are|some .{1,30} are|no .{1,30} (is|are)",
      Inequality: "inequalit|definitely true|[<>≤≥]",
      "Blood Relations": "father|mother|brother|sister|\\bson\\b|daughter|uncle|aunt|husband|wife|nephew|niece|grand|relation|in-law",
      "Direction Sense": "north|south|east|west|directions?|turns? (left|right)|walks?|shadow",
      "Coding-Decoding": "\\bcode|coded|written as|language|encoded",
      "Order & Ranking": "\\brank|position from|tallest|shortest|taller|shorter|heaviest|lightest|from the top|from the bottom|from the left end",
      "Alphanumeric Series": "alphabet|letters?\\b|letter series|symbols?|alphanumeric|english alphabet",
      "Input-Output": "input|output|machine|step\\s*\\d|rearrangement",
      "Statement & Conclusion": "assumptions?|course of action|arguments?|inference|cause and effect|statement and|strong argument",
      "Data Sufficiency": "data sufficiency|sufficient|statement i\\b|statements? i and ii|alone",
      "Analogy & Classification": "analogy|odd one|odd man|related to|same way as|similar relationship|classification|does not belong",
      Calendar: "calendar|leap year|day of the week|odd days|what day",
      Clocks: "clock|hands?\\b|minute hand|hour hand|angle between the hands|mirror image of (the )?clock",
      "Venn Diagrams": "venn|diagram (best )?represents|both .{1,20} and",
      "Non-verbal": "mirror image|water image|figure|paper (is )?folded|embedded|dice faces|counting (of )?figures|triangles in",
    },
  },
};

export const QSUBJECTS = Object.keys(QTAXONOMY);
export const topicsOf = (subject) => Object.keys(QTAXONOMY[subject]?.topics || {});
export const ALL_QTOPICS = QSUBJECTS.flatMap((s) => topicsOf(s).map((t) => ({ subject: s, topic: t, key: s + SEP + t })));

/** "Quant › Time & Work" */
export const qTopicKey = (it) => [it.subject || QUANT, it.topic || "Other"].join(SEP);
/** "Quant › Time & Work › Two workers together" — the question type, for practising similar questions together. */
export const qPatternKey = (it) => [qTopicKey(it), it.pattern || "General"].join(SEP);

const compiled = new Map();
const hits = (src, text) => {
  if (!compiled.has(src)) compiled.set(src, new RegExp(`(?:${src})`, "gi"));
  const r = compiled.get(src);
  r.lastIndex = 0;
  return (text.match(r) || []).length;
};

/** Best guess of subject and topic from the text alone. */
export function classifyQuant(text) {
  const t = String(text || "").toLowerCase();
  let best = { subject: QUANT, topic: "Simplification & Approximation", score: 0 };
  for (const subject of QSUBJECTS) {
    for (const [topic, kw] of Object.entries(QTAXONOMY[subject].topics)) {
      // Longer keyword lists would win unfairly; count distinct-ish hits.
      const score = hits(kw, t);
      if (score > best.score) best = { subject, topic, score };
    }
  }
  return { subject: best.subject, topic: best.topic, confidence: best.score };
}

/** Find the topic named in free text ("Time and Work", "time & work", "Seating arrangement (circular)"). */
export function matchTopic(subject, text) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const n = norm(text);
  if (!n) return "";
  const pool = subject ? topicsOf(subject).map((t) => [subject, t]) : ALL_QTOPICS.map((x) => [x.subject, x.topic]);
  const exact = pool.find(([, t]) => norm(t) === n);
  if (exact) return exact;
  return pool.find(([, t]) => n.includes(norm(t)) || norm(t).includes(n)) ?? pool.find(([, t]) => norm(t).split(" ").filter((w) => w.length > 3).some((w) => n.includes(w))) ?? "";
}
