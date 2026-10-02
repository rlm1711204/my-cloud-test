# VocabVault — handoff note

Paste this into a new chat to carry the project over.

**Code:** https://github.com/rlm1711204/vocab-vault (public)
**Live app:** https://rlm1711204.github.io/vocab-vault/
**Latest commit:** `257a00d`

---

## What it is

A phone-friendly PWA for building exam vocabulary (UPSC / RBI Grade B / SSC).
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

## Decisions worth knowing before changing things

- **Gemini keys go in the `x-goog-api-key` header.** Google's newer `AQ.` keys fail as a `?key=`
  URL parameter. Several keys can be saved; they are tried in order, a key that hits its limit
  rests 10 minutes, and a key can be picked by hand on the Add screen.
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

Done and live: capture + extraction, duplicate checking, word cards, daily plan and flashcards,
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
