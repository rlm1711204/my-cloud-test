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
