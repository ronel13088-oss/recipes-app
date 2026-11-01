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
test('protein stays null unless numeric in source', () => { assert.equal(R.filter(r => r.protein_g != null).length, 2); });
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
