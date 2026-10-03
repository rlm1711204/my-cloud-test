# Make it yours ✏️

Everything you can change by yourself — the app name, the colour, the icon and your own
"Made by" credit — lives in **one file**: `src/brand.js`.

You can edit it from your phone. No computer, no coding, nothing to install.
After you save, the app rebuilds itself and the live app updates in about **2 minutes**.

---

## The 6 steps (works on a phone)

1. Open **github.com/rlm1711204/vocab-vault** in Chrome and sign in.
2. Tap **src** → **brand.js**.
3. Tap the **✏️ pencil** at the top right.
4. Change the words **between the "quote marks"**. Keep the quote marks and the commas.
5. Scroll down, tap **Commit changes** → **Commit changes** again.
6. Wait ~2 minutes, then open the app and **pull down to refresh**. If you installed it on
   your home screen, close it fully and reopen it.

> Only ever change the text **inside the quote marks**. If you delete a quote mark or a comma,
> the build fails and the live app simply stays as it was — nothing breaks. To fix it, edit the
> file again (step 3) or see **Undo** at the bottom.

---

## What you can change

| In `src/brand.js` | What it changes |
|---|---|
| `name` | The name at the top of every screen, the browser tab, the install card |
| `shortName` | The name under the icon on your home screen — keep it under 12 letters |
| `tagline` | The one line on the welcome screen and under the icon when installing |
| `madeBy` | Your name. Shows as **"Made by Ram"** at the bottom of Today and in Settings → About. Leave `""` to hide it |
| `madeByNote` | A small second line, e.g. `"IIT Madras '22"` |
| `madeByLink` | Optional link on your name, e.g. your GitHub or LinkedIn |
| `color` | The main colour of the whole app **and** the icon |
| `accent` | The small star colour on the icon |
| `iconStyle` | `"book"` = the open-book picture · `"letters"` = your own letters on a coloured square |
| `iconLetters` | 1 or 2 letters for the `"letters"` style, e.g. `"R"` or `"RV"` |

### Example — your own name, your own colour, your own icon

```js
export const brand = {
  name: "RamVocab",
  shortName: "RamVocab",
  tagline: "Exam vocabulary, built one page at a time.",
  madeBy: "Ram",
  madeByNote: "IIT Madras '22",
  madeByLink: "https://github.com/rlm1711204",
  color: "#0f766e",
  accent: "#f59e0b",
  iconStyle: "letters",
  iconLetters: "RV",
};
```

That alone changes the app name everywhere, the home-screen name, the colour of every button,
the app icon (a teal square with **RV** on it) and adds **Made by Ram · IIT Madras '22**.

### Picking a colour

Open [htmlcolorcodes.com](https://htmlcolorcodes.com), pick a colour and copy the `#` code.
Dark shades look best — the app lightens the colour by itself for dark mode.

Some ready ones: `#4338ca` indigo · `#0f766e` teal · `#b91c1c` red · `#7c3aed` purple ·
`#b45309` saffron · `#1d4ed8` blue · `#166534` green.

---

## Using your own picture as the icon

The `"letters"` and `"book"` styles are drawn for you. To use a **photo or logo** instead:

1. Make two square PNG images, **192×192** and **512×512** pixels.
   (Any phone photo editor can crop to a square and resize.)
2. On GitHub open the **public** folder.
3. Tap **Add file → Upload files**, upload both, and name them exactly
   `icon-192.png` and `icon-512.png` so they replace the old ones.
4. Commit. Then set `iconStyle` to `"letters"` or `"book"` — whichever you keep, your uploaded
   PNGs are what the phone shows on the home screen.

Keep the important part in the **middle 80%** of the image: Android crops icons into a circle.

After changing the icon, remove the app from your home screen and install it again — Android
keeps the old icon otherwise.

---

## Adding rules to the built-in Rule Book

The Rule Book lives in five plain-text files: `src/data/rules1.js` to `rules5.js` (4 and 5 are the advanced rules).
Open one on GitHub, tap the ✏️ pencil, and add a rule anywhere between the two back-ticks, like this:

```
# 'Amount' and 'number'
R: Use 'amount' with things you cannot count and 'number' with things you can count.
N: 'A large amount of money' but 'a large number of notes' — money is uncountable, notes are countable.
E: A large number of people attended the rally.
X: A large amount of students failed. => A large number of students failed.
W: Students can be counted, so 'number'.
T: Asked in RBI and SSC error spotting.
Q: The bank received a huge ___ of applications. | *number; amount; deal; quantity
D: 4
```

| Letter | Means |
|---|---|
| `## Topic` | starts a new topic (e.g. `## Prepositions`) |
| `# Title` | starts a new rule |
| `R:` | the rule in simple words |
| `E:` | a correct example (add as many as you like) |
| `X:` | a mistake: `wrong sentence => right sentence` |
| `W:` | why (explains the `X:` line just above it) |
| `N:` | an exception or note |
| `T:` | an exam tip |
| `D:` | the level, 1–5 (optional). `D: 4` or `D: 5` marks the rule as **advanced** (RBI Grade B level), so it appears under the Advanced level filter |
| `Q:` | a question: `question with ___ | option; *right option; option` — put `*` before the one right answer |

Only `#` and `R:` are required; the rest are optional but make practice better (`X:` lines power the
"Right or wrong?" and "Which rule?" questions, `Q:` lines the "Fill the blank" ones).

Every build checks the Rule Book. If a line is wrong (for example a question with no `*`), the build stops and
the live app keeps the last good version, so a typing mistake can never break your app.

## Changing the words inside the app

Any sentence you see in the app can be changed in `src/main.js`. Use GitHub's search
(the 🔍 at the top of the repo) to find the exact sentence, then tap the pencil and edit it.
Change only the text between the quote marks or between `>` and `<`.

---

## Undo

Every change is saved separately, so you can always go back:

1. On GitHub, open **src/brand.js**.
2. Tap **History** (the clock icon).
3. Open the version from before your change, tap **⋯ → View file**, copy what it said, and
   paste it back.

Or just edit the file again and retype the old words.

---

## Check that it worked

- Open the app → **Settings** → scroll to the bottom. The **About** card shows the name,
  your credit, and the **version**.
- The version ends with a short code (e.g. `a1b2c3d`). After a change it should match the
  newest commit on GitHub. If it doesn't, the build is still running — wait a minute and
  reload.
- The build status is at **github.com/rlm1711204/vocab-vault/actions**. A green ✓ means the
  live app has your change; a red ✗ means a quote mark or comma is missing in `brand.js`
  (the live app keeps working on the last good version).

---

## Adding questions to the built-in GK Question Bank

The Question Bank is in `src/data/gk1.js` (Polity, History), `gk2.js` (Geography, Economy, Banking), `gk3.js`
(Biology, Physics, Chemistry, Science & Tech) and `gk4.js` (Static GK). Add a question between the back-ticks:

```
## Static GK › Books & Authors
Q: Who wrote 'Godan'?
A: Munshi Premchand
O: Rabindranath Tagore; Sarat Chandra Chattopadhyay; Bankim Chandra Chatterjee
T: Go-dan = "gift of a cow" — Premchand's village farmer Hori dreams of one.
E: Premchand's last completed novel (1936).
```

| Letter | Means |
|---|---|
| `## Subject › Chapter` | the chapter the questions below belong to (copy the exact names used in the file or in `src/lib/gk-taxonomy.js`) |
| `Q:` | the question |
| `A:` | the right answer |
| `O:` | exactly 3 wrong options, separated by `;` |
| `T:` | the memory trick |
| `E:` | an explanation (optional) |

Keep to facts that don't change (no current office-holders). The tests check every question when the app is built.
Your own questions are better added in the app itself (🌍 GK → Add).

---

## Adding cards to the Maths and Reasoning Formula Book

The Formula Book is `src/data/qformulas.js`. Add a card between the back-ticks:

```
## Quant › Percentage
FORMULA: Percentage of a percentage
F: x% of y% of N = (x × y × N)/10000
T: Multiply the percentages, divide by 100 twice.
E: 20% of 50% of 400 = 40.
```

| Letter | Means |
|---|---|
| `## Subject › Topic` | Quant or Reasoning, and a topic name from `src/lib/quant-taxonomy.js` |
| `FORMULA:` | the card's name |
| `F:` | the formula or rule (several `F:` lines are fine) |
| `T:` | the trick — how to remember or use it fast |
| `E:` | one small worked example |
| `DRAW:` | optional, best for a figure: one construction step per line, no coordinates — the app computes the geometry exactly, e.g. `DRAW: circle O r=5`, `DRAW: point P outside O dist=13`, `DRAW: tangents T from P to O`, `DRAW: right O T P`, `DRAW: label O P "13"`. The full command list is `DRAW_GUIDE` in `src/lib/geodraw.js`; a figure with any mistake is not shown |
| `FIG:` | optional: a figure as SVG on one line, e.g. `FIG: <svg viewBox="0 0 240 160">…</svg>` — use `stroke="currentColor"` and `fill="none"` so it works in dark mode, and `class="hl"` on the part to highlight |

Use plain-text maths (×, ÷, √, ², π, a/b). The tests check every card when the app is built.
