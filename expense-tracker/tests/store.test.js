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
