// GK topic tree (subject → chapter; Current Affairs → year → topic) and an offline keyword classifier used
// when no AI is available. Pure; unit-tested. Topic keys look like "Polity › Constitution" or
// "Current Affairs › 2026 › Banking & Finance".

export const SEP = " › ";
export const CA = "Current Affairs";
export const OTHER = "Other";
/** Notes from 📍 My Area: their own head, by place visited → level (town, district, state, region). */
export const PLACES = "Places Visited";

/**
 * Subjects with their chapters. Each chapter has keywords (regular expressions, case-insensitive) used by
 * the offline classifier; AI chooses from the same names, so the tree stays tidy either way.
 */
export const TAXONOMY = {
  History: {
    icon: "🏛️",
    subs: {
      "Ancient India": "harappa|indus valley|vedic|veda|maurya|ashoka|chandragupta|gupta|buddha|buddhism|mahavira|jain|mahajanapada|kushan|kanishka|satavahana|sangam|chola|pallava|chalukya|harsha|megasthenes|kautilya|arthashastra",
      "Medieval India": "sultanate|mughal|akbar|babur|humayun|aurangzeb|shah jahan|jahangir|vijayanagara|krishnadeva|bahmani|maratha|shivaji|rajput|qutub|tughlaq|khilji|lodi|sher shah|bhakti|sufi|kabir|guru nanak|panipat",
      "Modern India": "british|east india company|1857|revolt|plassey|buxar|battle of|anglo-|congress|swadeshi|gandhi|nehru|non-cooperation|civil disobedience|quit india|dandi|salt march|jallianwala|partition of bengal|simon commission|round table|bose|bhagat singh|freedom struggle|viceroy|governor-general|subsidiary alliance|doctrine of lapse|independence|cripps|cabinet mission|tilak|gokhale|lucknow pact|khilafat|champaran|ina|azad hind",
      "World History": "french revolution|american revolution|world war|renaissance|industrial revolution|cold war|russian revolution|napoleon|hitler|league of nations|magna carta|reformation|holocaust",
      "Art & Culture": "dance|classical|kathak|bharatanatyam|kathakali|odissi|kuchipudi|manipuri|mohiniyattam|sattriya|painting|madhubani|warli|architecture|temple|stupa|cave|ajanta|ellora|music|raga|gharana|folk|puppet|festival|unesco heritage|monument",
    },
  },
  Polity: {
    icon: "⚖️",
    subs: {
      Constitution: "constitution|article \\d+|amendment|schedule|preamble|constituent assembly|directive principle|fundamental duty|borrowed from|part [ivx]+|emergency|federal|secular|socialist",
      "Fundamental Rights & Duties": "fundamental right|writ|habeas corpus|mandamus|certiorari|prohibition|quo warranto|right to equality|right to freedom|untouchability|right against exploitation|fundamental dut",
      Parliament: "parliament|lok sabha|rajya sabha|speaker|money bill|joint sitting|zero hour|question hour|quorum|bill|ordinance|session|member of parliament|mp\\b",
      "Executive": "president|vice[- ]president|prime minister|council of ministers|cabinet|governor|chief minister|attorney general|pardon|veto",
      Judiciary: "supreme court|high court|chief justice|judge|judicial review|collegium|pil|public interest litigation|lok adalat|tribunal",
      "Constitutional & Statutory Bodies": "election commission|cag|comptroller|finance commission|upsc|public service commission|niti aayog|nhrc|human rights commission|lokpal|cvc|cbi|nita|gst council|national commission",
      "Local Government": "panchayat|panchayati raj|municipal|gram sabha|73rd|74th|local self",
    },
  },
  Economy: {
    icon: "📈",
    subs: {
      "Basics & National Income": "gdp|gnp|gva|national income|inflation|deflation|cpi|wpi|recession|stagflation|per capita|base year|economic growth|unemployment|poverty|human development",
      "Budget & Fiscal Policy": "budget|fiscal deficit|revenue deficit|primary deficit|tax|gst|direct tax|indirect tax|disinvestment|frbm|finance bill|cess|surcharge",
      "Planning & Schemes": "five[- ]year plan|planning commission|niti|scheme|yojana|mission|abhiyan|pm-?kisan|mgnrega|ayushman|swachh",
      "Agriculture": "agricultur|crop|kharif|rabi|zaid|msp|minimum support price|green revolution|white revolution|fertili[sz]er|irrigation|food security|fci",
      "Industry & Infrastructure": "industr|msme|make in india|navratna|maharatna|psu|infrastructure|core sector|startup|production[- ]linked|pli",
      "International Trade & Bodies": "wto|world trade|export|import|balance of payment|current account|fdi|fii|exchange rate|tariff|unctad|oecd|g20|brics|imf|world bank|adb|aiib",
    },
  },
  "Banking & Finance": {
    icon: "🏦",
    subs: {
      "RBI & Monetary Policy": "rbi|reserve bank|repo|reverse repo|crr|slr|bank rate|msf|monetary policy|mpc|open market|omo|liquidity|lender of last resort|governor of rbi|currency issue",
      "Banking System": "bank|nationali[sz]|scheduled bank|small finance|payments bank|regional rural|rrb|cooperative bank|npa|non-performing|basel|capital adequacy|sarfaesi|ibc|insolvency|deposit insurance|dicgc|nabard|sidbi|exim|nhb|mudra",
      "Financial Markets": "sebi|stock exchange|bse|nse|sensex|nifty|share|ipo|mutual fund|bond|debenture|derivative|money market|capital market|treasury bill|commercial paper|certificate of deposit",
      "Insurance & Pension": "insurance|irdai|lic|pension|pfrda|nps|atal pension|epfo|provident fund",
      "Financial Inclusion & Payments": "jan dhan|financial inclusion|upi|npci|rupay|imps|neft|rtgs|aeps|bhim|digital payment|kyc|cheque|cbdc|e-rupee|wallet|ppi",
      "Banking Terms": "mclr|casa|nostro|vostro|bancassurance|haircut|demand draft|overdraft|cheque truncation|priority sector|base rate|lien|hypothecation|pledge|mortgage|teaser loan|crisil|credit rating",
    },
  },
  Geography: {
    icon: "🗺️",
    subs: {
      "Physical Geography": "earth|latitude|longitude|plate|earthquake|volcano|rock|atmosphere|troposphere|stratosphere|ocean current|tide|wind|cyclone|monsoon mechanism|solar system|planet|eclipse",
      "Indian Geography": "himalaya|western ghats|eastern ghats|plateau|deccan|thar|indian state|state of india|mineral|coal|iron ore|soil|black soil|laterite|national highway|port|pass\\b|tribe",
      "World Geography": "continent|country|largest|longest|desert|strait|canal|isthmus|mountain range|alps|andes|rockies|amazon|sahara|equator|tropic|time zone",
      "Rivers, Lakes & Dams": "river|ganga|yamuna|brahmaputra|godavari|krishna|kaveri|cauvery|narmada|tapi|mahanadi|indus|tributary|delta|lake|dam|reservoir|waterfall",
      "Climate & Environment": "climate|monsoon|el nino|la nina|global warming|greenhouse|ozone|biodiversity|ecosystem|ramsar|wetland|national park|sanctuary|tiger reserve|biosphere|endangered|iucn|pollution|carbon",
    },
  },
  Biology: {
    icon: "🧬",
    subs: {
      "Human Body": "heart|blood|kidney|liver|lung|brain|bone|skeleton|muscle|organ|digest|enzyme|hormone|gland|insulin|nerve|eye|ear|skin|human body",
      "Diseases & Health": "disease|virus|bacteria|vaccine|malaria|tuberculosis|polio|covid|dengue|cholera|typhoid|aids|hiv|cancer|antibiotic|deficiency|immunity|pathogen",
      "Nutrition & Vitamins": "vitamin|protein|carbohydrate|fat|mineral nutrient|calcium|iron deficiency|iodine|scurvy|rickets|beriberi|night blindness|nutrition|diet",
      "Plants & Animals": "plant|photosynthesis|chlorophyll|leaf|root|flower|seed|botany|zoology|animal|mammal|reptile|bird|fish|insect|species|kingdom|classification",
      "Cell & Genetics": "cell|nucleus|mitochondria|dna|rna|gene|chromosome|heredity|mendel|evolution|darwin|cloning|stem cell",
    },
  },
  Physics: {
    icon: "⚛️",
    subs: {
      "Motion & Mechanics": "motion|newton|force|velocity|acceleration|gravity|gravitation|momentum|friction|pressure|work|energy|power|lever|inertia",
      "Heat & Thermodynamics": "heat|temperature|thermometer|celsius|fahrenheit|kelvin|thermodynamic|conduction|convection|radiation|boiling|melting|evaporation|specific heat",
      "Light & Sound": "light|reflection|refraction|lens|mirror|prism|spectrum|rainbow|optic|sound|echo|frequency|decibel|ultrasonic|wave",
      "Electricity & Magnetism": "electric|current|voltage|resistance|ohm|ampere|circuit|magnet|magnetic|transformer|generator|motor|battery|fuse",
      "Units & Modern Physics": "unit|si unit|measure|instrument|atom|nuclear|radioactiv|x-ray|laser|semiconductor|quantum|relativity|einstein",
    },
  },
  Chemistry: {
    icon: "⚗️",
    subs: {
      "Elements & Periodic Table": "element|periodic table|atomic number|symbol|noble gas|isotope|valency|mendeleev|metal|non-metal|halogen",
      "Acids, Bases & Salts": "acid|base|alkali|ph\\b|ph value|salt|neutrali[sz]|litmus|vinegar|baking soda|washing soda|bleaching powder",
      "Everyday Chemistry": "gas used|lpg|cng|cement|glass|soap|detergent|fertili[sz]er|plastic|polymer|fuel|explosive|chemical name|common name|formula",
      "Metals, Ores & Alloys": "ore|alloy|bronze|brass|steel|stainless|amalgam|corrosion|rust|galvani[sz]|bauxite|haematite",
      "Organic Chemistry": "organic|carbon compound|hydrocarbon|methane|ethanol|alcohol|ester|benzene",
    },
  },
  "Science & Tech": {
    icon: "🚀",
    subs: {
      Space: "isro|nasa|satellite|chandrayaan|mangalyaan|gaganyaan|aditya|rocket|launch vehicle|pslv|gslv|orbit|space station",
      Defence: "missile|agni|prithvi|brahmos|akash|nag|tejas|submarine|aircraft carrier|drdo|army|navy|air force|exercise",
      "IT & Computers": "computer|internet|software|hardware|cpu|ram|rom|byte|virus program|artificial intelligence|\\bai\\b|blockchain|5g|cyber|semiconductor chip",
      "Inventions & Discoveries": "invent|discover|invented|discovered|father of",
    },
  },
  "Static GK": {
    icon: "📌",
    subs: {
      "Books & Authors": "book|author|wrote|written by|novel|autobiography|poem|poet",
      "Awards & Honours": "award|prize|bharat ratna|padma|nobel|dadasaheb|jnanpith|arjuna|khel ratna|dronacharya|booker|magsaysay|pulitzer|oscar",
      Sports: "cricket|football|hockey|tennis|badminton|olympic|commonwealth|asian games|trophy|cup|stadium|world cup|chess|athlete|player",
      "Important Days": "day is observed|day is celebrated|observed on|celebrated on|international day|world .* day|national .* day|jayanti",
      "National Symbols": "national animal|national bird|national flower|national tree|national song|national anthem|national emblem|national flag|national river|national fruit|national aquatic",
      "Firsts & Superlatives": "first (indian|woman|man|person)|largest|smallest|longest|highest|tallest|oldest|biggest|deepest",
      "Organisations & Headquarters": "headquarter|hq\\b|founded in|established in|united nations|un\\b|unesco|who\\b|unicef|ilo|fao|interpol|nato|saarc|asean|opec|commonwealth of nations",
      "Countries, Capitals & Currencies": "capital of|currency of|currency|parliament of|capital city",
      "Personalities & Titles": "known as|called the|nickname|title of|iron man|nightingale|missile man|frontier gandhi|father of the nation",
      "Abbreviations": "full form|stands for|abbreviation",
      "Indian States": "state animal|state capital|formed in|state of|union territor|statehood",
    },
  },
};

/** Topics inside each Current Affairs year. */
export const CA_TOPICS = {
  National: "india|government|ministry|state government|launched|inaugurat|cabinet approv|policy|bill passed",
  International: "summit|bilateral|united nations|un\\b|country|foreign|global|g20|g7|brics|quad|nato|visit",
  "Economy & Business": "gdp|growth|inflation|economy|merger|acquisition|company|startup|unicorn|trade|export|forecast",
  "Banking & Finance": "rbi|bank|sebi|repo|rate|loan|upi|npci|insurance|irdai|digital rupee|monetary|fintech",
  "Schemes & Policies": "scheme|yojana|mission|abhiyan|programme|portal|initiative",
  "Science & Tech": "isro|nasa|satellite|launch|ai\\b|artificial intelligence|technology|research|discovery|space",
  Environment: "climate|environment|cop\\d*|pollution|wildlife|tiger|forest|ramsar|biodiversity|emission",
  Sports: "cricket|football|hockey|tennis|badminton|olympic|medal|tournament|champion|won the|world cup|chess",
  "Awards & Honours": "award|prize|honour|honored|honoured|conferred",
  Appointments: "appointed|elected|sworn in|took charge|new chief|new head|chairman|ceo|governor|resign",
  "Reports & Indices": "index|report|ranking|ranked|survey",
  Defence: "missile|exercise|army|navy|air force|drdo|defence|military",
  "Days & Themes": "day observed|theme|celebrated on|observed on",
  Obituaries: "passed away|died|demise",
  Other: "",
};

const INDIAN_STATES =
  "andhra pradesh|arunachal|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal";

/**
 * The shape of a question says more than scattered keywords: "who wrote", "headquarters of", "full form of".
 * These phrases count three times as much as ordinary keywords.
 */
const STRONG = {
  "Static GK": {
    "Books & Authors": "who wrote|written by|author of|autobiography|who created the fictional",
    "Organisations & Headquarters": "headquarters|secretariat of|\\bhq\\b",
    Abbreviations: "stand for|stands for|full form",
    "Important Days": "day (?:is )?(?:observed|celebrated)|when is [a-z' ]+ day|observed on|celebrated on",
    "National Symbols": "national (?:animal|bird|flower|tree|song|anthem|emblem|flag|aquatic|heritage|fruit|river|calendar)|ashoka chakra",
    "Firsts & Superlatives": "first (?:woman|indian|president|prime minister|person)|largest population|longest river in india",
    "Personalities & Titles": "who is (?:known|called|popularly known) as",
    "Indian States": `newest state|state (?:sends|has) the most|capital of (?:${INDIAN_STATES})`,
    "Countries, Capitals & Currencies": "capital of|currency of",
    "Awards & Honours": "award|gallantry|bharat ratna|nobel prize",
    Sports: "players|olympic|trophy|\\bcup\\b",
  },
  "Banking & Finance": {
    "RBI & Monetary Policy": "\\brbi\\b|reserve bank|one-rupee|rupee note|repo|cash reserve|monetary policy|lender of last resort|bank for international settlements",
    "Banking Terms": "\\bcasa\\b|mclr",
    "Financial Markets": "treasury bill|sensex|nifty|stock exchange|sebi",
    "Financial Inclusion & Payments": "jan dhan|upi|rtgs|neft|\\bkyc\\b",
  },
  Economy: {
    "International Trade & Bodies": "international monetary fund|\\bimf\\b|world bank|world trade|\\bwto\\b|asian development bank|new development bank|brics|bretton woods",
    "Planning & Schemes": "niti aayog|planning commission|five year plan|mgnrega",
    "Budget & Fiscal Policy": "\\bgst\\b|fiscal deficit|primary deficit|budget",
    Agriculture: "kharif|\\brabi\\b|green revolution|white revolution|operation flood",
    "Basics & National Income": "hindu rate of growth|inflation|\\bgdp\\b",
  },
  Biology: {
    "Human Body": "body temperature|haemoglobin|hemoglobin|blood group|gland|bone",
    "Diseases & Health": "penicillin|vaccine|malaria|dengue|tuberculosis",
  },
  Chemistry: {
    "Everyday Chemistry": "chemical name|washing soda|baking soda|plaster of paris|laughing gas|dry ice|\\blpg\\b|\\bcng\\b",
    "Elements & Periodic Table": "lightest element|chemical symbol|periodic table|noble gas|gas in the (?:earth's )?atmosphere|liquid at room temperature",
  },
  "Science & Tech": {
    Space: "isro|chandrayaan|mangalyaan|mars orbiter|space programme|satellite",
    Defence: "brahmos|missile|tejas|drdo",
    "IT & Computers": "computer|\\bcpu\\b|byte|world wide web",
    "Inventions & Discoveries": "who invented|invented|who discovered|theory of relativity",
  },
  History: {
    "Modern India": "partition|partitioned|curzon|quit india|dandi|jallianwala|plassey|governor-general",
  },
  Geography: {
    "Indian Geography": "southernmost|northernmost|easternmost|westernmost|black soil|coastline",
  },
};

export const SUBJECTS = Object.keys(TAXONOMY);
export const ALL_CATEGORIES = [...SUBJECTS, CA, PLACES, OTHER];

/** The key for a question's place in the tree. */
export function topicKey(item) {
  if (item.category === CA) return [CA, item.year || "Undated", item.sub || "Other"].join(SEP);
  if (item.category === PLACES) return [PLACES, item.place || "Other places", item.sub || "General"].join(SEP);
  return [item.category || OTHER, item.sub || "General"].join(SEP);
}

/** Every chapter name for a subject (or the Current Affairs topics). */
export const subsOf = (category) => (category === CA ? Object.keys(CA_TOPICS) : Object.keys(TAXONOMY[category]?.subs || {}));

/** All "Subject › Chapter" options, for pickers. */
export const ALL_TOPICS = SUBJECTS.flatMap((c) => subsOf(c).map((s) => ({ category: c, sub: s, key: c + SEP + s })));

const compiled = new Map();
const re = (src) => {
  // Keywords must start at a word boundary ("ear" must not match "year"); stems like "agricultur" still work.
  if (!compiled.has(src)) compiled.set(src, src ? new RegExp(`\\b(?:${src})`, "gi") : null);
  return compiled.get(src);
};
const hits = (src, text) => {
  const r = re(src);
  if (!r) return 0;
  r.lastIndex = 0;
  return (text.match(r) || []).length;
};

/** Years 2015–2039 mentioned in the text. */
export const yearsIn = (text) => [...String(text).matchAll(/\b(20[1-3]\d)\b/g)].map((m) => Number(m[1]));

const CA_HINT = /\b(recently|recent|newly|latest|this year|launched|has been appointed|was appointed|took charge|announced|inaugurated|will host|hosted|won the|passed away|current affairs)\b/i;

/**
 * Best guess of where a question belongs, from its text alone (no AI).
 * Current affairs are recognised by a recent year or words like "recently", "launched", "appointed".
 * @returns {{category: string, sub: string, year: number, confidence: number}}
 */
export function classify(text, { now = new Date() } = {}) {
  const t = String(text || "");
  const allYears = [...t.matchAll(/\b(1[0-9]\d\d|20[0-3]\d)\b/g)].map((m) => Number(m[1]));
  const years = allYears.filter((y) => y >= 2015 && y <= now.getFullYear() + 1);
  const latest = years.length ? Math.max(...years) : 0;
  const recent = latest && latest >= now.getFullYear() - 6;
  // "Launched in 1942" is history: an old year outweighs words like "launched" or "recently".
  const onlyOldYears = allYears.length && !recent;
  const isCA = recent || (CA_HINT.test(t) && !onlyOldYears);
  if (isCA) {
    let best = "Other";
    let score = 0;
    for (const [sub, src] of Object.entries(CA_TOPICS)) {
      const s = hits(src, t);
      if (s > score) (best = sub), (score = s);
    }
    return { category: CA, sub: best, year: latest || now.getFullYear(), confidence: score ? 0.6 : 0.3 };
  }
  let best = { category: OTHER, sub: "General", score: 0 };
  for (const [category, { subs }] of Object.entries(TAXONOMY)) {
    for (const [sub, src] of Object.entries(subs)) {
      const s = hits(src, t) + 3 * hits(STRONG[category]?.[sub] || "", t);
      if (s > best.score) best = { category, sub, score: s };
    }
  }
  return { category: best.category, sub: best.sub, year: 0, confidence: Math.min(1, best.score / 2) };
}
