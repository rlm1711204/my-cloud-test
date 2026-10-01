# Kaasu — Smart Expense Tracker (Android, free)

Type a few words, like `chai 20` or `salary 55000`, and Kaasu files each entry for you.
You can scan a bill with your camera, keep track of money you gave or took,
see reports, download them, and back everything up to **your own Google Drive**.

- **Cost:** ₹0. No Play Store, no server, no subscription.
- **Works offline:** entries are saved on the phone first.
- **Private:** your data stays on your phone and in your Google Drive. The bill photo is read on the phone and never uploaded.

---

## 1. What you can type

| You type | Kaasu saves |
|---|---|
| `chai 20` | Spent ₹20 · Food · today |
| `petrol 500 upi` | Spent ₹500 · Fuel · paid by UPI |
| `rent 12,000 on 5th` | Spent ₹12,000 · Rent · 5th of this month |
| `lunch 150 yesterday` | Spent ₹150 · Food · yesterday |
| `salary 55000` | Income ₹55,000 · Salary |
| `bonus 10k` / `cashback 50` | Income |
| `sip 5000` / `fd 1 lakh` / `gold 3000` / `ppf 2000` | Saved / invested |
| `gave ravi 2000` / `lent 500 to anu` | Money given (Ravi owes you) |
| `took 500 from kumar` / `borrowed 2k from anand` | Money taken (you owe Kumar) |
| `ravi returned 1000` | Ravi paid you back |
| `paid back kumar 500` | You paid Kumar back |
| `shoes 2500 need` / `headphones 1800 want` | Spent, under the Needs / Wants head you said |
| `gave amma 3000` | Spent · Family (money given to family isn't counted as a loan) |
| `chai 20, auto 60, milk 30` | 3 entries at once |

| `rent 12000 every month on 5th` | 🔁 Monthly auto entry, added by itself every month on the 5th |
| `salary 55000 monthly on 1st` | 🔁 Salary added by itself on the 1st of every month |

- **Dates:** `yesterday`, `2 days ago`, `last monday`, `5/9`, `5 sep`, `on 5th`.
- **Payment mode:** `upi`, `gpay`, `phonepe`, `cash`, `card`, `neft`.
- **Voice:** tap the 🎤 button and say "lunch 150, auto 40".
- **Kaasu learns:** if you change an entry's category, it remembers the description and uses that category next time.

---

## 2. Put it on your phone (one time, about 10 minutes)

The app is a website that installs like a normal app (a "PWA"). GitHub hosts it for free.

### Step A — Turn on free hosting (GitHub Pages)
Do this on a laptop, or on your phone's browser in "Desktop site" mode.

1. Open **https://github.com/rlm1711204/my-cloud-test**.
2. Tap **Settings** (top menu) → **Pages** (left menu).
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under **Branch**, pick **`claude/dreamy-faraday-i7qyrs`**, folder **`/ (root)`**, and tap **Save**.
   *(If you merge this work into `main` later, pick `main` here instead.)*
5. Wait 1–2 minutes and refresh the page. It will say *"Your site is live at …"*.

Your app's address will be:

**https://rlm1711204.github.io/my-cloud-test/expense-tracker/**

### Step B — Install on Android
1. Open that address in **Chrome** on your phone.
2. Tap **⋮** (top right) → **Add to Home screen** → **Install**.
   You may instead see a bar at the bottom offering to **Install**.
3. The **Kaasu** icon is now on your home screen. Open it from there. It runs full screen like any other app.

### Step B (iPhone / iPad)
iPhones don't show an "Install" button. Apple only allows installing web apps through the Share menu.
1. Open the app address in **Safari**. On iOS 16.4 and later, Chrome's Share button also works.
2. Tap the **Share** button (the square with an arrow ↑) in the bottom bar.
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Always open Kaasu from the **new Home Screen icon**. The icon version keeps its own storage, separate from the Safari tab.

Kaasu also shows these steps on its Home screen when opened on an iPhone.

---

## 3. Save your records in Google Drive (one time, about 10 minutes)

Google makes every app get its own free "Client ID" before it can write to your Drive.

1. On a laptop (easier), open **https://console.cloud.google.com** and sign in with your Gmail.
2. Top bar → **Select a project** → **New project** → name it `Kaasu` → **Create**, then select it.
3. Search bar → type **Google Drive API** → open it → **Enable**.
4. Left menu → **Google Auth Platform** (older screens call it **OAuth consent screen**) → **Get started**:
   - App name: `Kaasu`. Support email: your Gmail.
   - Audience: **External**.
   - Contact email: your Gmail → **Create**.
5. **Audience** → **Test users** → **Add users** → add **your own Gmail** → **Save**.
6. **Clients** (or **Credentials**) → **Create client** → Application type **Web application**.
   - Under **Authorised JavaScript origins**, add exactly: `https://rlm1711204.github.io`
   - **For iPhone:** also under **Authorised redirect URIs** add exactly: `https://rlm1711204.github.io/my-cloud-test/expense-tracker/`
     (iPhone home-screen apps can't use Google's pop-up, so Kaasu opens Google's sign-in page and comes back to this address.)
   - Tap **Create**.
7. Copy the **Client ID**. It looks like `1234567890-abc123.apps.googleusercontent.com`.
8. In the Kaasu app, open **Settings → Google Drive backup**, paste the Client ID, tap **Save Client ID**, then **Connect Google Drive**.
9. Google will say *"Google hasn't verified this app"*. That's expected, because it's your own app. Tap **Continue**, then **Allow**.

Kaasu then creates this in your Drive:

```
My Drive/
  Expense Tracker/
    expense-tracker-data.json   ← full data (used for syncing and restoring)
    All records.csv             ← opens in Google Sheets
    Reports/                    ← reports you save from the Reports screen
```

- After each entry, Kaasu saves to Drive a few seconds later.
- The top-right pill shows **Saved**.
- Google sign-in lasts about 1 hour. After that the pill says **Tap to sync**; tap it once and it continues.
- Kaasu uses Google's `drive.file` permission, so it can only see files it created, never your other Drive files.
- **New phone?** Install Kaasu, paste the same Client ID, and tap Connect. Your records come back automatically.

---

## 4. Screens

| Screen | What's there |
|---|---|
| **Home** | Quick-add box (type, 🎤 voice, or 📷 scan). This month's money left, spent, income, saved, budget bar, and recent entries. |
| **History** | Every entry by month, with search ("ravi", "food", "500") and filters. Tap an entry to edit or delete it. |
| **People** | Who owes you and whom you owe. Tap a person to see their history and record a repayment. |
| **Reports** | Month, 3 months, financial year (Apr–Mar) or all time. Spending by category, daily chart, 6-month income/spent/saved chart, payment modes, and insights. Downloads: **Excel (CSV)**, **PDF**, **Save to Google Drive**, **Full backup**. |
| **Settings** | Google Drive, monthly budget, light/dark theme, words Kaasu has learned, backup/restore, erase. |

### Budget plan: Needs 🧱 · Wants 🎈 · Savings 🐷
Kaasu splits your monthly income into three heads. The default is **50 / 30 / 20**. Home shows how much is **left under each head** and how much you can spend per day.

- **Automatic sorting:** every expense goes into a head by its category.
  - **Needs:** rent, groceries, bills, fuel, transport, EMI, health, education, insurance, family, home, tax.
  - **Wants:** eating out, shopping, movies, travel, personal care, gifts.
  - **Savings:** your savings entries (SIP, FD, gold, PPF…).
- **One entry is different?** Add `need` or `want` when typing (`shoes 2500 need`), or open the entry and change **Budget head**.
- **A whole category should switch?** Go to Settings → Budget plan and tap the category (e.g. make *Food* a Need).
- **Change the split:** Settings → Budget plan → **Split**. Choose 50/30/20, 60/20/20, 70/20/10, 40/30/30, 50/20/30, or **Custom** (the three numbers must add up to 100).
- **Plan based on:** this month's income (the default), or a fixed amount you choose. If this month's salary isn't in yet, Kaasu uses your monthly salary auto entry.
- **Carry forward:** the previous month's balance is carried into the next month, **whether positive or negative**. Home always shows the two parts separately, e.g. *"This month ₹66,207 − from Sept ₹35,527"*, and the budget card shows the carried line (green when money was left, red when the month was overspent). You can turn this off in Settings.

### Monthly auto entries 🔁 (rent, EMI, SIP, salary…)
Set these up once, and Kaasu adds them by itself on that day every month. You can do it in any of three ways:
- **Type it:** `rent 12000 every month on 5th`, `sip 5000 monthly on 10th`, `salary 55000 monthly on 1st`.
- **Settings → Monthly auto entries → + Add monthly entry.** Choose the type, amount, category and day.
- **Tick the box:** open any entry and tick **🔁 Repeat every month on this date**.

**Changing things later:**
- **Salary increased?** Go to Settings → Monthly auto entries, tap **Salary**, change the amount, and tap Save. Tick "Also change this month's entry" if you want the current month updated too.
- **Only one month was different?** Tap that month's entry in History and edit it. The other months aren't affected.
- **Pause** by unticking **Active**. **Stop** by tapping **Delete**. Entries that were already added stay in your history.

Auto entries are added when you open the app on or after the due day. If you open it after a few days, any missed months are filled in. They are marked 🔁 in your lists and sync to Google Drive like everything else.

### Reports → By item name
Every entry with the same name is added up, so you can see what one thing costs you over time: **Milk ₹120 (3×, avg ₹40)**, **Gym subscription ₹2,500**, **Sabji ₹210 (2×)**. Small spelling differences are matched automatically (Milk / milk / Milks; Eggs / egg). Search for an item, or tap a row to see every entry behind it.

### Money given to someone, not a loan 🎁
For money you give and won't ask back (helping Manoj, a gift for Dilmaan), add the word **gift** or **no return**:

```
gave manoj 500 gift
gave dilmaan 2000 no return
```

It's saved as a normal **expense** (so it counts in your spending and budget), but it remembers the person. **Reports → 🎁 Spent on people** shows the cumulative total per person, and tapping a name lists every entry.

You can also add a name to any expense: open the entry and fill in **Spent on (optional)**.

Without the word "gift", `gave manoj 500` is still treated as a **loan** and appears on the **People** tab, where you can record repayments.

### Scanning a bill 📷
1. Tap the scan button → **Take photo** (or **Choose from gallery**).
2. Kaasu reads the bill on your phone and fills in the **total**, **date**, **shop name** and **category**. It also shows the **GST** amount and the shop's **GSTIN**.
3. Check the details and tap **Save**.

The first scan needs internet (about 10 MB, downloaded once). For best results, lay the bill flat in good light and fill the screen with it.

### PDF report
**Reports → PDF report** opens the print screen. Choose **Save as PDF** as the printer, then tap the download button.

---

## 5. Common problems

| Problem | Fix |
|---|---|
| GitHub Pages shows 404 | Wait 2 minutes after Step A. Check you picked the right branch. The address must end with `/expense-tracker/`. |
| No "Install" option | Use **Chrome**, not an in-app browser (WhatsApp/Instagram). Open the link directly. |
| Google says `redirect_uri_mismatch` or `origin not allowed` | In Google Cloud → Clients → your client, the JavaScript origin must be exactly `https://rlm1711204.github.io` (no `/my-cloud-test`, no slash at the end). Changes take up to 5 minutes. |
| Google says `access_denied` | Add your Gmail under **Audience → Test users** (Section 3, step 5). |
| Pill says "Tap to sync" | Normal after about an hour. Tap it once. |
| Bill total is wrong | Just correct it before saving. Retake the photo straight on, with less shadow. |
| Voice button doesn't work | Allow the microphone for Chrome, or use the 🎤 on your keyboard. |
| Two phones show different data | Both phones must be connected with the **same Gmail** and the **same Client ID**. Check Settings → Google Drive backup on each phone: it shows the Gmail and the last 6 characters of the Client ID. Then tap **Sync now** on phone A, then phone B, then phone A again. |
| iPhone: Google says `redirect_uri_mismatch` | Add `https://rlm1711204.github.io/my-cloud-test/expense-tracker/` under **Authorised redirect URIs** of your Client ID (Section 3, step 6) and wait 5 minutes. |
| iPhone: no "Add to Home Screen" | Use **Safari** (or Chrome on iOS 16.4+) → Share → scroll down. In-app browsers (WhatsApp, Instagram) don't show it: open the link in Safari first. |
| Changed phones or cleared Chrome data | If Drive was connected, reconnect and your data returns. Otherwise use **Settings → Restore from file** with a downloaded backup. |

**Tip:** once a month, tap **Settings → Download backup** as an extra safety copy.

---

## 6. For the curious — how it's built

Plain HTML, CSS and JavaScript. There's no build step and nothing to install on a computer.

```
expense-tracker/
  index.html            the screens
  css/styles.css        design (light + dark)
  js/parser.js          understands "chai 20", "gave ravi 2000", and bill text
  js/store.js           saves entries on the phone, does the maths, CSV export
  js/charts.js          charts (no libraries)
  js/ocr.js             reads bills (Tesseract.js, runs on the phone)
  js/drive.js           Google Drive sync
  js/app.js             connects everything
  sw.js                 lets it open offline
  manifest.webmanifest  makes it installable
  tests/                run: node expense-tracker/tests/parser.test.js
```

To add your own keywords, open `js/parser.js` and add words to the category lists at the top.
For example, add `'kumar mess'` to **Food**.
