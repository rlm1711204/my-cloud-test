// Run with:  node expense-tracker/tests/store.test.js
// Checks phone <-> Google Drive merging and the "who owes whom" maths.
const assert = require('assert');
const mem = {};
global.localStorage = { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } };
const Store = require('../js/store.js');
Store.load();

const a = Store.add({ type: 'lent', amount: 2000, person: 'Ravi', date: '2026-09-12' });
Store.add({ type: 'got_back', amount: 500, person: 'ravi', date: '2026-09-20' });
Store.add({ type: 'borrowed', amount: 300, person: 'Kumar', date: '2026-09-15' });
Store.add({ type: 'expense', amount: 100, category: 'Food', date: '2026-09-15' });
const ppl = Store.people();
assert.strictEqual(ppl.find((p) => p.key === 'ravi').balance, 1500);   // Ravi owes 1500
assert.strictEqual(ppl.find((p) => p.key === 'kumar').balance, -300);  // I owe Kumar 300
assert.ok(Store.owesMe('RAVI'));

// Two copies edited separately: newest edit of each record wins, deletes stick.
const phone = JSON.parse(JSON.stringify(Store.get()));
const drive = JSON.parse(JSON.stringify(Store.get()));
phone.txns[0].amount = 2500; phone.txns[0].updatedAt = '2099-01-01T00:00:00Z';
drive.txns[3].deleted = true; drive.txns[3].updatedAt = '2099-01-02T00:00:00Z';
drive.txns.push({ id: 'new1', type: 'income', amount: 55000, category: 'Salary', date: '2026-09-01', createdAt: '2026-09-01', updatedAt: '2026-09-01' });
const m = Store.merge(phone, drive);
assert.strictEqual(m.txns.length, 5);
assert.strictEqual(m.txns.find((t) => t.id === a.id).amount, 2500);
assert.ok(m.txns.find((t) => t.category === 'Food').deleted);
Store.replaceAll(m);
const t = Store.totals('2026-09-01', '2026-09-30');
assert.strictEqual(t.income, 55000);
assert.strictEqual(t.expense, 0);
assert.ok(Store.toCSV().includes('Money given'));
console.log('store checks passed');

// Monthly auto entries
Store.replaceAll(Store.emptyData());
const rule = Store.addRule({ type: 'expense', amount: 12000, category: 'Rent', note: 'Rent', day: 5, startMonth: '2026-07' });
const sal = Store.addRule({ type: 'income', amount: 55000, category: 'Salary', note: 'Salary', day: 31, startMonth: '2026-09' });
const made = Store.applyRecurring(new Date(2026, 8, 29)); // 29 Sep 2026
assert.deepStrictEqual(made.map((t) => t.date).sort(), ['2026-07-05', '2026-08-05', '2026-09-05']); // salary on 30 Sep not due yet
assert.strictEqual(Store.applyRecurring(new Date(2026, 8, 29)).length, 0);       // never twice
assert.strictEqual(Store.applyRecurring(new Date(2026, 8, 30))[0].date, '2026-09-30'); // 31st -> last day of Sep
// deleting one month's entry doesn't bring it back
Store.remove('r_' + rule.id + '_2026-08');
assert.strictEqual(Store.applyRecurring(new Date(2026, 9, 6)).length, 1);         // only Oct rent (salary is on the 31st)
assert.ok(Store.get().txns.find((t) => t.id === 'r_' + rule.id + '_2026-08').deleted);
// editing the rule changes future months only; pausing stops it
Store.updateRule(sal.id, { amount: 60000 });
Store.updateRule(rule.id, { active: false });
const nov = Store.applyRecurring(new Date(2026, 10, 30));
assert.deepStrictEqual(nov.map((t) => t.amount), [60000, 60000]);                // Oct 31 + Nov 30 salary, no rent
assert.strictEqual(Store.nextRun(Store.rules().find((r) => r.id === sal.id), new Date(2026, 10, 30)), '2026-12-31');
// two phones adding the same month merge into one entry, and a manual edit wins
const p1 = JSON.parse(JSON.stringify(Store.get())); const p2 = JSON.parse(JSON.stringify(Store.get()));
const id = 'r_' + sal.id + '_2026-11';
p1.txns.find((t) => t.id === id).amount = 61000; p1.txns.find((t) => t.id === id).updatedAt = '2026-11-30T09:00:00.000Z'; // edited later that day
const mm = Store.merge(p1, p2);
assert.strictEqual(mm.txns.filter((t) => t.id === id).length, 1);
assert.strictEqual(mm.txns.find((t) => t.id === id).amount, 61000);
console.log('monthly auto entries ok');

// Budget plan: Needs / Wants / Savings + carry forward
Store.replaceAll(Store.emptyData());
const add = (type, amount, category, date, extra) => Store.add(Object.assign({ type, amount, category, date }, extra || {}));
add('income', 50000, 'Salary', '2026-08-01');
add('expense', 12000, 'Rent', '2026-08-05');      // need
add('expense', 3000, 'Food', '2026-08-10');       // want
add('saving', 5000, 'SIP / Mutual fund', '2026-08-10');
// August left = 50000 - 12000 - 3000 - 5000 = 30000 -> carried into Sept
add('income', 50000, 'Salary', '2026-09-01');
add('expense', 20000, 'Rent', '2026-09-05');
add('expense', 4000, 'Shopping', '2026-09-12');
add('expense', 1500, 'Shopping', '2026-09-13', { bucket: 'need' }); // you marked it a need
add('saving', 6000, 'Gold', '2026-09-15');
const plan = Store.budgetPlan(2026, 8);
const H = Object.fromEntries(plan.heads.map((h) => [h.key, h]));
assert.strictEqual(plan.base, 50000);
assert.deepStrictEqual([H.need.budget, H.want.budget, H.saving.budget], [25000, 15000, 10000]);
assert.deepStrictEqual([H.need.used, H.want.used, H.saving.used], [21500, 4000, 6000]);
assert.deepStrictEqual([H.need.left, H.want.left, H.saving.left], [3500, 11000, 4000]);
assert.strictEqual(plan.carry, 30000);
assert.strictEqual(plan.totalLeft, 30000 + (50000 - 20000 - 4000 - 1500 - 6000));
// custom split and category override
Store.setSetting('split', [60, 20, 20]);
Store.setSetting('bucketMap', { Shopping: 'need' });
const plan2 = Store.budgetPlan(2026, 8);
assert.strictEqual(plan2.heads[0].budget, 30000);
assert.strictEqual(plan2.heads[0].used, 25500);
// carry off
Store.setSetting('carryForward', false);
assert.strictEqual(Store.budgetPlan(2026, 8).carry, 0);
// a shortfall carries over as a minus (Sept overspent -> Oct starts behind)
Store.setSetting('carryForward', true);
add('expense', 90000, 'Travel', '2026-08-20');
assert.strictEqual(Store.carryInto(2026, 8), 30000 - 90000);        // Aug: +30000 leftover, then -90000 spent
const oct = Store.budgetPlan(2026, 9);
assert.strictEqual(oct.carry, Store.carryInto(2026, 9));
assert.strictEqual(oct.totalLeft, oct.monthLeft + oct.carry);
assert.ok(oct.hasEarlier);
// shortfalls and leftovers add up across several months
Store.replaceAll(Store.emptyData());
Store.setSetting('carryForward', true);
add('income', 50000, 'Salary', '2026-07-01'); add('expense', 20000, 'Rent', '2026-07-05');   // +30000
add('income', 50000, 'Salary', '2026-08-01'); add('expense', 95000, 'Travel', '2026-08-10'); // -45000
assert.strictEqual(Store.carryInto(2026, 8), -15000);
// a first month with no earlier months carries nothing
assert.strictEqual(Store.carryInto(2026, 6), 0);
assert.strictEqual(Store.budgetPlan(2026, 6).hasEarlier, false);
console.log('budget plan ok');

// Group by item name, and cumulative spending per person
Store.replaceAll(Store.emptyData());
const mk = (note, amount, date, person) => Store.add({ type: 'expense', amount, category: person ? 'Gifts' : 'Groceries', note, date, person: person || '' });
mk('Milk', 30, '2026-10-01'); mk('milk ', 30, '2026-10-05'); mk('Milk', 60, '2026-10-09');
mk('Eggs', 80, '2026-10-02'); mk('egg', 80, '2026-10-08');
Store.add({ type: 'expense', amount: 1200, category: 'Health', note: 'Gym subscription', date: '2026-10-03' });
mk('Gift to Manoj', 500, '2026-10-04', 'Manoj'); mk('Manoj birthday', 1500, '2026-10-20', 'manoj');
mk('Dilmaan help', 2000, '2026-10-06', 'Dilmaan');
const items = Store.byItem('2026-10-01', '2026-10-31');
assert.strictEqual(items.find((x) => x.key === 'person:manoj').amount, 2000); // both Manoj entries in one row
assert.strictEqual(items.find((x) => x.key === 'person:manoj').name, '🎁 Manoj');
const milk = items.find((x) => x.key === 'milk');
assert.strictEqual(milk.amount, 120); assert.strictEqual(milk.count, 3); assert.strictEqual(milk.avg, 40);
assert.strictEqual(items.find((x) => x.key === 'egg').amount, 160);     // Eggs + egg together
assert.strictEqual(items.find((x) => x.key === 'gym subscription').amount, 1200);
const gifts = Store.gifts('2026-10-01', '2026-10-31');
assert.strictEqual(gifts[0].name, 'Manoj');                              // biggest first
assert.strictEqual(gifts[0].amount, 2000); assert.strictEqual(gifts[0].count, 2);  // Manoj + manoj together
assert.strictEqual(gifts.find((g) => g.key === 'dilmaan').amount, 2000);
assert.strictEqual(Store.gifts().length, 3 - 1);                          // all time, Manoj merged
// gifts are ordinary expenses: they count in the month's spending
assert.strictEqual(Store.totals('2026-10-01', '2026-10-31').expense, 30 + 30 + 60 + 80 + 80 + 1200 + 500 + 1500 + 2000);
console.log('item & person grouping ok');
