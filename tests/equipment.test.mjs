import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { mapEquipment, EQUIP } from '../scripts/build-data.mjs'; import * as L from '../js/logic.js';
test('equipment: Hebrew -> keys, deduped; null-mapped dropped; other fields kept', () => {
  const o = mapEquipment({ id: 'x', equipment: ['מחבת', 'כיריים', 'סיר'], equipment_any: [['תנור', "סיר רב תכליתי נינג'ה"], ['גריל']], ninja_bake_adaptation: { a: 1 } }, 'x');
  assert.deepEqual(o.equipment, ['pan', 'stovetop']); assert.deepEqual(o.equipment_any, [['oven', 'ninja_foodi'], ['grill']]); assert.deepEqual(o.ninja_bake_adaptation, { a: 1 });
  assert.deepEqual(mapEquipment({ equipment: ['מקרר בלבד'] }, 'y').equipment, []); assert.deepEqual(mapEquipment({ equipment: ['pan'] }, 'z').equipment, ['pan']); });
test('equipment: unmapped value fails the build', () => {
  assert.throws(() => mapEquipment({ equipment: ['טוסטר'] }, 'r1'), /unmapped equipment "טוסטר"/);
  assert.throws(() => mapEquipment({ equipment_any: [['ווק']] }, 'r2'), /unmapped/); assert.throws(() => mapEquipment({ equipment_any: ['מחבת'] }, 'r3'), /array of arrays/);
  assert.throws(() => mapEquipment({ equipment: ['constructor'] }, 'r4'), /unmapped/); });
test('equipment: every Hebrew value in teammate source is mapped', () => {
  for (const f of ['recipes.json', 'recipes-batch2.json', 'recipes-batch3.json', 'recipes-batch4.json', 'recipes-batch5.json']) { const p = '/workspace/health/' + f; if (!fs.existsSync(p)) continue; const j = JSON.parse(fs.readFileSync(p)); const l = Array.isArray(j) ? j : j.recipes;
    for (const r of l) mapEquipment(r, r.id); } assert.ok(Object.keys(EQUIP).length >= 11); });
test('filter honors equipment_any (any one suffices)', () => {
  const R = L.normalize({ recipes: [{ id: 'm', meal: 'breakfast', equipment: ['blender'], equipment_any: [['ninja_foodi']], active_minutes: 10 }, { id: 'p', equipment: ['pan'], active_minutes: 10 }] });
  assert.deepEqual(L.filterRecipes(R, { device: 'ninja_foodi' }).map(r => r.id), ['m']); assert.deepEqual(L.filterRecipes(R, { device: 'blender' }).map(r => r.id), ['m']);
  assert.deepEqual(L.filterRecipes(R, { device: 'pan' }).map(r => r.id), ['p']); });
test('shipped data: only app keys, 79 recipes, ninja_bake_adaptation kept', () => { const d = JSON.parse(fs.readFileSync(new URL('../data/recipes.json', import.meta.url))).recipes; const K = Object.keys(L.DEVICES);
  assert.equal(d.length, 79); for (const r of d) { assert.ok(r.equipment.every(k => K.includes(k)), r.id); assert.ok((r.equipment_any || []).flat().every(k => K.includes(k) || k in L.DISPLAY_ONLY), r.id); assert.ok('ninja_bake_adaptation' in r); } });
test('filter ignores display-only oven/grill', () => { const R = L.normalize({ recipes: [{ id: 'o', equipment: [], equipment_any: [['oven', 'ninja_foodi']], active_minutes: 5 }, { id: 'g', equipment: [], equipment_any: [['grill']], active_minutes: 5 }] });
  assert.deepEqual(L.filterRecipes(R, { device: 'ninja_foodi' }).map(r => r.id), ['o']); assert.equal(L.filterRecipes(R, { device: 'oven' }).length, 0); });
test('recipe page: any-groups shown as X או Y and work label found via deviceAny (shipped data)', () => {
  const R = L.normalize(JSON.parse(fs.readFileSync(new URL('../data/recipes.json', import.meta.url)))); const W = { ninja_foodi: 1, microwave: 1 };
  const anyOnly = R.filter(r => r.deviceAny.length); assert.ok(anyOnly.length >= 10, String(anyOnly.length));
  for (const r of anyOnly) { const t = L.deviceText(r); assert.notEqual(t, 'בלי ציוד', r.id); assert.ok(r.deviceAny.every(g => g.length < 2 || t.includes(' או ')), r.id + ' ' + t);
    if (r.deviceAny.flat().some(d => d in W)) assert.ok(L.deviceKey(r, W), r.id); }
  assert.equal(L.deviceText({ devices: [], deviceAny: [['oven', 'ninja_foodi']] }), "תנור או נינג'ה פודי"); });
test('build output is deterministic (no timestamp)', () => { const d = JSON.parse(fs.readFileSync(new URL('../data/recipes.json', import.meta.url))); assert.ok(!('generated' in d)); });
test("equipment: short נינג'ה maps to ninja_foodi", () => {
  const o = mapEquipment({ id: 'n', equipment: ["נינג'ה"] }, 'n');
  assert.deepEqual(o.equipment, ['ninja_foodi']);
});
