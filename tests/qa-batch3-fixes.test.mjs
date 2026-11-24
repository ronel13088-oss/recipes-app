import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/recipes.json'), 'utf8'));
const byId = Object.fromEntries(raw.recipes.map(r => [r.id, r]));
// Known legacy offender (batch 2), left unchanged by decision; reported separately.
const LEGACY_SERVINGS = new Set(['date-oat-protein-balls']);

test('servings never contains the word מנות (UI appends it)', () => {
  const bad = raw.recipes.filter(r => !LEGACY_SERVINGS.has(r.id) && String(r.servings ?? '').includes('מנות')).map(r => r.id);
  assert.deepEqual(bad, []);
});
test('batch-3 servings fixed', () => {
  assert.equal(String(byId['mom-protein-crepes'].servings), '6');
  assert.equal(String(byId['dakot-omelette-tortilla'].servings), '1-2');
});
test('salmon marinade has oven or ninja equipment', () => {
  const s = byId['matkonit-salmon-marinade'];
  assert.deepEqual(s.equipment_any, [['oven', 'ninja_foodi']]);
  assert.equal(s.ninja_bake_adaptation, true);
});
test('omelette toppings line is OR over all toppings', () => {
  const line = byId['dakot-omelette-tortilla'].ingredients.find(i => i.text.startsWith('תוספות'));
  assert.deepEqual(line.canon_all, []);
  assert.deepEqual([...line.canon_any].sort(), ['בצל','גבינה צהובה','גבינת פטה','זיתים','עגבנייה','פטרוזיליה'].sort());
});
