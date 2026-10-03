# VocabVault 📘📗🌍🔢🧩: exam vocabulary, grammar rules, GK, maths and reasoning

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
| 📚 **Built-in Word Bank** | 1267 exam words, idioms and one-word substitutions with Hindi, synonyms, antonyms and an example, kept separate from your own list (copy any word into your list with one tap) |
| 🔀 **Choose your source** | Today's words and Practice can use **My words**, the **Word Bank** or **Mixed** |
| 🔔 **Daily notification** | "Your 2 words for today", rotating through every word of the chosen source (Chrome on Android, app installed to the home screen) |
| 🃏 **Flashcards** | Forgot / Hard / Knew it / Easy. Words come back after 1 → 3 → 7 → 14 → 30 → 60 days |
| 🎯 **Practice** | Word → meaning, Word → Hindi, Meaning → word, fill in the blank, synonyms, antonyms. Every word is asked once per round before any repeats; wrong answers come back a few questions later and in later sessions until answered right twice in a row |
| ☁️ **Google Drive** | `VocabVault/vocab-master.json` (the app's data) plus a **"Vocab Master List" Google Sheet** you can open, filter or print. Syncs across phone and laptop |
| 🔁 **Nothing left out** | Practice remembers how many times each word, rule and question has been asked — across topics, levels and sources — and always asks the least-practised ones first. A practice answer also counts as revision: a wrong answer comes back tomorrow, a right answer on a due item ticks it off Today |
| 📤 **Extras** | Share the Word of the Day to WhatsApp, 🔥 streak counter, CSV export for Excel, backup/restore, dark mode, works offline |

## 📗 Grammar Rules (the second part)

Open the app and choose **📘 Vocabulary** or **📗 Grammar Rules** (switch any time with the buttons at the top).
Grammar works like vocabulary, but for rules:

| | |
|---|---|
| 📷 **Add rules** | Scan a grammar book page, upload screenshots/PDFs, or type notes. With AI, every rule becomes a full card; without AI, your text is split into rules and matched with the Rule Book, which lends its examples and questions |
| 🗂️ **Rule card** | The rule in simple words, a one-line Hindi summary, correct examples, common mistakes (✗ wrong → ✓ right, with why), exceptions and an exam tip |
| 📗 **Built-in Rule Book** | 164 exam rules in 17 topics (subject–verb agreement, articles, tenses, prepositions, narration, voice, conditionals…), each with a common mistake and 2 questions, and most with an **exception note**. **59 are advanced, RBI Grade B–level rules** (inversion, 'whoever/whomever', mixed and inverted conditionals, 'comprise', 'due to' vs 'owing to', subjunctive phrases…). Choose **All / Basic / Advanced** for Today and Practice. Written in plain text you can extend — see [CUSTOMISE.md](CUSTOMISE.md) |
| ☀️ **Today** | Rule of the Day and N rules to revise, with spaced repetition (rules you forget come back tomorrow) |
| 🎯 **Practice** | Fill the blank · Which sentence is correct? · Right or wrong? (error spotting) · Which rule does this break? · Recall the rule. Every rule is covered before any repeats; wrong answers come back until right twice in a row |
| 🔁 **No duplicates** | A rule you already have is recognised even when it is worded differently |
| 💾 **Separate data** | Grammar has its own backup file and its own Google Drive file (`grammar-rules.json` + a "Grammar Rules" sheet). A vocabulary backup can't be restored into grammar by mistake, or the other way round |

## 🌍 GK (the third part)

Choose **🌍 GK** on the start screen (or the 🌍 button at the top). It works like the other two parts, for
general-knowledge questions:

| | |
|---|---|
| 📷 **Add questions** | Scan a quiz book or newspaper page, upload screenshots or a monthly current-affairs PDF, or paste questions. Understood formats: numbered MCQs with `(a) … (d)` and `Ans: (b)`, `Q: … A: …`, `Capital of Japan - Tokyo`, `Who wrote Godan? Premchand`, and plain facts/news (with AI these become questions). `Explanation:` and `Trick:` lines are kept |
| 💡 **Questions on a topic** | Write a topic, a range or one sentence ("Articles 124 to 147", "Harappan civilisation", "Nobel Prizes 2025") and choose how many (Auto covers everything). With AI the app first lists every point to cover — **every Article of a range** — then writes the questions. Or tap **📋 Copy prompt**, paste it into Gemini or ChatGPT, and paste their whole answer back: every question is read with its topic, options, explanation and trick (no API key needed) |
| 💬 **Photo / PDF → Gemini app** | Pick a class slide, book page or PDF and get a ready prompt that asks for a question on **every fact** in it (every table row, everything circled or underlined) plus optional related questions. On Android, **Share photo + prompt** sends both to the Gemini app in one go; otherwise copy the prompt and attach the photo yourself. Paste the app's answer back and the questions are read with topic, options, explanation and trick. After a normal upload, "Missed some facts?" offers the same route |
| 🗂️ **Filed automatically** | Every question goes under a subject and chapter: History (Ancient, Medieval, Modern, World, Art & Culture), Polity, Economy, Banking & Finance, Geography, Biology, Physics, Chemistry, Science & Tech and **Static GK** (Books & Authors, Awards, Sports, Important Days, National Symbols, Firsts, Organisations & HQs, Countries/Capitals/Currencies, Personalities, Abbreviations, Indian States). **Current affairs are filed by year, then topic** (National, International, Economy, Banking, Schemes, Sports, Appointments, Reports & Indices, Defence…). You can change the topic on the review screen |
| 💡 **Memory tricks** | With AI, each question gets 3 believable wrong options, a 1–2 line explanation and a mnemonic/trick. Answers the AI had to fill in are marked **"AI answer · check"** |
| 🌍 **Built-in Question Bank** | 311 stable static-GK and subject questions in 58 chapters, each with a memory trick. Current affairs are not built in (they change too fast); add them from your PDFs |
| ☀️ **Today** | Question of the Day + N questions, **spread across topics**: due revisions first, then new questions taking turns between chapters, starting with the chapters you have not revised for longest. A "Not revised for a while" card lists the stalest chapters with a one-tap practice button |
| 🎯 **Practice** | Multiple choice, True or false, Recall (and fill-the-gap for facts). **Untick any subject, chapter or Current Affairs year** (optionally for Today too). Every selected question is asked once per round before any repeats, chapters are interleaved, and wrong answers come back until right twice in a row |
| 🗺️ **Topics (coverage map)** | Subject → chapter (Current Affairs → year → topic) with how much of each was covered this round, mastered, weak and due. Search, edit, star, "Complete with AI", practise one chapter, CSV export |
| 💾 **Separate data** | Own backup file and own Drive file (`gk-questions.json` + a "GK Questions" sheet). Restoring twice never duplicates |

## 🔢 Maths and 🧩 Reasoning (two separate parts)

Maths and Reasoning are two parts of their own — each with its own Today, Add, Practice and Topics, its own Formula Book cards, backup and Google Drive file. Anything added in one part that belongs to the other (a syllogism in your maths notes) is saved in the other part automatically.

| | |
|---|---|
| 📷 **Add** | Scan a page, upload photos or a **handwritten scanned PDF**, type or paste. With AI every question is solved step by step and every formula, rule or shortcut becomes a card. Without a key: **💬 Photo / PDF → Gemini app** gives a ready prompt (Android can share the file and the prompt together); paste the app's answer back |
| 🗂️ **Filed by topic and type** | Quant (Number System, Percentage, Profit & Loss, SI/CI, Time & Work, TSD, Mensuration, Algebra, DI, P&C…) and Reasoning (Puzzles, Seating, Syllogism, Inequality, Blood Relations, Direction, Coding-Decoding, Calendar, Clocks…). Every question also gets a **question type** (e.g. "Two workers together"); new names are matched to the types you already have |
| 🔁 **2 practice questions** | While saving, each question gets 2 practice questions of the same type with changed numbers or a small twist, linked to it. Later: "＋2 practice questions" (AI) or "Prompt for 2 more" (chat app) on any question |
| 📐 **Formula Book** | 99 built-in cards with worked examples (Maths formulas and shortcuts, Reasoning rules and tricks). Each topic page shows its **formula sheet** to revise |
| 📐 **Figures** | Geometry, mensuration and trigonometry questions and formulas are saved **with their figure**: **the book's own figure**, cut out of your scanned page or PDF (the AI only says where the figure is; ✂️ lets you adjust the box), or an **exact drawing**: the AI only describes the construction in `DRAW:` lines ("circle O r=5", "tangents T from P to O", "right O T P") and the app computes every point itself, so tangents really touch, bisectors really bisect and lengths are in proportion. A description with any mistake is retried once and otherwise not shown — a wrong figure is never saved. Saved cards can get one later (🤖 Draw exactly, 📋 Prompt for a figure, 📷 book's figure with the crop tool); older AI drawings are marked "may be inaccurate". The Formula Book has 26 named theorems with hand-drawn figures (Pythagoras, centroid / incentre / circumcentre / orthocentre, BPT, angle bisector, tangent–radius, alternate segment, cyclic quadrilateral, chords, tangent–secant, Heron, sector, cylinder, cone, sphere, trigonometric ratios, heights & distances) |
| 🧩 **Same-type practice** | Practise one question type at a time (each question, then its practice questions), or a whole topic, or formulas only (recall / "which formula?"). Multiple choice and "solve on paper, then check the steps" |
| ☀️ **Today** | Formula / Question of the Day and a daily revision spread across topics, with spaced repetition |
| 💾 **Separate data** | Maths: `maths-notes.json` + a "Maths" sheet; Reasoning: `reasoning-notes.json` + a "Reasoning" sheet. Each part has its own backup file |

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
handwriting and idioms far better than the free dictionaries. The app picks the newest free Flash model automatically.
When Google retires a model for your account it moves to the replacement Google suggests and stops trying the old one.
If Flash hits its daily limit it switches to Flash-Lite, which has a bigger allowance. Note: Google may use free-tier
inputs to improve its products, which is fine for textbook pages but not for personal documents.

**Several Gemini keys:** in Settings you can add more than one key. They're tried in order. A key that hits its
limit rests for 10 minutes while the next key takes over, and an invalid key is skipped. Each key's status (ready /
limit reached / invalid) is shown next to it.
To use one particular key, pick it under **🔑 Gemini key for scanning & adding** on the Add screen (or in Settings).
Only that key is used until you switch back to **Auto**.

**More free AI services.** In **Settings → More free AI services** you can add free keys from
[OpenRouter](https://openrouter.ai/keys), [Groq](https://console.groq.com/keys), [Mistral](https://console.mistral.ai/api-keys),
[Cerebras](https://cloud.cerebras.ai) or any OpenAI-compatible service. Each key is tested when you add it. They're used after
Gemini, and each service picks its own best free model from its live model list, so new models are picked up without an
app update. On the Add screen, **🔑 AI for scanning & adding** lets you use one of them (or one Gemini key) on its own.

**Optional, paid backup: Claude AI.** Add an API key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
to use Claude whenever Gemini fails or runs out. A dense page costs roughly US$0.10–0.25 with Opus 5.5, about half with
Sonnet 5.5, and much less with Haiku 4.5.

**Automatic fallback:** Gemini (free) → other free services you added → Claude (if a key is set) → free dictionaries. A short message tells you when the
app switched and why. Keys are stored only on your device.

## Make it yours

The app name, colour, icon and a **“Made by …”** credit all come from one small file, `src/brand.js`,
which you can edit from your phone on GitHub. Step-by-step: [**CUSTOMISE.md**](CUSTOMISE.md).

## Setup

### 1. Put it online (free, GitHub Pages)

1. On GitHub, open this repo's **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
2. Merge this code into `main`. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes the app to
   **https://rlm1711204.github.io/vocab-vault/**.
3. On your phone, open that link **in Chrome** and tap **📲 Install** on the banner on Today (or in **Settings → Install on your phone**).
   If there's no Install button, tap **⋮ → Add to Home screen → Install**. A link opened from another app (WhatsApp, Claude…)
   opens in a mini-browser that can't install: tap **⋮ → Open in Chrome** first.

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
  lib/compat.js      Other free AI services (OpenRouter, Groq, Mistral, Cerebras, OpenAI-compatible)
  grammar-ui.js      Grammar screens: Today, Add, Practice, Rules, rule card, editor, backups
  lib/grammar-store.js Grammar data (separate storage, backup and Drive file), daily plan
  lib/grammar-ai.js  Grammar prompts: read rules from material, then write full rule cards
  lib/grammar-quiz.js Grammar question types, built from each rule's own examples and mistakes
  gk-ui.js           GK screens: Today, Add, Practice (topic picker), Topics (coverage map), editor, backups
  lib/gk-taxonomy.js GK subjects/chapters/Current Affairs topics + the offline classifier
  lib/gk.js          GK question records, duplicate detection, free-mode text parsing, CSV
  lib/gk-store.js    GK data (separate storage, backup, Drive file), topic-balanced daily plan
  lib/gk-topics.js   Topic tree and tick/untick logic for practice
  lib/gk-quiz.js     GK question types (MCQ, true/false, recall, fill-the-gap)
  lib/gk-ai.js       GK prompts: list questions, then write cards with topic, year, options and a trick
  lib/gkbank.js      Question Bank parser + checker (data in src/data/gk1-4.js)
  quant-ui.js        Maths and Reasoning screens (one module, two instances: prefix m- and r-)
  lib/quant-taxonomy.js Subjects/topics + offline classifier · lib/mathtext.js LaTeX → plain maths
  lib/quant.js       Question / formula records (type, solution, practice links), duplicates, CSV
  lib/quant-prompt.js Copy-paste prompts and the reader for pasted answers (TYPE/Q/PQ/S/F/T/FORMULA lines)
  lib/quant-store.js createQuantStore: one store per part (data, backup, Drive, plan, same-type lists, hand-over)
  lib/quant-stores.js The two instances: maths and reasoning
  lib/quant-ai.js    AI: read notes/handwritten PDFs, solve, add 2 practice questions, topic sets
  lib/quant-quiz.js  MCQ, solve & check, formula recall · lib/qbook.js Formula Book (data in src/data/qformulas.js)
  lib/rules.js       Rule records, duplicate detection, Rule Book matching, free-mode text splitting
  lib/rulebook.js    Rule Book parser + checker (data in src/data/rules1-5.js; 4-5 are the advanced rules)
  lib/update.js      Reloads an open app into the newest version, keeping typed words
  lib/ai.js          Claude API + the prompts/card schema shared by both AI providers
  lib/extract.js     Image downscaling, PDF text layer (pdf.js), on-device OCR (Tesseract) for offline mode
  lib/difficulty.js  Offline difficulty filter using SCOWL word-frequency levels
  lib/words.js       Word records, duplicate/inflection detection, merge logic, CSV
  lib/srs.js         Spaced repetition (Leitner boxes), daily plan, streaks
  lib/practice.js    Practice rounds (cover every word) and weak-word repetition
  lib/bank.js        Built-in Word Bank loader (data in src/data/bank1-6.js)
  lib/notify.js      Daily 2-word notification schedule (shown by public/sw.js)
  lib/install.js     "Install app" button (Chrome's install prompt) and manual install steps
  lib/theme.js       Turns the one brand colour into light/dark shades
  brand.js           ← the app name, colour, icon and your credit (see CUSTOMISE.md)
  lib/store.js       Local storage (offline-first)
  lib/drive.js       Google Drive sync (JSON + Google Sheet mirror)
```

The app icon (`public/icon.svg`, `icon-192.png`, `icon-512.png`) and `public/manifest.webmanifest`
are generated from `src/brand.js` by `scripts/brand-build.mjs` every time the app is built.

* **Sync** merges word by word: the most recently edited copy of each word wins, and deletions sync too.
  This means you can study on your phone and add words on your laptop.
* In AI mode, the words already in your list are sent along with the page so Claude skips them. The app also removes
  duplicates on your device before adding anything.

Word-frequency data: [SCOWL](http://wordlist.aspell.net/) © Kevin Atkinson (permissive licence).
