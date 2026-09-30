# VocabVault 📘: exam vocabulary builder

A phone-friendly web app (you can install it like an app) for building an exam-grade English vocabulary.
Snap a page, upload a screenshot or PDF, or type words. VocabVault keeps only the **difficult** words
and turns each one into a full word card. The cards go into a **master list saved in your Google Drive**.
Every day you get a **Word of the Day** plus **10 words to memorise** (you can change the number), scheduled with spaced repetition.

## What it does

| | |
|---|---|
| 📷 **Capture** | Camera scan, screenshots, multi-page PDFs (including scanned ones), or typed/pasted lists |
| 🧠 **Smart filtering** | Easy everyday words are dropped automatically, using Gemini (free), Claude (optional) or a word-frequency list |
| 🔁 **Duplicate check** | Every word is checked against your master list, including forms like *mitigated* ↔ *mitigate*. Duplicates are never added twice |
| 🗂️ **Word card** | Word, part of speech, simple meaning, **Hindi meaning**, optional **Tamil meaning**, IPA + easy pronunciation (*uh-BAYT*) with a 🔊 button, **2 example sentences**, synonyms, antonyms, an **exam tip** (root, mnemonic or confusable word), and the sentence where you found it |
| ☀️ **Daily plan** | Word of the Day (never repeats until all words have been featured) plus N words mixing due reviews and new words |
| 🃏 **Flashcards** | Forgot / Hard / Knew it / Easy. Words come back after 1 → 3 → 7 → 14 → 30 → 60 days |
| 🎯 **Quiz** | Word → meaning, Word → Hindi, Meaning → word (one-word substitution), fill in the blank (cloze), synonyms |
| ☁️ **Google Drive** | `VocabVault/vocab-master.json` (the app's data) plus a **"Vocab Master List" Google Sheet** you can open, filter or print. Syncs across phone and laptop |
| 📤 **Extras** | Share the Word of the Day to WhatsApp, 🔥 streak counter, CSV export for Excel, backup/restore, dark mode, works offline |

## Using it

**It's free by default.** No API key is needed:

- Hard words are picked using a word-frequency list (anything outside the ~10,000 most common English words).
- Meanings, IPA, a recorded **audio pronunciation**, synonyms/antonyms and example sentences come from free dictionaries:
  [Free Dictionary API](https://dictionaryapi.dev), plus [Wiktionary](https://en.wiktionary.org) for idioms and phrases.
- **Hindi/Tamil** meanings come from the free [MyMemory](https://mymemory.translated.net) translation service
  (a few hundred words a day). Machine translation of single words is sometimes imperfect, so fix any with ✎ Edit.
- Photos are read on your phone (OCR). PDFs are read from their text layer.

1. **Add**: scan or upload a page, or type words. On the review screen, untick anything you already know, then tap **Add**.
2. **Today**: read the Word of the Day, then tap **Start flashcards** for today's set.
3. **Quiz**: take one after revising. Words you get wrong come back in tomorrow's set.
4. **Words**: search and edit your list. **📖 Fill missing** retries lookups (e.g. after the daily translation limit resets).

**Free AI upgrade: Google Gemini.** Get a free key (no card needed) at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) and paste it in **Settings → Google Gemini**. Gemini then
judges difficulty for your exam (UPSC, RBI Grade B, SSC…), writes an exam tip and 2 sentences for every word, and reads
handwriting and idioms far better than the free dictionaries. The app picks the best free Flash model automatically.
If Flash hits its daily limit it switches to Flash-Lite, which has a bigger allowance. Note: Google may use free-tier
inputs to improve its products, which is fine for textbook pages but not for personal documents.

**Several Gemini keys:** in Settings you can add more than one key. They're tried in order. A key that hits its
limit rests for 10 minutes while the next key takes over, and an invalid key is skipped. Each key's status (ready /
limit reached / invalid) is shown next to it.

**Optional, paid backup: Claude AI.** Add an API key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
to use Claude whenever Gemini fails or runs out. A dense page costs roughly US$0.10–0.25 with Opus 5.5, about half with
Sonnet 5.5, and much less with Haiku 4.5.

**Automatic fallback:** Gemini (free) → Claude (if a key is set) → free dictionaries. A short message tells you when the
app switched and why. Keys are stored only on your device.

## Setup

### 1. Put it online (free, GitHub Pages)

1. On GitHub, open this repo's **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
2. Merge this code into `main`. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes the app to
   **https://rlm1711204.github.io/vocab-vault/**.
3. On your phone, open that link in Chrome, tap **⋮ → Add to Home screen**, and it opens like a normal app.

### 2. Google Drive setup (one time, about 5 minutes)

Google requires every app that saves to Drive to have its own OAuth Client ID:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a project (e.g. *VocabVault*).
2. **APIs & Services → Library**: search **Google Drive API** and click **Enable**.
3. **Google Auth Platform** (called *OAuth consent screen* in older versions): click **Get started**. Choose app name *VocabVault*,
   your email, audience **External**. Under **Audience → Test users**, add your own Gmail address.
   *Already set up a Client ID for another app on `rlm1711204.github.io` (e.g. your expense tracker)? You can reuse it:
   it's the same site origin, so skip to step 5.*
4. **Clients → Create client**: choose type **Web application**. Under **Authorised JavaScript origins**, add
   - `https://rlm1711204.github.io`
   - `http://localhost:5173` (only needed if you run it on a computer)
5. Copy the **Client ID** (`…apps.googleusercontent.com`) and paste it into **Settings → Google Drive** in the app,
   then tap **Connect & sync**.
   *(Optional: to avoid pasting it on every device, add it as a repository variable named `GOOGLE_CLIENT_ID`
   under repo **Settings → Secrets and variables → Actions → Variables**, then re-run the deploy.)*

The app only asks for the `drive.file` permission, so it can see **only the files it created**, not the rest of your Drive.
Google shows an "unverified app" warning because this is your personal app: click **Advanced → Go to VocabVault**.

### 3. Run locally (optional, for development)

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (duplicate detection, spaced repetition, difficulty filter)
npm run build    # production build in dist/
```

## How it works

```
src/
  main.js            UI: Today, Add, Quiz, Words, Settings
  lib/freedict.js    Free word cards: dictionaryapi.dev + Wiktionary + MyMemory, IPA -> easy respelling
  lib/engine.js      Provider order and automatic fallback: Gemini -> Claude -> free dictionaries
  lib/gemini.js      Google Gemini (free tier): model auto-pick, structured JSON cards
  lib/ai.js          Claude API + the prompts/card schema shared by both AI providers
  lib/extract.js     Image downscaling, PDF text layer (pdf.js), on-device OCR (Tesseract) for offline mode
  lib/difficulty.js  Offline difficulty filter using SCOWL word-frequency levels
  lib/words.js       Word records, duplicate/inflection detection, merge logic, CSV
  lib/srs.js         Spaced repetition (Leitner boxes), daily plan, streaks
  lib/store.js       Local storage (offline-first)
  lib/drive.js       Google Drive sync (JSON + Google Sheet mirror)
```

* **Sync** merges word by word: the most recently edited copy of each word wins, and deletions sync too.
  This means you can study on your phone and add words on your laptop.
* In AI mode, the words already in your list are sent along with the page so Claude skips them. The app also removes
  duplicates on your device before adding anything.

Word-frequency data: [SCOWL](http://wordlist.aspell.net/) © Kevin Atkinson (permissive licence).
