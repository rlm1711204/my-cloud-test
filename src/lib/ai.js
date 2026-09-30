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

export function systemPrompt({ exam, tamil }) {
  return [
    `You are a vocabulary coach for an Indian aspirant preparing for ${EXAMS[exam] ?? EXAMS.general}.`,
    "The learner is a graduate with good everyday English; they want to build an exam-grade vocabulary.",
    "A word is DIFFICULT if an educated Indian graduate might not confidently know or use it: advanced",
    "vocabulary, formal/literary words, idioms and phrasal verbs with non-obvious meaning, and words exams",
    "commonly test (synonyms/antonyms, one-word substitutions, confusable pairs). Easy everyday words",
    "(e.g. important, government, beautiful, increase) must never be included.",
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

async function run(settings, content, onProgress) {
  const client = makeClient(settings.apiKey);
  const stream = client.beta.messages.stream({
    model: settings.model || DEFAULT_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: RESULT_SCHEMA } },
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

const skipNote = (known) =>
  known.length
    ? `\n\nThe learner ALREADY HAS these words saved — do not return them or their inflections:\n${known.join(", ")}`
    : "";

/** Task text shared by every AI provider. */
export const extractInstruction = (known) =>
  "Read all the material above (it may be a screenshot, a photographed book page, handwritten notes or a PDF). " +
  "List every DIFFICULT word, idiom or phrasal verb in it, following the definition in your instructions. " +
  "If the material is itself a vocabulary list, include every entry. Use the dictionary base form. " +
  "Fill every field for each word; put the original sentence from the material in `context`." +
  skipNote(known);

export const enrichInstruction = (words) =>
  "Create a complete word card for EACH of these words/phrases, in the same order. Keep every one of " +
  "them even if it seems easy, and correct obvious spelling mistakes in `word`. Leave `context` empty.\n\n" +
  words.map((w, i) => `${i + 1}. ${w}`).join("\n");

/**
 * Extract difficult words from images and/or PDFs (or plain text) and return enriched cards.
 * @param {{kind: "image"|"pdf"|"text", mediaType?: string, data?: string, text?: string, name: string}[]} sources
 * @param {string[]} known - words already in the master list (skipped by the model)
 */
export async function claudeExtract(settings, sources, known, onProgress) {
  const content = [];
  for (const s of sources) {
    if (s.kind === "image") content.push({ type: "image", source: { type: "base64", media_type: s.mediaType, data: s.data } });
    else if (s.kind === "pdf")
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: s.data } });
    else content.push({ type: "text", text: `Source "${s.name}":\n${s.text}` });
  }
  content.push({ type: "text", text: extractInstruction(known) });
  onProgress?.("Claude is reading your material…");
  return run(settings, content, onProgress);
}

/** Build full word cards for words the learner typed (or saved without details). */
export async function claudeEnrich(settings, words, onProgress) {
  onProgress?.(`Claude is preparing ${words.length} word card${words.length === 1 ? "" : "s"}…`);
  return run(settings, [{ type: "text", text: enrichInstruction(words) }], onProgress);
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
