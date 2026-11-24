import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import * as L from '../js/logic.js'; import * as Pn from '../js/pantry.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/recipes.json'), 'utf8'));
const R = L.normalize(raw);
const NEW = {
  'matkonit-yogurt-oat-pancake': 'פנקייק שיבולת שועל ויוגורט',
  'mom-protein-crepes': "קרפ חלבון עם קוטג' ואבקת חלבון",
  'dakot-omelette-tortilla': 'חביתה טורטיה ב-5 דקות',
  'onebody-strawberry-yogurt-shake': 'שייק/קערת תותים עם יוגורט חלבון',
  'proteins-banana-almond-shake': 'שייק חלבון עם בננה וחלב שקדים',
  'proteins-chicken-herbs-pan': 'חזה עוף במחבת עם עשבי תיבול',
  'mom-ninja-chicken-meatballs': "קציצות עוף בנינג'ה",
  'matkonit-chicken-pan-strips': 'חזה עוף עסיסי במחבת',
  'taimeta-ninja-salmon': "פילה סלמון בנינג'ה עם מרינדה",
  'matkonit-salmon-marinade': 'סלמון במרינדה משגעת',
};
const NULL_PROTEIN = ['mom-protein-crepes', 'dakot-omelette-tortilla', 'mom-ninja-chicken-meatballs', 'taimeta-ninja-salmon'];

test('batch 3: all 10 recipes present and normalize with title, ingredients, steps, labels', () => {
  const by = Object.fromEntries(R.map(r => [r.id, r]));
  const rawBy = Object.fromEntries(raw.recipes.map(r => [r.id, r]));
  for (const [id, title] of Object.entries(NEW)) {
    const r = by[id]; assert.ok(r, 'missing ' + id);
    assert.equal(r.title, title);
    assert.ok(r.ingredients.length, id + ' no ingredients after normalize');
    assert.ok(r.steps.length, id + ' no steps');
    assert.equal(typeof L.deviceText(r), 'string');
    assert.match(L.proteinLabel(r), /חלבון:/);
    assert.equal(r.ingredients.length, rawBy[id].ingredients.length, id + ' lost ingredients in normalize');
  }
});

test('batch 3: four recipes keep protein_g null by design', () => {
  const by = Object.fromEntries(raw.recipes.map(r => [r.id, r]));
  const n = Object.fromEntries(R.map(r => [r.id, r]));
  for (const id of NULL_PROTEIN) {
    assert.equal(by[id].protein_g, null, id + ' raw protein_g');
    assert.equal(n[id].protein_g, null, id + ' normalized protein_g');
    assert.equal(L.proteinLabel(n[id]), 'חלבון: לא ידוע');
  }
});

test('batch 3: tortilla canon is in aliases; ninja short token became ninja_foodi; mapping holds', () => {
  const aliases = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ingredient-aliases.json'), 'utf8'));
  assert.equal(aliases.aliases['טורטיה'], 'טורטיה');
  const by = Object.fromEntries(raw.recipes.map(r => [r.id, r]));
  assert.deepEqual(by['mom-ninja-chicken-meatballs'].equipment, ['ninja_foodi']);
  assert.deepEqual(by['taimeta-ninja-salmon'].equipment, ['ninja_foodi']);
  const A = Pn.loadAliases(aliases);
  const r = R.find(x => x.id === 'dakot-omelette-tortilla');
  assert.ok(Pn.needs(r, A).flatMap(x => x.alts).includes('טורטיה'));
  const vocab = new Set(Pn.vocabulary(R, A).map(v => v.name));
  assert.ok(vocab.has('טורטיה'), 'טורטיה missing from pantry vocab');
  const health = '/workspace/health/canon_ingredients.json';
  if (fs.existsSync(health)) {
    const canon = new Set(JSON.parse(fs.readFileSync(health, 'utf8')).map(e => e.canon));
    const missing = [];
    for (const rec of raw.recipes) {
      for (const g of rec.ingredients || []) {
        const names = [g.canon, ...(g.canon_all || []), ...(g.canon_any || [])].filter(n => typeof n === 'string' && n.trim());
        for (const n of names) if (!canon.has(n.trim())) missing.push(rec.id + ':' + n);
      }
    }
    assert.deepEqual(missing, []);
  }
});
