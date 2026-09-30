# VocabVault 📘: exam vocabulary builder

A phone-friendly web app (you can install it like an app) for building an exam-grade English vocabulary.
Snap a page, upload a screenshot or PDF, or type words. VocabVault keeps only the **difficult** words
and turns each one into a full word card. The cards go into a **master list saved in your Google Drive**.
Every day you get a **Word of the Day** plus **10 words to memorise** (you can change the number), scheduled with spaced repetition.

## What it does

| | |
|---|---|
| 📷 **Capture** | Camera scan, screenshots, multi-page PDFs (including scanned ones), or typed/pasted lists |
| 🧠 **Smart filtering** | Easy everyday words are dropped automatically. Claude AI judges difficulty for your exam; offline mode uses a word-frequency list |
| 🔁 **Duplicate check** | Every word is checked against your master list, including forms like *mitigated* ↔ *mitigate*. Duplicates are never added twice |
| 🗂️ **Word card** | Word, part of speech, simple meaning, **Hindi meaning**, optional **Tamil meaning**, IPA + easy pronunciation (*uh-BAYT*) with a 🔊 button, **2 example sentences**, synonyms, antonyms, an **exam tip** (root, mnemonic or confusable word), and the sentence where you found it |
| ☀️ **Daily plan** | Word of the Day (never repeats until all words have been featured) plus N words mixing due reviews and new words |
| 🃏 **Flashcards** | Forgot / Hard / Knew it / Easy. Words come back after 1 → 3 → 7 → 14 → 30 → 60 days |
| 🎯 **Quiz** | Word → meaning, Word → Hindi, Meaning → word (one-word substitution), fill in the blank (cloze), synonyms |
| ☁️ **Google Drive** | `VocabVault/vocab-master.json` (the app's data) plus a **"Vocab Master List" Google Sheet** you can open, filter or print. Syncs across phone and laptop |
| 📤 **Extras** | Share the Word of the Day to WhatsApp, 🔥 streak counter, CSV export for Excel, backup/restore, dark mode, works offline |

## Using it

1. **Settings → Claude AI**: paste your API key from [console.anthropic.com](https://console.anthropic.com/settings/keys).
   Choose your **exam focus** (UPSC, RBI Grade B, SSC, Banking, CAT…) and turn on Tamil meanings if you want them.
2. **Add**: scan or upload a page, or type words. On the review screen, untick anything you already know, then tap **Add**.
3. **Today**: read the Word of the Day, then tap **Start flashcards** for today's set.
4. **Quiz**: take one after revising. Words you get wrong come back in tomorrow's set.

**Without an API key** the app still works in offline mode. It reads text on the device (OCR for photos, the text
layer for PDFs) and keeps words outside the ~10,000 most common English words. You then fill in the meanings yourself,
or add a key later and tap **🤖 Fill missing** on the Words tab.

**Cost of AI mode:** you pay Anthropic directly for your own usage. A dense page with ~30 hard words costs roughly
US$0.10–0.25 (₹8–20) with Opus 5.5 (the default, best quality), and about half that with Sonnet 5.5. Typed word lists cost less.
You can switch the model in Settings.
Your API key is stored only in your browser on that device. The app sends it only to Anthropic.

## Setup

### 1. Put it online (free, GitHub Pages)

1. On GitHub, open this repo's **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
2. Merge this code into `main`. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes the app to
   **https://rlm1711204.github.io/my-cloud-test/**.
3. On your phone, open that link in Chrome, tap **⋮ → Add to Home screen**, and it opens like a normal app.

### 2. Google Drive setup (one time, about 5 minutes)

Google requires every app that saves to Drive to have its own OAuth Client ID:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a project (e.g. *VocabVault*).
2. **APIs & Services → Library**: search **Google Drive API** and click **Enable**.
3. **Google Auth Platform** (called *OAuth consent screen* in older versions): click **Get started**. Choose app name *VocabVault*,
   your email, audience **External**. Under **Audience → Test users**, add your own Gmail address.
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
  lib/ai.js          Claude API: extract hard words from images/PDFs, build word cards (structured JSON output)
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
