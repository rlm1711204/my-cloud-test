# VocabVault — handoff note

Paste this into a new chat to carry the project over.

**Code:** https://github.com/rlm1711204/vocab-vault (public)
**Live app:** https://rlm1711204.github.io/vocab-vault/
**Latest commit:** `257a00d`

---

## What it is

A phone-friendly PWA with two parts — exam **vocabulary** and **grammar rules** (UPSC / RBI Grade B / SSC).
Scan a page, upload a screenshot or PDF, or type words. The app keeps the hard words, writes a
full card for each (meaning, Hindi, pronunciation, 2 sentences, exam tip), and revises them daily
with spaced repetition. Data is stored on the device and synced to Google Drive.

Plain Vite + vanilla JavaScript. No framework. 79 unit tests (vitest). Deploys itself to GitHub
Pages via GitHub Actions on every push to `main`.

## How the parts fit

```
src/
  brand.js           app name, colour, icon, "Made by" credit  (the one file to edit for branding)
  main.js            all screens: Today, Add, Practice, Words, Settings  (~1800 lines)
  styles.css         theme tokens, light + dark
  lib/
    store.js         local state, settings, backup/restore, daily plan
    words.js         word records, duplicate + inflection matching, CSV
    srs.js           Leitner spaced repetition, daily plan, streaks
    practice.js      practice rounds (covers every word) + weak-word repetition
    bank.js          built-in Word Bank loader (1267 words in src/data/bank1-6.js)
    engine.js        provider order + fallback: Gemini -> Claude -> free dictionaries
    gemini.js        Gemini free tier: multiple keys, key picker, model auto-pick
    ai.js            Claude API + the prompts and card schema shared by both AI providers
    freedict.js      free word cards: dictionaryapi.dev + Wiktionary + MyMemory
    difficulty.js    offline hard-word filter using SCOWL frequency levels
    extract.js       image downscaling, PDF text layer (pdf.js), OCR (Tesseract)
    drive.js         Google Drive sync (JSON + a Google Sheet mirror)
    notify.js        daily 2-word notification schedule (shown by public/sw.js)
    install.js       "Install app" button (Chrome's install prompt) + manual steps
    theme.js         turns the one brand colour into light/dark shades
scripts/brand-build.mjs   generates the icon + manifest from brand.js at build time
```

## The Grammar Rules part

- Start screen (`#home`) chooses 📘 Vocabulary or 📗 Grammar; a header switch changes part; each part has its own tab
  bar (`renderChrome` in main.js). Grammar views are `g-today`, `g-add`, `g-practice`, `g-rules`; Settings is shared.
- Grammar screens live in `src/grammar-ui.js` (created with shared helpers from main.js via a `ctx` object).
- Data is fully separate: localStorage `vv.grammar.v1`, backup `app: "VocabVault-Grammar"`, Drive `grammar-rules.json`
  + "Grammar Rules" sheet. Each restore refuses the other part's file.
- Rule Book: `src/data/rules1-3.js`, a plain-text format parsed by `src/lib/rulebook.js`; the tests fail the build on
  any malformed line. Ids are `rb:<slug>`; only progress is stored for them.
- AI: `aiTask` in engine.js runs any job (system prompt + JSON schema + sources) on Gemini → other services → Claude.
  `grammar-ai.js` lists rules first, then writes cards 6 at a time, checks each card is about the rule asked for,
  retries left-out rules once, and keeps any still missing "as written".
- Without AI, typed/scanned text is split into rules (`textToRules`) and matched to the Rule Book (`borrowFromBook`).

## Decisions worth knowing before changing things

- **Gemini keys go in the `x-goog-api-key` header.** Google's newer `AQ.` keys fail as a `?key=`
  URL parameter. Several keys can be saved; they are tried in order, a key that hits its limit
  rests 10 minutes, and a key can be picked by hand on the Add screen.
- **Gemini models get retired for new accounts** (2.5 Flash returned 404 in Oct 2026). The app ranks the
  newest model first, follows the replacement named in Google's 404 message, remembers 404'd models per
  key, and tries the last model that worked first.
- **Gemini model names are never trusted to last.** `gemini-flash-latest` / `gemini-flash-lite-latest` aliases come
  first; a 404, or a 400 that names the model, skips that model but never marks the key invalid.
- **Other free AI services** (`src/lib/compat.js`) use the OpenAI chat-completions format and rank models from each
  service's live `/models` list (free-only on OpenRouter; picture-reading models when a photo is involved). Whether a
  service allows calls from a browser (CORS) can only be known from a real key: the key test on Add says so.
- **Open apps update themselves.** Each build writes `version.json`; the app checks it when reopened and every 30
  minutes, and reloads at a safe moment. A "Failed to fetch dynamically imported module" error (a file from an older
  version) also triggers one reload, with typed words saved in sessionStorage.
- **pdf.js must be the *legacy* build.** The modern build needs `Math.sumPrecise`, which phones
  don't have; without it text PDFs silently fell back to slow OCR.
- **Word matching is by normalised spelling** (`wordKey`), so restoring a backup twice never
  creates duplicates. The newer `updatedAt` wins per word.
- **The Word Bank is separate from the user's own list.** Bank ids are `b:<word>`; only progress
  is stored, not the words.
- **Backups contain words, progress and study preferences — never API keys.**
- **Service worker** `public/sw.js`, cache `vocabvault-v3`. Navigation requests use
  `cache: "no-store"` so GitHub Pages' HTML cache can't pin an old version. The `vv-notify`
  cache must survive `activate`.
- **Everything AI-related was tested with mocked network calls** — the sandbox could not reach
  the real Gemini or Claude APIs.

## Current state

Done and live: Grammar Rules part (Rule Book, practice, separate backups and Drive file), other free AI services with a per-scan AI picker, self-updating app, capture + extraction, duplicate checking, word cards, daily plan and flashcards,
practice with full coverage and weak-word repeats, the 1267-word Word Bank, daily notification,
ⓘ full-details buttons, Google Drive sync, install button, backup/restore with a clear summary,
one-file branding, and the Gemini key picker.

Known limits: notification timing is decided by Chrome and needs the installed app; free-mode
Hindi translations are machine-translated and sometimes imperfect; some Google accounts reject
`AQ.` keys with a 401 (a Google-side issue).

## Working style that fits this project

Small changes, each with a unit test, then `npm test` and `npm run build` before pushing.
Push to `main` and GitHub Actions deploys in about 2 minutes. Check the deployed version at the
bottom of the app's Settings screen — it ends with the commit's short hash.
