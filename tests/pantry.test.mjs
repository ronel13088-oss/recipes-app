import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import * as Pn from '../js/pantry.js'; import * as L from '../js/logic.js';
const A = Pn.loadAliases({ staples: ['מלח'], aliases: { '2 ביצים': 'ביצה', '3 ביצים': 'ביצה', 'קופסת טונה': 'טונה', '1 בצל': 'בצל', 'קורט מלח': 'מלח', 'חצי כוס חלב': 'חלב', '1 סקופ אבקת חלבון': 'אבקת חלבון', 'עגבנייה': 'עגבנייה', 'מלפפון': 'מלפפון' } });
const R = L.normalize({ recipes: [
  { id: 'omlet', title: 'חביתה', ingredients: ['2 ביצים', 'קורט מלח'] },
  { id: 'tuna', title: 'סלט טונה', ingredients: ['קופסת טונה', '3 ביצים', '1 בצל'] },
  { id: 'salad', title: 'סלט', ingredients: ['עגבנייה', 'מלפפון', '1 בצל', 'קופסת טונה'] },
  { id: 'shake', title: 'שייק', ingredients: ['חצי כוס חלב', '1 סקופ אבקת חלבון'] }] });
test('normalization: alias map maps variants to one canon; staples ignored', () => {
  assert.equal(Pn.canonOf(R[0].ingredients[0], A).canon, 'ביצה'); assert.equal(Pn.canonOf(R[1].ingredients[1], A).canon, 'ביצה');
  assert.equal(Pn.canonOf(R[0].ingredients[1], A).staple, true); assert.equal(Pn.canonOf(R[0].ingredients[0], A).via, 'alias');
  assert.equal(Pn.canonOf({ name: 'מלח', raw: 'לא במפה' }, A).via, 'interim');
  assert.deepEqual(Pn.vocabulary(R, A).map(v => v.name).sort(), ['אבקת חלבון', 'ביצה', 'בצל', 'חלב', 'טונה', 'מלפפון', 'עגבנייה'].sort()); });
test('normalization: garbage alias file -> empty map, no crash', () => { for (const g of [null, 1, 'x', [], { aliases: [] }, { aliases: { a: 5 } }]) assert.deepEqual(Object.keys(Pn.loadAliases(g).aliases), []); });
test('matching: full match first, then missing 1-2 with names, >2 missing dropped', () => {
  const r = Pn.rank(R, ['ביצה', 'טונה'], A);
  assert.equal(r[0].r.id, 'omlet'); assert.deepEqual(r[0].missing, []);
  assert.equal(r[1].r.id, 'tuna'); assert.deepEqual(r[1].missing, ['בצל']);
  assert.ok(!r.some(x => x.r.id === 'salad')); // missing 3
  assert.ok(!r.some(x => x.r.id === 'shake')); // no match
  assert.deepEqual(Pn.rank(R, [], A), []); });
test('matching: exact canon only (חלב does not match אבקת חלבון)', () => { const r = Pn.rank(R, ['חלב'], A); assert.deepEqual(r.map(x => [x.r.id, x.missing]), [['shake', ['אבקת חלבון']]]); });
test('pantry toggle: tap adds, tap again removes; no other removal path', () => {
  let p = Pn.toggle([], 'ביצה'); assert.deepEqual(p, ['ביצה']); p = Pn.toggle(p, 'טונה'); p = Pn.toggle(p, 'ביצה'); assert.deepEqual(p, ['טונה']);
  assert.deepEqual(Pn.toggle(p, ''), ['טונה']); assert.deepEqual(Pn.toggle(p, 'x'.repeat(41)), ['טונה']);
  const src = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8'); assert.equal((src.match(/setPantry\(/g) || []).length, 1); });
test('validPantry', () => { assert.ok(Pn.validPantry(['ביצה'])); for (const b of [null, 'x', [1], [''], [' a'], ['a', 'a'], Array.from({ length: 201 }, (_, i) => 'n' + i)]) assert.equal(Pn.validPantry(b), false); });
const v2 = st => ({ app: 'recipes-app', version: 2, state: { v: 2, plan: [], checked: [], goal: null, log: {}, recent: [], free: [], ...st } });
test('backup round trip includes pantry; bad pantry rejected; old backup without pantry ok', () => {
  const b = JSON.parse(JSON.stringify(v2({ pantry: ['ביצה', 'טונה'] }))); assert.equal(L.validBackup(b), true); assert.deepEqual(L.importState(b).pantry, ['ביצה', 'טונה']);
  assert.equal(L.validBackup(v2({ pantry: [1] })), false); assert.equal(L.validBackup(v2({ pantry: ['a', 'a'] })), false);
  assert.equal(L.validBackup(v2({})), true); assert.deepEqual(L.importState(v2({})).pantry, []); });
test('store: export -> import round trip writes pantry_items', async () => {
  const m = new Map(); const ls = { get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  globalThis.localStorage = ls; const St = await import('../js/store.js');
  St.setPantry(['ביצה']); assert.equal(Pn.PANTRY_KEY, 'pantry_items'); const exp = St.exportState(); assert.deepEqual(exp.pantry, ['ביצה']);
  const file = JSON.parse(JSON.stringify({ app: 'recipes-app', version: 2, state: exp })); assert.equal(L.validBackup(file), true);
  m.clear(); St.importState(L.importState(file)); assert.deepEqual(St.pantry(), ['ביצה']); delete globalThis.localStorage; });
