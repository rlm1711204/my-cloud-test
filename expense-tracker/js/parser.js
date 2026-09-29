/* =====================================================================
 * parser.js — turns short keyword notes into organised records.
 *
 *   "chai 20"                 -> Expense · Food · ₹20 · today
 *   "petrol 500 upi"          -> Expense · Fuel · ₹500 · UPI
 *   "salary 55000"            -> Income  · Salary
 *   "gave ravi 2000"          -> Lent to Ravi (Ravi owes you)
 *   "took 500 from kumar"     -> Borrowed from Kumar (you owe Kumar)
 *   "ravi returned 1000"      -> Ravi paid you back
 *   "paid back kumar 500"     -> You paid Kumar back
 *   "sip 5000"                -> Saving · SIP / Mutual fund
 *   "lunch 150 yesterday"     -> dated yesterday
 *   "chai 20, auto 60, milk 30" -> three records at once
 *
 * It also reads the text of a scanned bill (parseBill).
 * Pure functions only: no screen code here, so it can be tested in Node.
 * ===================================================================== */
(function (root) {
  'use strict';

  /* ---------- Categories ------------------------------------------------
   * Each keyword list is lowercase. Multi-word keywords are matched first.
   * "hotel" is Food on purpose — in Tamil Nadu a hotel is a restaurant.   */
  const EXPENSE_CATEGORIES = {
    'Food':          { icon: '🍽️', words: ['chai', 'tea', 'coffee', 'lunch', 'dinner', 'breakfast', 'snack', 'snacks', 'food', 'meal', 'meals', 'biryani', 'briyani', 'dosa', 'idli', 'idly', 'parotta', 'porotta', 'vada', 'pongal', 'burger', 'pizza', 'restaurant', 'hotel', 'canteen', 'mess', 'tiffin', 'swiggy', 'zomato', 'juice', 'sweets', 'sweet', 'bakery', 'cake', 'ice cream', 'icecream', 'samosa', 'saapadu', 'sapadu', 'shawarma', 'kfc', 'dominos', 'mcdonalds', 'cafe', 'starbucks', 'tea shop', 'kaapi', 'fried rice', 'noodles', 'chicken', 'mutton', 'fish', 'egg puff', 'puff'] },
    'Groceries':     { icon: '🛒', words: ['grocery', 'groceries', 'vegetables', 'vegetable', 'veggies', 'sabzi', 'fruits', 'fruit', 'milk', 'doodh', 'paal', 'rice', 'dal', 'atta', 'oil', 'sugar', 'eggs', 'bread', 'kirana', 'dmart', 'd mart', 'bigbasket', 'big basket', 'blinkit', 'zepto', 'instamart', 'supermarket', 'provisions', 'provision', 'maligai', 'onion', 'onions', 'tomato', 'curd', 'thayir', 'banana', 'coconut'] },
    'Transport':     { icon: '🛺', words: ['auto', 'cab', 'taxi', 'uber', 'ola', 'rapido', 'bus', 'train', 'metro', 'parking', 'toll', 'fastag', 'share auto', 'bike service', 'car service', 'puncture', 'bus pass', 'train ticket', 'bus ticket'] },
    'Fuel':          { icon: '⛽', words: ['petrol', 'diesel', 'fuel', 'cng', 'indian oil', 'bpcl', 'iocl', 'hpcl', 'bharat petroleum', 'petroleum', 'filling station'] },
    'Bills':         { icon: '💡', words: ['electricity', 'eb bill', 'eb', 'current bill', 'power bill', 'water bill', 'wifi', 'broadband', 'internet', 'recharge', 'mobile bill', 'phone bill', 'mobile recharge', 'jio', 'airtel', 'bsnl', 'dth', 'tata play', 'gas cylinder', 'cylinder', 'lpg', 'gas bill', 'maintenance', 'bill'] },
    'Rent':          { icon: '🏠', words: ['rent', 'house rent', 'room rent', 'pg', 'hostel', 'advance'] },
    'Shopping':      { icon: '🛍️', words: ['shopping', 'clothes', 'dress', 'shirt', 'pant', 'pants', 'jeans', 'tshirt', 't-shirt', 'saree', 'shoes', 'shoe', 'chappal', 'slippers', 'amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'watch', 'bag', 'electronics', 'headphones', 'earphones', 'charger', 'gadget', 'mobile phone', 'laptop'] },
    'Health':        { icon: '💊', words: ['medicine', 'medicines', 'medical', 'pharmacy', 'doctor', 'hospital', 'clinic', 'tablet', 'tablets', 'apollo', 'lab test', 'blood test', 'scan', 'dental', 'dentist', 'checkup', 'check up', 'gym', 'yoga', 'protein', 'spectacles', 'glasses'] },
    'Education':     { icon: '📚', words: ['book', 'books', 'course', 'fees', 'fee', 'tuition', 'exam', 'coaching', 'udemy', 'coursera', 'testbook', 'unacademy', 'stationery', 'pen', 'notebook', 'upsc', 'rbi', 'ssc', 'tnpsc', 'form fee', 'application fee', 'newspaper', 'the hindu', 'magazine', 'school', 'college', 'test series'] },
    'Entertainment': { icon: '🎬', words: ['movie', 'movies', 'cinema', 'film', 'netflix', 'prime', 'hotstar', 'jiohotstar', 'spotify', 'youtube premium', 'subscription', 'game', 'games', 'pvr', 'inox', 'outing', 'party', 'concert', 'cricket match'] },
    'Travel':        { icon: '✈️', words: ['trip', 'flight', 'irctc', 'tour', 'lodge', 'holiday', 'vacation', 'room booking', 'hotel booking', 'makemytrip', 'redbus', 'ticket', 'tickets'] },
    'Personal care': { icon: '💈', words: ['haircut', 'hair cut', 'salon', 'saloon', 'barber', 'parlour', 'parlor', 'cosmetics', 'soap', 'shampoo', 'toothpaste', 'perfume', 'deo', 'grooming'] },
    'Home':          { icon: '🧰', words: ['furniture', 'repair', 'plumber', 'electrician', 'maid', 'servant', 'cleaning', 'utensils', 'appliance', 'laundry', 'ironing', 'iron', 'dhobi', 'bulb', 'fan', 'mixie', 'bedsheet', 'pillow', 'bucket'] },
    'Family':        { icon: '👨‍👩‍👧', words: ['family', 'parents', 'amma', 'appa', 'mom', 'dad', 'mother', 'father', 'wife', 'husband', 'kids', 'son', 'daughter', 'sister', 'brother', 'home send', 'sent home'] },
    'Gifts':         { icon: '🎁', words: ['gift', 'gifts', 'donation', 'donate', 'temple', 'church', 'mosque', 'dargah', 'charity', 'moi', 'wedding gift', 'function', 'birthday', 'hundi', 'offering'] },
    'EMI & Loans':   { icon: '🏦', words: ['emi', 'loan emi', 'credit card bill', 'cc bill', 'card bill', 'loan', 'interest paid'] },
    'Insurance':     { icon: '🛡️', words: ['insurance', 'lic', 'premium', 'policy', 'health insurance', 'term insurance', 'bike insurance', 'car insurance'] },
    'Tax':           { icon: '🧾', words: ['tax', 'income tax', 'tds', 'property tax', 'advance tax', 'challan', 'fine', 'penalty'] },
    'Other':         { icon: '📦', words: [] },
  };

  const INCOME_CATEGORIES = {
    'Salary':       { icon: '💼', words: ['salary', 'sal', 'paycheck', 'wages', 'pay credited', 'salary credited'] },
    'Bonus':        { icon: '🎉', words: ['bonus', 'arrears', 'da arrears', 'incentive', 'reward', 'award'] },
    'Interest':     { icon: '📈', words: ['interest', 'dividend', 'fd interest', 'savings interest'] },
    'Refund':       { icon: '↩️', words: ['refund', 'cashback', 'cash back', 'reimbursement', 'ta bill', 'medical reimbursement', 'claim'] },
    'Side income':  { icon: '🧑‍💻', words: ['freelance', 'side income', 'tuition income', 'consulting', 'commission', 'sold', 'sale'] },
    'Gift received':{ icon: '🎁', words: ['gift received', 'got gift'] },
    'Other income': { icon: '💰', words: [] },
  };

  const SAVING_CATEGORIES = {
    'SIP / Mutual fund': { icon: '📊', words: ['sip', 'mutual fund', 'mutual funds', 'mf', 'index fund', 'elss'] },
    'FD / RD':           { icon: '🏦', words: ['fd', 'rd', 'fixed deposit', 'recurring deposit', 'post office'] },
    'PPF / NPS / GPF':   { icon: '🧓', words: ['ppf', 'nps', 'gpf', 'epf', 'vpf', 'pension'] },
    'Stocks':            { icon: '📈', words: ['stocks', 'stock', 'shares', 'equity', 'zerodha', 'groww', 'upstox'] },
    'Gold':              { icon: '🪙', words: ['gold', 'sgb', 'gold bond', 'digital gold', 'silver'] },
    'Savings':           { icon: '🐷', words: ['saved', 'saving', 'savings', 'save', 'piggy', 'emergency fund', 'deposit', 'invest', 'invested', 'investment'] },
  };

  /* Record types and how each one reads on screen. */
  const TYPES = {
    expense:   { label: 'Expense',            sign: -1, icon: '💸' },
    income:    { label: 'Income',             sign: +1, icon: '💰' },
    saving:    { label: 'Saving',             sign: -1, icon: '🐷' },
    lent:      { label: 'Money given',        sign: -1, icon: '🤝' }, // they owe you
    borrowed:  { label: 'Money taken',        sign: +1, icon: '🙏' }, // you owe them
    got_back:  { label: 'Got money back',     sign: +1, icon: '✅' }, // they repaid you
    paid_back: { label: 'Paid money back',    sign: -1, icon: '↪️' }, // you repaid them
  };

  const MODES = [
    { mode: 'UPI',  words: ['upi', 'gpay', 'g pay', 'google pay', 'phonepe', 'phone pe', 'paytm', 'bhim', 'qr'] },
    { mode: 'Card', words: ['card', 'credit card', 'debit card', 'cc', 'dc', 'swipe'] },
    { mode: 'Bank', words: ['netbanking', 'net banking', 'neft', 'imps', 'rtgs', 'bank transfer', 'transfer', 'cheque'] },
    { mode: 'Cash', words: ['cash', 'by hand'] },
  ];

  // Words that are never a person's name or a useful description.
  const STOP = new Set(['to', 'from', 'for', 'the', 'a', 'an', 'my', 'me', 'i', 'on', 'at', 'in', 'via', 'by', 'with', 'back', 'rs', 'inr', 'rupees', 'rupee', 'and', 'of', 'is', 'was', 'paid', 'pay', 'spent', 'spend', 'bought', 'buy', 'got', 'get', 'gave', 'given', 'give', 'lent', 'lend', 'took', 'taken', 'take', 'borrowed', 'borrow', 'returned', 'return', 'repaid', 'repay', 'received', 'receive', 'sent', 'send', 'loan', 'money', 'amount', 'today', 'yesterday', 'ago', 'days', 'day', 'hand', 'it', 'him', 'her', 'them', 'he', 'she', 'they', 'settled', 'settle', 'credited', 'debited', 'some']);

  const FAMILY_WORDS = new Set(['amma', 'appa', 'mom', 'dad', 'mother', 'father', 'parents', 'wife', 'husband', 'home', 'family', 'son', 'daughter', 'kids', 'paati', 'thatha', 'grandma', 'grandpa']);

  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  /* ---------- Small helpers --------------------------------------------- */

  function pad(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  const ACRONYMS = new Set(['sip', 'eb', 'fd', 'rd', 'ppf', 'nps', 'gpf', 'epf', 'emi', 'lic', 'upi', 'gst', 'tds', 'lpg', 'cng', 'dth', 'pg', 'mf', 'sgb', 'kfc', 'atm', 'tv', 'ac', 'ssc', 'upsc', 'rbi', 'tnpsc', 'hp']);
  function titleCase(s) { return s.replace(/\b([a-z][a-z]*)/g, (w) => ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)); }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hasWord(text, word) { return new RegExp('(^|[^a-z0-9])' + escapeRe(word) + '(?=$|[^a-z0-9])').test(text); }

  // Build a longest-first keyword list so "credit card bill" wins over "bill".
  function keywordIndex(cats) {
    const list = [];
    for (const [name, c] of Object.entries(cats)) for (const w of c.words) list.push({ w, name });
    return list.sort((a, b) => b.w.length - a.w.length);
  }
  const EXP_INDEX = keywordIndex(EXPENSE_CATEGORIES);
  const INC_INDEX = keywordIndex(INCOME_CATEGORIES);
  const SAV_INDEX = keywordIndex(SAVING_CATEGORIES);

  /** Find the category whose keyword appears EARLIEST in the text (longest wins ties). */
  function matchCategory(text, index) {
    let best = null;
    for (const { w, name } of index) {
      const m = new RegExp('(^|[^a-z0-9])' + escapeRe(w) + '(?=$|[^a-z0-9])').exec(text);
      if (m) {
        const pos = m.index + m[1].length;
        if (!best || pos < best.pos || (pos === best.pos && w.length > best.w.length)) best = { name, w, pos };
      }
    }
    return best;
  }

  /* ---------- Date words ------------------------------------------------ */

  /** Pull a date out of the text. Returns { date, text-with-date-removed }. */
  function extractDate(text, today) {
    today = today || new Date();
    let t = text;
    let d = null;
    const take = (re, fn) => {
      if (d) return;
      const m = re.exec(t);
      if (m) { const r = fn(m); if (r && !isNaN(r)) { d = r; t = (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)); } }
    };

    take(/\b(day before yesterday|day before yday)\b/, () => addDays(today, -2));
    take(/\b(yesterday|yday|ystdy|nethu|netru)\b/, () => addDays(today, -1));
    take(/\b(today|now|inniku|indru)\b/, () => today);
    take(/\b(\d{1,2})\s*days?\s*(ago|back|before)\b/, (m) => addDays(today, -parseInt(m[1], 10)));
    take(/\b(last\s+week)\b/, () => addDays(today, -7));
    take(/\b(?:last\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/, (m) => {
      const want = WEEKDAYS.indexOf(m[1]);
      let diff = (today.getDay() - want + 7) % 7;
      if (diff === 0) diff = 7; // "monday" said on a Monday means last Monday
      return addDays(today, -diff);
    });
    // 5/9, 05-09-2026, 5.9.26  (Indian order: day first). Dots need a year so "12.50" stays an amount.
    const numDate = (m) => {
      const day = +m[1], mon = +m[2];
      if (day < 1 || day > 31 || mon < 1 || mon > 12) return null;
      let yr = m[3] ? +m[3] : today.getFullYear();
      if (yr < 100) yr += 2000;
      const r = new Date(yr, mon - 1, day);
      if (!m[3] && r > today) r.setFullYear(yr - 1); // no year and in the future -> last year
      return r;
    };
    take(/\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/, numDate);
    take(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}|\d{2}))?\b/, numDate);
    // 5 sep, 5th september 2026, sep 5
    const monRe = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
    const mk = (day, monStr, yrStr) => {
      const mon = MONTHS.indexOf(monStr.slice(0, 3));
      let yr = yrStr ? +yrStr : today.getFullYear();
      if (yr < 100) yr += 2000;
      const r = new Date(yr, mon, +day);
      if (!yrStr && r > today) r.setFullYear(yr - 1);
      return r;
    };
    take(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+' + monRe + '\\b(?:\\s+(\\d{4})\\b)?'), (m) => mk(m[1], m[2], m[3]));
    take(new RegExp('\\b' + monRe + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4}))?'), (m) => mk(m[2], m[1], m[3]));
    // "on 5th"
    take(/\bon\s+(\d{1,2})(?:st|nd|rd|th)\b/, (m) => {
      const r = new Date(today.getFullYear(), today.getMonth(), +m[1]);
      if (r > today) r.setMonth(r.getMonth() - 1);
      return r;
    });

    return { date: isoDate(d || today), text: t.replace(/\s+/g, ' ').trim(), explicit: !!d };
  }

  /* ---------- Amounts --------------------------------------------------- */

  /** Find the amount. Prefers a number next to ₹/rs; otherwise the largest number. */
  function extractAmount(text) {
    const re = /(₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|l|lakh|lakhs|lac|lacs|cr|crore)?\b\s*(\/-|rs\.?|rupees|₹)?/g;
    let m, best = null;
    while ((m = re.exec(text))) {
      const raw = m[2].replace(/,/g, '');
      let val = parseFloat(raw);
      if (isNaN(val)) continue;
      const unit = (m[3] || '').toLowerCase();
      if (unit === 'k' || unit === 'thousand') val *= 1000;
      else if (unit === 'l' || unit.startsWith('la')) val *= 100000;
      else if (unit === 'cr' || unit === 'crore') val *= 10000000;
      const marked = !!(m[1] || m[4]);
      const cand = { val: Math.round(val * 100) / 100, marked, start: m.index, end: m.index + m[0].length };
      if (!best || (cand.marked && !best.marked) || (cand.marked === best.marked && cand.val > best.val)) best = cand;
    }
    if (!best || best.val <= 0) return { amount: null, text };
    return { amount: best.val, text: (text.slice(0, best.start) + ' ' + text.slice(best.end)).replace(/\s+/g, ' ').trim() };
  }

  /* ---------- Payment mode ---------------------------------------------- */

  function extractMode(text) {
    for (const { mode, words } of MODES) {
      for (const w of words.slice().sort((a, b) => b.length - a.length)) {
        if (hasWord(text, w)) {
          // don't treat "credit card bill" as paying by card — it's a bill category word
          if (mode === 'Card' && /(credit card|cc|card) bill/.test(text)) continue;
          return { mode, text: text.replace(new RegExp('(^|[^a-z0-9])(by |via |through )?' + escapeRe(w) + '(?=$|[^a-z0-9])'), ' ').replace(/\s+/g, ' ').trim() };
        }
      }
    }
    return { mode: '', text };
  }

  /* ---------- Person names ---------------------------------------------- */

  /** Find a person: the word(s) after "to"/"from", else the first leftover word. */
  function extractPerson(text, removeWords) {
    const cleaned = text.replace(/[^a-z0-9\s.'-]/g, ' ');
    const after = /\b(?:to|from|with)\s+([a-z][a-z.'-]*)(?:\s+([a-z][a-z.'-]*))?/.exec(cleaned);
    if (after && !STOP.has(after[1])) {
      let name = after[1];
      if (after[2] && !STOP.has(after[2]) && !['for', 'on', 'at'].includes(after[2]) && after[2].length > 1 && !isKeyword(after[2])) name += ' ' + after[2];
      return name;
    }
    const words = cleaned.split(/\s+/).filter((w) => w && !STOP.has(w) && !(removeWords || []).includes(w) && /^[a-z][a-z.'-]*$/.test(w));
    return words[0] || '';
  }

  function isKeyword(word) {
    return EXP_INDEX.some((k) => k.w === word) || INC_INDEX.some((k) => k.w === word) || SAV_INDEX.some((k) => k.w === word);
  }

  /** What's left after removing grammar words — becomes the description. */
  function leftoverNote(text, extraRemove) {
    const rm = new Set([...(extraRemove || []).map((s) => s.toLowerCase())]);
    const words = text.replace(/[^a-z0-9\s&'.-]/gi, ' ').split(/\s+/).filter((w) => w && !STOP.has(w) && !rm.has(w));
    return titleCase(words.join(' ')).trim();
  }

  /* ---------- Type detection -------------------------------------------- */

  function detectType(t, ctx) {
    // Repayments first (they contain words like "gave"/"paid").
    if (/\b(got back|received back|get back|returned me|repaid me|paid me back|paid me|gave me back|gave back to me|returned to me)\b/.test(t)) return 'got_back';
    if (/\b(paid back|gave back|returned to|return to|repaid|repay|settled with|settle with)\b/.test(t)) return 'paid_back';
    if (/\b[a-z]+\s+(returned|repaid|settled)\b/.test(t) && !/^\s*(i|we)\s/.test(t)) return 'got_back';
    if (/\b(returned|return)\b/.test(t)) return 'paid_back';

    // Borrowing and lending.
    if (/\b(borrowed|borrow|took|taken|loan from|hand loan from|udhaar from|kadan from)\b/.test(t)) return 'borrowed';
    if (/\b(gave|given|give|lent|lend|loan to|hand loan to|udhaar to|kadan to|sent)\b/.test(t)) return 'lent';

    // "received 500 from ravi" — if Ravi owes you money, it's a repayment.
    const recv = /\b(received|got)\b.*\bfrom\s+([a-z]+)/.exec(t);
    if (recv) {
      const who = recv[2];
      if (ctx && ctx.owesMe && ctx.owesMe(who)) return 'got_back';
      if (!matchCategory(t, INC_INDEX)) return 'borrowed_or_income'; // resolved by the caller
    }

    // Income and savings words. Explicit money-in verbs always mean income.
    if (/\b(received|credited|earned|income|got paid)\b/.test(t)) return 'income';
    // Otherwise the most specific (longest) keyword decides:
    // "interest paid" (expense) beats "interest" (income); "fd interest" (income) beats "fd" (saving).
    const cands = [
      ['expense', matchCategory(t, EXP_INDEX)],
      ['income', matchCategory(t, INC_INDEX)],
      ['saving', matchCategory(t, SAV_INDEX)],
    ].filter((c) => c[1]);
    if (!cands.length) return 'expense';
    cands.sort((a, b) => (b[1].w.length - a[1].w.length) || (a[1].pos - b[1].pos));
    return cands[0][0];
  }

  /* ---------- Main entry: parse one line -------------------------------- */

  /**
   * Parse one note like "petrol 500 upi yesterday".
   * ctx (optional): { today: Date, learned: {phrase: {type, category}}, owesMe(name) }
   */
  function parseOne(input, ctx) {
    ctx = ctx || {};
    const raw = String(input || '').trim();
    if (!raw) return { ok: false, error: 'Empty', raw };
    let t = ' ' + raw.toLowerCase().replace(/[“”"]/g, ' ').replace(/\s+/g, ' ') + ' ';

    // "rent 12000 every month on 5th" / "salary 55000 monthly" -> a monthly auto entry
    const REPEAT = /\b(every\s*month|each\s*month|per\s*month|monthly|every\s*mnth|maasam|maatham)\b/;
    const repeat = REPEAT.test(t);
    if (repeat) t = t.replace(REPEAT, ' ');

    const dateRes = extractDate(t, ctx.today);
    t = dateRes.text;
    const amtRes = extractAmount(t);
    if (amtRes.amount == null) return { ok: false, error: 'Add an amount, e.g. "' + raw + ' 100"', raw };
    t = amtRes.text;
    const modeRes = extractMode(t);
    t = modeRes.text;

    let type = detectType(t, ctx);
    let category = '';
    let person = '';
    let note = '';

    // 1) Things the user taught the app (by editing a record) win over built-in rules.
    const learned = ctx.learned || {};
    const learnedHit = Object.keys(learned).sort((a, b) => b.length - a.length).find((p) => p && hasWord(t, p));

    if (type === 'lent' || type === 'borrowed' || type === 'got_back' || type === 'paid_back' || type === 'borrowed_or_income') {
      person = extractPerson(t);
      // "gave amma 2000" / "sent home 5000" is family support, not a loan.
      if ((type === 'lent') && (FAMILY_WORDS.has(person) || /\bsent home\b/.test(t)) && !/\b(lent|lend|loan)\b/.test(t)) {
        type = 'expense'; category = 'Family';
        note = leftoverNote(t) || 'Family';
        person = '';
      } else if (type === 'borrowed_or_income') {
        // "got 500 from ravi" with no history — treat as money taken (safer: you can edit).
        type = 'borrowed';
      }
      if (!person && category !== 'Family') {
        // "sent 200" with nobody named — just a normal expense / income.
        type = (type === 'lent' || type === 'paid_back') ? 'expense' : 'income';
      }
      if (person) {
        const rest = leftoverNote(t, [person, ...person.split(' ')]);
        note = rest;
        person = titleCase(person);
      }
    }

    if (!category) {
      if (learnedHit && (type === 'expense' || type === 'income' || type === 'saving')) {
        const L = learned[learnedHit];
        type = L.type || type;
        category = L.category;
      } else if (type === 'income') {
        const m = matchCategory(t, INC_INDEX);
        category = m ? m.name : 'Other income';
      } else if (type === 'saving') {
        const m = matchCategory(t, SAV_INDEX);
        category = m ? m.name : 'Savings';
      } else if (type === 'expense') {
        const m = matchCategory(t, EXP_INDEX);
        category = m ? m.name : 'Other';
      } else {
        category = 'Personal loan';
      }
    }
    if (!note && type !== 'lent' && type !== 'borrowed' && type !== 'got_back' && type !== 'paid_back') {
      note = leftoverNote(t) || category;
    }

    return {
      ok: true,
      type,
      amount: amtRes.amount,
      category,
      person,
      note,
      date: dateRes.date,
      mode: modeRes.mode,
      repeat: repeat && (type === 'expense' || type === 'income' || type === 'saving'),
      raw,
    };
  }

  /**
   * Parse a whole message. Splits on commas, semicolons, "+" and new lines,
   * e.g. "chai 20, auto 60\nmilk 30". A piece without an amount is joined to
   * the previous one ("bread, milk 60" stays one record).
   */
  function parseMany(input, ctx) {
    // Split on new lines, ";", "+" and commas that are NOT inside a number like 1,200.
    const pieces = String(input || '').split(/\n|;|\+|,(?!\d)/).map((s) => s.trim()).filter(Boolean);
    const merged = [];
    let prefix = '';
    for (const p of pieces) {
      if (/\d/.test(p)) { merged.push((prefix + ' ' + p).trim()); prefix = ''; }
      else prefix = (prefix + ' ' + p).trim(); // no amount yet -> belongs with the next piece
    }
    if (prefix) {
      if (merged.length) merged[merged.length - 1] += ' ' + prefix; // e.g. "lunch 200, yesterday"
      else merged.push(prefix);
    }
    return merged.map((p) => parseOne(p, ctx));
  }

  /* ---------- Bill (receipt) reading ------------------------------------ */

  /**
   * Read the text that OCR got from a photographed bill and guess
   * { amount, date, merchant, category, gst }.
   */
  function parseBill(ocrText, ctx) {
    ctx = ctx || {};
    const today = ctx.today || new Date();
    const lines = String(ocrText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const lower = lines.map((l) => l.toLowerCase());
    const numsIn = (l) => (l.replace(/(\d),(\d)/g, '$1$2').match(/\d+(?:\.\d{1,2})?/g) || []).map(Number);

    // 1) Total amount — look for the strongest "total" label, take the last number on that line.
    const labels = [
      { re: /(grand\s*total|net\s*payable|amount\s*payable|net\s*amount|total\s*payable|bill\s*amount|total\s*amount|amount\s*due|to\s*pay|total\s*rs|total\s*inr|net\s*total|total\s*\(?₹?\)?)/, score: 3 },
      { re: /\btotal\b/, score: 2 },
      { re: /\b(amount|amt|paid|cash|upi)\b/, score: 1 },
    ];
    let amount = null, bestScore = 0;
    lower.forEach((l, i) => {
      if (/sub\s*-?\s*total|total\s*(qty|items|quantity)|round\s*off|saved|savings|discount/.test(l)) return;
      for (const { re, score } of labels) {
        if (re.test(l)) {
          let nums = numsIn(lines[i]).filter((n) => n > 0 && n < 10000000);
          if (!nums.length && lower[i + 1]) nums = numsIn(lines[i + 1]).filter((n) => n > 0); // value on next line
          if (nums.length && score >= bestScore) {
            const val = nums[nums.length - 1];
            if (score > bestScore || val > (amount || 0)) { amount = val; bestScore = score; }
          }
          break;
        }
      }
    });
    if (amount == null) {
      // fall back to the biggest money-looking number (with 2 decimals)
      const money = [];
      lines.forEach((l) => (l.replace(/(\d),(\d)/g, '$1$2').match(/\d+\.\d{2}\b/g) || []).forEach((n) => money.push(+n)));
      if (money.length) amount = Math.max(...money.filter((n) => n < 1000000));
    }

    // 2) Date
    let date = null;
    for (const l of lower) {
      const m = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/.exec(l) || /\b(\d{1,2})[\s\-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,]*(\d{2,4})\b/.exec(l);
      if (m) {
        let yr = +m[3]; if (yr < 100) yr += 2000;
        const mon = isNaN(+m[2]) ? MONTHS.indexOf(m[2].slice(0, 3)) : +m[2] - 1;
        const d = new Date(yr, mon, +m[1]);
        if (!isNaN(d) && mon >= 0 && mon < 12 && +m[1] <= 31 && d <= addDays(today, 1) && yr > 2000) { date = isoDate(d); break; }
      }
    }

    // 3) Shop name — first line with real letters that isn't boilerplate.
    const boiler = /(tax\s*invoice|invoice|gstin|gst\s*no|bill\s*no|receipt|phone|ph[:.]|mob|cash\s*memo|original|duplicate|date|time|welcome|thank|fssai|cin|www\.|@)/;
    let merchant = '';
    for (const l of lines.slice(0, 6)) {
      const letters = l.replace(/[^a-zA-Z ]/g, '').trim();
      if (letters.length >= 3 && !boiler.test(l.toLowerCase())) { merchant = titleCase(letters.toLowerCase()).replace(/\s+/g, ' ').slice(0, 40); break; }
    }

    // 4) GST paid (CGST + SGST or IGST) — handy to know how much tax is in the bill.
    let gst = 0;
    lower.forEach((l, i) => {
      if (/\b(cgst|sgst|igst|utgst)\b/.test(l) && !/gstin/.test(l)) {
        const nums = numsIn(lines[i]).filter((n) => n > 0 && (!amount || n < amount));
        if (nums.length) gst += nums[nums.length - 1];
      }
    });
    gst = Math.round(gst * 100) / 100;
    const gstin = (/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/.exec(String(ocrText).toUpperCase()) || [])[0] || '';

    // 5) Category from shop name + items
    const all = ' ' + lower.join(' ') + ' ';
    const learned = ctx.learned || {};
    const lk = Object.keys(learned).find((p) => p && hasWord(' ' + (merchant || '').toLowerCase() + ' ', p));
    let category;
    if (lk) category = learned[lk].category;
    else {
      const byShop = matchCategory(' ' + merchant.toLowerCase() + ' ', EXP_INDEX);
      // Vote: each item line counts for the category of the keyword it contains.
      // Header lines ("Bill No", "Tax invoice"…) and the word "bill" itself are ignored.
      const votes = {};
      lower.forEach((l) => {
        if (boiler.test(l) || /total|gst|round/.test(l)) return;
        const m = matchCategory(' ' + l + ' ', EXP_INDEX);
        if (m && m.w !== 'bill') votes[m.name] = (votes[m.name] || 0) + 1;
      });
      const byText = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      category = (byShop && byShop.w !== 'bill' && byShop.name) || (byText && byText[0]) || (/restaurant|cafe|hotel|bhavan|kitchen|biryani|sweets|bakery/.test(all) ? 'Food' : 'Other');
      if (/(pharma|medical|chemist|drug)/.test(all)) category = 'Health';
      if (/(petrol|fuel|diesel|hpcl|bpcl|iocl|indian oil)/.test(all)) category = 'Fuel';
      if (/(supermarket|mart|provision|stores|fresh)/.test(merchant.toLowerCase()) && category === 'Other') category = 'Groceries';
    }

    return {
      ok: amount != null,
      type: 'expense',
      amount: amount != null ? Math.round(amount * 100) / 100 : null,
      date: date || isoDate(today),
      merchant,
      category,
      gst,
      gstin,
      note: merchant || 'Bill',
    };
  }

  /* ---------- Lookups used by the screens ------------------------------- */

  function categoriesFor(type) {
    if (type === 'income') return INCOME_CATEGORIES;
    if (type === 'saving') return SAVING_CATEGORIES;
    if (type === 'expense') return EXPENSE_CATEGORIES;
    return { 'Personal loan': { icon: '🤝', words: [] } };
  }
  function iconFor(type, category) {
    const c = categoriesFor(type)[category];
    return (c && c.icon) || (TYPES[type] && TYPES[type].icon) || '•';
  }

  const api = {
    parseOne, parseMany, parseBill, extractDate, extractAmount,
    EXPENSE_CATEGORIES, INCOME_CATEGORIES, SAVING_CATEGORIES, TYPES, MODES,
    categoriesFor, iconFor, isoDate,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parser = api;
})(typeof self !== 'undefined' ? self : this);
