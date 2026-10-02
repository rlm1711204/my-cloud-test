// Claude-powered extraction and enrichment of exam vocabulary.
// The API key is the user's own, kept only in this browser's localStorage.
import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-opus-5-5";

export const EXAMS = {
  general: "competitive exams in India",
  upsc: "UPSC Civil Services (Essay, GS answer writing, CSAT comprehension)",
  rbi: "RBI Grade B / SEBI / NABARD (descriptive English, reading comprehension)",
  ssc: "SSC CGL / CHSL (one-word substitution, synonyms/antonyms, idioms, cloze tests)",
  bank: "IBPS / SBI PO (reading comprehension, cloze tests, error spotting)",
  cat: "CAT / GMAT (verbal ability, reading comprehension)",
  ielts: "IELTS / TOEFL / GRE",
};

const WORD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "word", "pos", "meaning", "hindi", "tamil", "ipa", "say", "sentences",
    "synonyms", "antonyms", "examTip", "difficulty", "context",
  ],
  properties: {
    word: { type: "string", description: "Dictionary base form, lowercase unless a proper adjective." },
    pos: { type: "string", description: "Part of speech, e.g. verb, adjective, noun, idiom." },
    meaning: { type: "string", description: "Simple English meaning in under 15 words." },
    hindi: { type: "string", description: "Hindi meaning in Devanagari (1–3 common equivalents)." },
    tamil: { type: "string", description: "Tamil meaning in Tamil script, or empty string if not requested." },
    ipa: { type: "string", description: "IPA pronunciation, e.g. /əˈbeɪt/." },
    say: { type: "string", description: "Easy respelling with stressed syllable in capitals, e.g. uh-BAYT." },
    sentences: {
      type: "array",
      items: { type: "string" },
      description: "Exactly 2 natural example sentences in an exam/news/governance register.",
    },
    synonyms: { type: "array", items: { type: "string" }, description: "2–4 synonyms." },
    antonyms: { type: "array", items: { type: "string" }, description: "0–3 antonyms." },
    examTip: {
      type: "string",
      description:
        "One high-value exam note: root/etymology, mnemonic, commonly confused word, idiom or one-word substitution use.",
    },
    difficulty: { type: "integer", description: "1 (easy) to 5 (very hard) for an Indian exam aspirant." },
    context: { type: "string", description: "The sentence from the source where it appeared, or empty string." },
  },
};

export const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["words"],
  properties: { words: { type: "array", items: WORD_SCHEMA } },
};

/** Step 1 output: just the words found and the line each came from (small, so long lists fit). */
export const LIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["words"],
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "context"],
        properties: {
          word: { type: "string", description: "The word/idiom exactly as the headword, in dictionary base form." },
          context: { type: "string", description: "The source line or sentence it came from (include any meaning given there)." },
        },
      },
    },
  },
};

export function systemPrompt({ exam, tamil }) {
  return [
    `You are a vocabulary coach for an Indian aspirant preparing for ${EXAMS[exam] ?? EXAMS.general}.`,
    "The learner is a graduate with good everyday English; they want to build an exam-grade vocabulary.",
    "A word is DIFFICULT if an educated Indian graduate might not confidently know or use it: advanced",
    "vocabulary, formal/literary words, idioms and phrasal verbs with non-obvious meaning, and words exams",
    "commonly test (synonyms/antonyms, one-word substitutions, confusable pairs). When you PICK words out of",
    "material, easy everyday words (e.g. important, government, beautiful, increase) must never be included.",
    "But when the learner gives you a list of words, write a full card for EVERY one of them, easy or not —",
    "the learner chose them, so never drop or skip a word.",
    "Write meanings in plain, simple English. Hindi meanings in Devanagari, the way a Hindi newspaper would say it.",
    tamil
      ? "Also give the Tamil meaning in Tamil script (the learner is learning Tamil)."
      : "Leave the tamil field as an empty string.",
    "Example sentences should be the kind of sentence an examiner or The Hindu editorial would write.",
  ].join("\n");
}

function makeClient(apiKey) {
  if (!apiKey) throw new Error("Add your Claude API key in Settings to use AI extraction.");
  // Browser use is intentional: this is a personal app and the key never leaves the user's device except to Anthropic.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

async function run(settings, content, onProgress, schema = RESULT_SCHEMA) {
  const client = makeClient(settings.apiKey);
  const stream = client.beta.messages.stream({
    model: settings.model || DEFAULT_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    system: systemPrompt(settings),
    messages: [{ role: "user", content }],
  });
  let chars = 0;
  stream.on("text", (t) => {
    chars += t.length;
    onProgress?.(`Writing word cards… (${Math.round(chars / 1000)}k characters)`);
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    throw new Error("Claude declined to process this content. Try a different page or type the words instead.");
  }
  if (msg.stop_reason === "max_tokens") {
    throw new Error("The page had too many words for one go. Split the PDF or upload fewer pages at a time.");
  }
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.words) ? parsed.words : [];
}

/** Task text shared by every AI provider. */
export const listInstruction = () =>
  "Read all the material above (it may be a screenshot, a photographed book page, handwritten notes or a PDF). " +
  "If it is a VOCABULARY LIST, glossary or word table: list EVERY headword/idiom in it, in order, including easy ones — " +
  "do not skip, merge or summarise any entry (use the words in the word column only, not words from the explanations). " +
  "Otherwise (an article, editorial, notes): list every DIFFICULT word, idiom or phrasal verb, following the definition in " +
  "your instructions. Put the source line or sentence in `context`, written correctly (fix garbled text). " +
  "`word` must be ONLY the headword itself: never a pronunciation or respelling (e.g. UT-er, ROO-mi-nayt, /əˈbeɪt/), " +
  "a part-of-speech label such as (verb), a number, or a meaning. If the same word appears more than once (e.g. as " +
  "verb and adjective), list it once.";

export const enrichInstruction = (words, notes = []) =>
  `Create a complete word card for EACH of these ${words.length} words/phrases, in the same order — exactly ${words.length} ` +
  "card(s). Keep every one of them even if it seems easy, and correct obvious spelling mistakes in `word`. Where a source line is given, the card must match that " +
  "sense (reuse a Hindi meaning given there) and `context` must be that line; otherwise leave `context` empty.\n\n" +
  words.map((w, i) => `${i + 1}. ${w}${notes[i] ? `   [source: ${String(notes[i]).slice(0, 300)}]` : ""}`).join("\n");

/** Step 1: list the words in images/PDFs (or plain text). Resolves [{word, context}]. */
export async function claudeList(settings, sources, onProgress) {
  const content = [];
  for (const s of sources) {
    if (s.kind === "image") content.push({ type: "image", source: { type: "base64", media_type: s.mediaType, data: s.data } });
    else if (s.kind === "pdf")
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: s.data } });
    else content.push({ type: "text", text: `Source "${s.name}":\n${s.text}` });
  }
  content.push({ type: "text", text: listInstruction() });
  onProgress?.("Claude is reading your material…");
  return run(settings, content, onProgress, LIST_SCHEMA);
}

/** Build full word cards for words the learner typed (or saved without details). */
export async function claudeEnrich(settings, words, notes, onProgress) {
  onProgress?.(`Claude is preparing ${words.length} word card${words.length === 1 ? "" : "s"}…`);
  return run(settings, [{ type: "text", text: enrichInstruction(words, notes) }], onProgress);
}

/** Friendlier messages for the Claude errors people actually hit. */
export function explainClaudeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "Your Claude API key was rejected. Check it in Settings.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key can't use that model. Check your Anthropic Console.";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now — wait a minute and try again.";
  if (err instanceof Anthropic.BadRequestError) {
    const m = err.message || "";
    if (/credit|balance/i.test(m)) return "Your Anthropic account is out of credits. Add credits in the Anthropic Console.";
    return `Claude couldn't process this file: ${m}`;
  }
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach Claude. Check your internet connection.";
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status ?? "?"}): ${err.message}`;
  if (err instanceof SyntaxError) return "Claude's reply was incomplete. Please try again.";
  return err?.message || String(err);
}
