import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import * as L from '../js/logic.js'; import { merge } from '../scripts/build-data.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const R = L.normalize(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/recipes.json'), 'utf8')));
test('loads all recipes from data file with unique ids', () => { const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/recipes.json'), 'utf8')).recipes;
  assert.equal(R.length, raw.length); assert.equal(new Set(R.map(r => r.id)).size, R.length); });
test('schema-tolerant: old keys, bare array, garbage', () => {
  const r = L.normalize([{ id: 'a', title: 'x', meal: 'ערב', devices: ['מחבת'], prepMinutes: 7, ingredients: [{ name: 'ביצים', qty: 2 }], sourceUrl: 'https://e.example' }, null, 5]);
  assert.equal(r.length, 1); assert.equal(r[0].meal, 'dinner'); assert.deepEqual(r[0].devices, ['pan']); assert.equal(r[0].protein_g, null);
  assert.deepEqual(L.normalize({}), []); assert.equal(L.normalize([{ id: 1, url: 'javascript:alert(1)' }])[0].sourceUrl, ''); });
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/recipes.json'), 'utf8')).recipes;
test('protein stays null unless numeric in source', () => { assert.equal(R.filter(r => r.protein_g != null).length, RAW.filter(r => typeof r.protein_g === 'number').length); });
test('free-text / odd protein_basis never crashes and becomes a note', () => { const [a, b] = L.normalize([{ id: 'a', protein_g: 5, protein_basis: 'לפי העמוד' }, { id: 'b', protein_g: 5, protein_basis: { x: 1 } }]);
  assert.equal(L.proteinLabel(a), 'חלבון: 5 ג׳ (לפי העמוד)'); assert.equal(L.proteinLabel(b), 'חלבון: 5 ג׳'); });
test('ingredient parsing', () => { assert.deepEqual(L.parseIngredient('500 גרם בשר טחון'), { name: 'בשר טחון', qty: '500 גרם', amount: 500, unit: 'גרם' });
  assert.equal(L.parseIngredient('½ כוס חלב').amount, .5); assert.equal(L.parseIngredient('מלח ופלפל').qty, null); assert.equal(L.parseIngredient('2–3 ביצים').amount, null); });
test('filter: unknown prep excluded only when max set', () => { const all = L.filterRecipes(R, {}); assert.equal(all.length, R.length);
  const f = L.filterRecipes(R, { maxPrep: 10 }); assert.ok(f.every(r => r.prepMinutes != null && r.prepMinutes <= 10));
  assert.ok(L.filterRecipes(R, { meal: 'shake' }).every(r => r.meal === 'shake')); assert.ok(L.filterRecipes(R, { device: 'pan' }).every(r => r.devices.includes('pan'))); });
test('pantry ranking', () => { const x = L.rankByPantry(R, 'טונה, ביצים'); assert.ok(x.length > 0); assert.match(x[0].r.title, /טונה/); assert.deepEqual(L.rankByPantry(R, ''), []); });
test('shopping list merges duplicates', () => { const rs = [{ id: 'a', title: 'A', ingredients: [L.parseIngredient('2 ביצים'), L.parseIngredient('1 כוס חלב')] }, { id: 'b', title: 'B', ingredients: [L.parseIngredient('3 ביצים'), L.parseIngredient('מלח')] }];
  const l = L.shoppingList(rs, ['a', 'b', 'zz']); const e = l.find(i => i.name === 'ביצים'); assert.equal(e.qty, '5'); assert.equal(e.count, 2); assert.equal(l.length, 3); });
test('streak', () => { const t = new Date(2026, 10, 3), k = d => L.dayKey(new Date(2026, 10, d)); // allow-fake-data
  assert.equal(L.streak({ [k(1)]: [{ g: 100 }], [k(2)]: [{ g: 60 }, { g: 50 }] }, 100, t), 2); assert.equal(L.streak({ [k(3)]: [{ g: 100 }], [k(2)]: [{ g: 100 }] }, 100, t), 2);
  assert.equal(L.streak({ [k(1)]: [{ g: 100 }] }, 100, t), 0); assert.equal(L.streak({}, 0, t), 0); });
test('build-data merges, fails on duplicate id and bad JSON', () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rcp-'));
  fs.writeFileSync(path.join(d, 'recipes.json'), JSON.stringify({ recipes: [{ id: 'a' }] })); fs.writeFileSync(path.join(d, 'recipes-b2.json'), JSON.stringify({ recipes: [{ id: 'b' }] })); fs.writeFileSync(path.join(d, 'other.json'), '{bad');
  assert.equal(merge(d).recipes.length, 2);
  fs.writeFileSync(path.join(d, 'recipes-b3.json'), JSON.stringify([{ id: 'a' }])); assert.throws(() => merge(d), /duplicate id "a"/);
  fs.writeFileSync(path.join(d, 'recipes-b3.json'), '{oops'); assert.throws(() => merge(d), /invalid JSON in recipes-b3/); });
test('pantry ranks by matched count first: tuna salad tops "טונה, ביצה"', () => { const x = L.rankByPantry(R, 'טונה, ביצה'); assert.match(x[0].r.title, /טונה/); assert.ok(x[0].hit >= 2);
  for (let i = 1; i < x.length; i++) assert.ok(x[i - 1].hit > x[i].hit || (x[i - 1].hit === x[i].hit && x[i - 1].score >= x[i].score)); });
test('singular/plural folding', () => { assert.equal(L.stem('ביצה'), L.stem('ביצים')); assert.equal(L.stem('עגבנייה'), L.stem('עגבניות'));
  const rs = [{ id: 'a', title: 'A', ingredients: [L.parseIngredient('1 ביצה')] }, { id: 'b', title: 'B', ingredients: [L.parseIngredient('3 ביצים')] }];
  const l = L.shoppingList(rs, ['a', 'b']); assert.equal(l.length, 1); assert.equal(l[0].qty, '4');
  assert.equal(L.rankByPantry(rs, 'ביצים').length, 2); });
test('unknown-time group only when max set, respects meal/device, disjoint from main list', () => {
  assert.deepEqual(L.unknownPrep(R, {}), []);
  const F = { maxPrep: 10 }, main = L.filterRecipes(R, F), unk = L.unknownPrep(R, F);
  assert.ok(unk.length > 0 && unk.every(r => r.prepMinutes == null)); assert.ok(!unk.some(r => main.includes(r)));
  assert.equal(main.length + unk.length + R.filter(r => r.prepMinutes != null && r.prepMinutes > 10).length, R.length);
  assert.ok(L.unknownPrep(R, { maxPrep: 10, meal: 'shake' }).every(r => r.meal === 'shake')); });
test('protein_basis: source/calculated/free text/missing', () => {
  const [a, b, c, d] = L.normalize([{ id: 'a', protein_g: 20, protein_basis: 'calculated' }, { id: 'b', protein_g: 20, protein_basis: 'source' }, { id: 'c', protein_g: 5, protein_basis: 'לעוגייה' }, { id: 'd' }]);
  assert.equal(a.proteinCalculated, true); assert.equal(a.proteinBasis, ''); assert.equal(b.proteinCalculated, false); assert.equal(b.proteinBasis, '');
  assert.equal(c.proteinBasis, 'לעוגייה'); assert.equal(d.protein_g, null); assert.equal(d.proteinCalculated, false); });
test('protein schema v2: calculated_usda, verified flag, protein_note, calc breakdown', () => {
  const [a, b, c] = L.normalize([{ id: 'a', protein_g: 11, protein_basis: 'calculated_usda', protein_verified: false, protein_calc: { servings: 6, total_g: 63.8, items: [{ ingredient: 'ביצים', grams: 300, usda_protein_per_100g: 12.56, protein_g: 37.7 }, null] } },
    { id: 'b', protein_g: 8, protein_basis: 'source', protein_note: 'לעוגייה' }, { id: 'c', protein_g: 9, protein_basis: 'calculated_usda', protein_verified: true }]);
  assert.equal(L.proteinLabel(a), 'חלבון: 11 ג׳ (מחושב, לא מאומת)'); assert.equal(a.proteinCalc.items.length, 1);
  assert.equal(L.proteinLabel(b), 'חלבון: 8 ג׳ (לעוגייה)'); assert.equal(L.proteinLabel(c), 'חלבון: 9 ג׳ (מחושב)'); });
test('real data: 15-minute filter puts 30/25 over limit and null-time in unknown group', () => {
  const F = { maxPrep: 15 }, main = L.filterRecipes(R, F).map(r => r.id), unk = L.unknownPrep(R, F).map(r => r.id);
  for (const id of ['one-pot-bolognese', 'tuna-egg-corn-salad']) { assert.ok(!main.includes(id) && !unk.includes(id)); }
  assert.deepEqual(unk.sort(), R.filter(r => r.prepMinutes == null).map(r => r.id).sort()); assert.equal(unk.length, RAW.filter(r => r.active_minutes == null).length); });
test('validBackup deep validation', () => { const ok = { plan: ['a'], log: { '2026-11-01': [{ g: 30, label: 'x' }] }, goal: 150 }; const w = st => ({ app: 'recipes-app', state: st });
  assert.equal(L.validBackup(w(ok)), true); assert.equal(L.validBackup(w({ plan: [], log: {}, goal: 1 })), true);
  for (const bad of [null, [], 'x', { ...ok, plan: 'a' }, { ...ok, plan: [1] }, { ...ok, plan: [null] }, { ...ok, log: null }, { ...ok, log: [] }, { ...ok, log: { d: 'x' } }, { ...ok, log: { d: [null] } }, { ...ok, log: { d: [{ g: '30' }] } },
    { ...ok, log: { d: [{ g: NaN }] } }, { ...ok, log: { d: [{ g: Infinity }] } }, { ...ok, log: { d: [{}] } }, { ...ok, goal: 0 }, { ...ok, goal: -5 }, { ...ok, goal: '150' }, { ...ok, goal: Infinity }, { plan: [], log: {} }])
    assert.equal(L.validBackup(w(bad)), false, JSON.stringify(bad));
  assert.equal(L.validBackup({ app: 'other', state: ok }), false); assert.equal(L.validBackup(null), false); assert.equal(L.validBackup({ app: 'recipes-app' }), false); });
test('pantry: whole-word match only', () => { const rs = [{ id: 'p', title: 'P', ingredients: [L.parseIngredient('½ כוס אבקת חלבון')] }, { id: 'm', title: 'M', ingredients: [L.parseIngredient('1 כוס חלב')] }, { id: 'y', title: 'Y', ingredients: [L.parseIngredient('1 גביע יוגורט יווני')] }];
  assert.deepEqual(L.rankByPantry(rs, 'חלב').map(x => x.r.id), ['m']); assert.deepEqual(L.rankByPantry(rs, 'אבקת חלבון').map(x => x.r.id), ['p']);
  assert.deepEqual(L.rankByPantry(rs, 'יוגורט').map(x => x.r.id), ['y']); assert.deepEqual(L.rankByPantry(rs, 'יוגורט יווני').map(x => x.r.id), ['y']); assert.deepEqual(L.rankByPantry(rs, 'יוג').length, 0); });
test('no-time recipe under 5-minute filter lands in unknown group', () => { const rs = L.normalize([{ id: 'n', active_minutes: null }, { id: 'f', active_minutes: 5 }, { id: 's', active_minutes: 6 }]);
  assert.deepEqual(L.filterRecipes(rs, { maxPrep: 5 }).map(r => r.id), ['f']); assert.deepEqual(L.unknownPrep(rs, { maxPrep: 5 }).map(r => r.id), ['n']); });
