// Run with:  node expense-tracker/tests/parser.test.js
// Checks that everyday notes are understood the way a person means them.
const assert = require('assert');
const P = require('../js/parser.js');

const today = new Date(2026, 8, 28); // 28 Sep 2026 (a Monday)
const ctx = { today, learned: {}, owesMe: (n) => n === 'ravi' };
const one = (s, c) => P.parseOne(s, c || ctx);

const cases = [
  ['chai 20',                     { type: 'expense', amount: 20, category: 'Food', date: '2026-09-28' }],
  ['petrol 500 upi',              { type: 'expense', amount: 500, category: 'Fuel', mode: 'UPI' }],
  ['salary 55000',                { type: 'income', amount: 55000, category: 'Salary' }],
  ['gave ravi 2000',              { type: 'lent', amount: 2000, person: 'Ravi' }],
  ['lent 2000 to ravi for bike',  { type: 'lent', person: 'Ravi', note: 'Bike' }],
  ['took 500 from kumar',         { type: 'borrowed', amount: 500, person: 'Kumar' }],
  ['borrowed 1.5k from anand',    { type: 'borrowed', amount: 1500, person: 'Anand' }],
  ['ravi returned 1000',          { type: 'got_back', amount: 1000, person: 'Ravi' }],
  ['received 500 from ravi',      { type: 'got_back', person: 'Ravi' }],
  ['paid back kumar 500',         { type: 'paid_back', amount: 500, person: 'Kumar' }],
  ['kumar paid me back 300',      { type: 'got_back', person: 'Kumar' }],
  ['sip 5000',                    { type: 'saving', category: 'SIP / Mutual fund' }],
  ['fd 1 lakh',                   { type: 'saving', category: 'FD / RD', amount: 100000 }],
  ['fd interest 2300',            { type: 'income', category: 'Interest' }],
  ['loan emi 12000',              { type: 'expense', category: 'EMI & Loans' }],
  ['credit card bill 8000',       { type: 'expense', category: 'EMI & Loans', mode: '' }],
  ['lunch 150 yesterday',         { type: 'expense', category: 'Food', date: '2026-09-27' }],
  ['auto 60 2 days ago',          { type: 'expense', category: 'Transport', date: '2026-09-26', amount: 60 }],
  ['movie ticket 180',            { type: 'expense', category: 'Entertainment' }],
  ['train ticket 250',            { type: 'expense', category: 'Transport' }],
  ['2 samosa 30',                 { amount: 30, category: 'Food' }],
  ['coffee 12.50',                { amount: 12.5, date: '2026-09-28' }],
  ['rent 12,000 on 5th',          { amount: 12000, category: 'Rent', date: '2026-09-05' }],
  ['eb bill 1450 5/9',            { amount: 1450, category: 'Bills', date: '2026-09-05' }],
  ['gave amma 3000',              { type: 'expense', category: 'Family' }],
  ['share auto 20',               { type: 'expense', category: 'Transport' }],
  ['testbook pass 499',           { category: 'Education' }],
  ['hotel dinner 320 gpay',       { category: 'Food', mode: 'UPI' }],
  ['₹450 medicines',              { amount: 450, category: 'Health' }],
  ['bonus 10k',                   { type: 'income', amount: 10000, category: 'Bonus' }],
  ['cashback 50',                 { type: 'income', category: 'Refund' }],
  ['gold 5000',                   { type: 'saving', category: 'Gold' }],
  ['groceries 1200 last monday',  { category: 'Groceries', date: '2026-09-21' }],
  ['something 99',                { type: 'expense', category: 'Other', note: 'Something' }],
];

let pass = 0;
for (const [input, want] of cases) {
  const got = one(input);
  try {
    assert.ok(got.ok, 'not parsed');
    for (const k of Object.keys(want)) assert.deepStrictEqual(got[k], want[k], k);
    pass++;
  } catch (e) {
    console.error('FAIL', JSON.stringify(input), '->', e.message, JSON.stringify(got));
    process.exitCode = 1;
  }
}

// Many at once, commas inside numbers kept
const many = P.parseMany('chai 20, auto 60\nmilk 30; rent 1,20,000', ctx);
assert.deepStrictEqual(many.map((m) => m.amount), [20, 60, 30, 120000]); pass++;
const merged = P.parseMany('bread, milk 60', ctx);
assert.strictEqual(merged.length, 1); assert.strictEqual(merged[0].category, 'Groceries'); pass++;
assert.strictEqual(one('chai').ok, false); pass++;

// Learned keywords override built-in ones
const learnedCtx = Object.assign({}, ctx, { learned: { 'kumar stores': { type: 'expense', category: 'Groceries' } } });
assert.strictEqual(one('kumar stores 540', learnedCtx).category, 'Groceries'); pass++;

// Bill reading
const bill = P.parseBill([
  'SRI MURUGAN SUPERMARKET',
  'GSTIN: 33AABCS1429B1Z5',
  'Tax Invoice  Bill No: 4521',
  'Date: 26/09/2026  Time 18:42',
  'Rice 5kg          1   345.00',
  'Toor Dal          1   160.00',
  'Sub Total             505.00',
  'CGST 2.5%              12.63',
  'SGST 2.5%              12.63',
  'Round Off              -0.26',
  'GRAND TOTAL           530.00',
  'Thank you visit again',
].join('\n'), { today });
assert.strictEqual(bill.amount, 530); pass++;
assert.strictEqual(bill.date, '2026-09-26'); pass++;
assert.strictEqual(bill.merchant, 'Sri Murugan Supermarket'); pass++;
assert.strictEqual(bill.category, 'Groceries'); pass++;
assert.strictEqual(bill.gst, 25.26); pass++;
assert.strictEqual(bill.gstin, '33AABCS1429B1Z5'); pass++;

const fuel = P.parseBill('HP PETROL PUMP\nKM Fuels\nDate 20-09-2026\nPetrol 5.12 L\nRate 102.63\nAmount 525.47', { today });
assert.strictEqual(fuel.amount, 525.47); pass++;
assert.strictEqual(fuel.category, 'Fuel'); pass++;

console.log(`${pass} checks passed` + (process.exitCode ? ' (with failures above)' : ''));

// Restaurant bill: header "Bill No" must not make it a "Bills" category
const hotel = P.parseBill('SRI SARAVANA BHAVAN\nTirunelveli Junction\nGSTIN: 33AABCS1429B1Z5\nBill No: 4521 Date: 26/09/2026\nMasala Dosa 2 160.00\nFilter Coffee 2 60.00\nSub Total 300.00\nCGST 2.5% 7.50\nSGST 2.5% 7.50\nGRAND TOTAL 315.00', { today });
assert.strictEqual(hotel.amount, 315);
assert.strictEqual(hotel.category, 'Food');
assert.strictEqual(hotel.gst, 15);
console.log('restaurant bill ok');

// Monthly auto entries
const rent = P.parseOne('rent 12000 every month on 5th', ctx);
assert.strictEqual(rent.repeat, true); assert.strictEqual(rent.category, 'Rent'); assert.strictEqual(rent.date, '2026-09-05');
const sal = P.parseOne('salary 55000 monthly', ctx);
assert.strictEqual(sal.repeat, true); assert.strictEqual(sal.type, 'income'); assert.strictEqual(sal.note, 'Salary');
assert.strictEqual(P.parseOne('chai 20', ctx).repeat, false);
console.log('monthly phrases ok');
assert.strictEqual(P.parseOne('shopping 800 need', ctx).bucket, 'need');
assert.strictEqual(P.parseOne('course 2000 want', ctx).bucket, 'want');
assert.strictEqual(P.parseOne('course 2000 want', ctx).amount, 2000);
console.log('need/want words ok');

// Money given with nothing expected back -> expense tagged to that person
const gift = P.parseOne('gave manoj 500 gift', ctx);
assert.strictEqual(gift.type, 'expense'); assert.strictEqual(gift.person, 'Manoj'); assert.strictEqual(gift.amount, 500);
const g2 = P.parseOne('gave dilmaan 2000 no return', ctx);
assert.strictEqual(g2.type, 'expense'); assert.strictEqual(g2.person, 'Dilmaan');
assert.strictEqual(P.parseOne('gave ravi 2000', ctx).type, 'lent');   // still a loan without the word
assert.strictEqual(P.parseOne('gift 500', ctx).type, 'expense');       // no name -> plain expense
console.log('gift entries ok');
