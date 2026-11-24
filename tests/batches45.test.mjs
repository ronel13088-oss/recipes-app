import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import * as L from '../js/logic.js'; import * as Pn from '../js/pantry.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/recipes.json'), 'utf8'));
const R = L.normalize(raw);
const NEW = {
  'gila-microwave-eggs-cheese': 'ביצים במיקרוגל עם גבינה וירקות',
  'clean-cottage-scrambled-eggs': "ביצים מקושקשות עם קוטג' (מתורגם)",
  'everyvit-banana-almond-shake': 'שייק חלבון בננה ושקדים',
  'missageless-protein-coffee-shake': 'שייק חלבון בטעם קפה',
  'olivetomato-chickpea-tuna-salad': 'סלט טונה וחומוס ים-תיכוני ב-5 דקות (מתורגם)',
  'mom-lemon-garlic-chicken-pan': 'חזה עוף במחבת עם מרינדת לימון ושום',
  'foodislove-turkey-shawarma-10min': 'שווארמה הודו במחבת בעשר דקות',
  'foodis-fried-rice-leftover-chicken': 'אורז מוקפץ עם שאריות עוף',
  'gila-tuna-pasta-8-ingredients': 'פסטה טונה ב-8 מרכיבים',
  'dailybis-cottage-egg-toast': "טוסט קוטג' וביצה עם סלט קצוץ",
  'dailybis-spinach-feta-omelette': 'חביתת חלבונים עם תרד, פטריות ופטה',
  'dailybis-banana-pb-protein-shake': 'שייק חלבון בננה וחמאת בוטנים',
  'foodik-pineapple-protein-shake-50g': 'שייק אננס עם 50 גרם חלבון',
  'dailybis-lentil-feta-egg-salad': 'סלט עדשים, פטה וביצה קשה',
  'dailybis-tahini-chicken-bulgur': 'עוף בטחינה ולימון עם בורגול',
  'dailybis-tuna-rice-edamame-bowl': 'קערת טונה, אורז ואדממה',
  'dailybis-pan-salmon-asparagus': 'סלמון במחבת עם אספרגוס ולימון',
  'dakot-ninja-pasta-chicken': "פסטה ועוף בנינג'ה",
  'taimeta-ninja-airfry-chicken-fillet': "פילה עוף בטיגון אוויר חם בנינג'ה",
};

test('batches 4+5: 79 recipes after batch 3, expected sources, unique ids and titles', () => {
  assert.equal(raw.count, 79); assert.equal(raw.recipes.length, 79); assert.equal(R.length, 79);
  assert.deepEqual([...raw.sources].sort(), ['recipes-batch2.json', 'recipes-batch3.json', 'recipes-batch4.json', 'recipes-batch5.json', 'recipes.json']);
  assert.equal(new Set(raw.recipes.map(r => r.id)).size, 79);
  assert.equal(new Set(raw.recipes.map(r => r.name)).size, 79);
});

test('batches 4+5: all 19 new recipes present and normalize with title, ingredients, steps, labels', () => {
  const by = Object.fromEntries(R.map(r => [r.id, r]));
  for (const [id, title] of Object.entries(NEW)) {
    const r = by[id]; assert.ok(r, 'missing ' + id);
    assert.equal(r.title, title);
    assert.ok(r.ingredients.length, id + ' no ingredients after normalize');
    assert.ok(r.steps.length, id + ' no steps');
    assert.equal(typeof L.deviceText(r), 'string');
    assert.match(L.proteinLabel(r), /חלבון:/);
  }
  const rawBy = Object.fromEntries(raw.recipes.map(r => [r.id, r]));
  for (const id of Object.keys(NEW)) {
    assert.equal(by[id].ingredients.length, rawBy[id].ingredients.length, id + ' lost ingredients in normalize');
  }
});

test('every ingredient line maps to a named canon; new canons are in the alias map', () => {
  const aliases = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ingredient-aliases.json'), 'utf8'));
  const aliasCanons = new Set(Object.values(aliases.aliases));
  const used = new Set();
  for (const r of raw.recipes) {
    (r.ingredients || []).forEach((g, i) => {
      const names = [g.canon, ...(g.canon_all || []), ...(g.canon_any || [])].filter(n => typeof n === 'string' && n.trim());
      assert.ok(names.length, `${r.id}[${i}] has no canon`);
      names.forEach(n => used.add(n.trim()));
    });
  }
  const extra = ['אבוקדו', 'אבקת מרק', 'אדממה', 'אספרגוס', 'בורגול', 'חלבון ביצה', 'טחינה', 'לחם מלא', 'ליים', 'מעדן חלבון', 'עדשים מבושלות', 'פסיפלורה',
    'גבינה צהובה', 'זיתים', 'חומץ בלסמי', 'חזה הודו', 'ירקות קפואים', 'פיתה', 'צלפים'];
  for (const c of extra) assert.ok(aliasCanons.has(c), 'new canon missing from aliases: ' + c);
  const health = '/workspace/health/canon_ingredients.json';
  if (fs.existsSync(health)) {
    const canon = new Set(JSON.parse(fs.readFileSync(health, 'utf8')).map(e => e.canon));
    const missing = [...used].filter(n => !canon.has(n));
    assert.deepEqual(missing, [], 'ingredients with unknown canon: ' + missing.join(', '));
  }
});

test('pantry.js ranks new batch recipes by new canon names', () => {
  const A = Pn.loadAliases(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ingredient-aliases.json'), 'utf8')));
  const by = Object.fromEntries(R.map(r => [r.id, r]));
  const canons = r => Pn.needs(r, A).flatMap(x => x.alts);
  assert.ok(canons(by['dailybis-tahini-chicken-bulgur']).includes('טחינה'));
  assert.ok(canons(by['dailybis-tahini-chicken-bulgur']).includes('בורגול'));
  assert.ok(canons(by['foodislove-turkey-shawarma-10min']).includes('טחינה'));
  assert.ok(canons(by['foodislove-turkey-shawarma-10min']).includes('חזה הודו'));
  assert.ok(canons(by['dailybis-tuna-rice-edamame-bowl']).includes('אבוקדו'));
  assert.ok(canons(by['dailybis-pan-salmon-asparagus']).includes('אספרגוס'));
  const have = (id, extra = []) => {
    const ns = Pn.needs(by[id], A).filter(x => !x.staple).flatMap(x => x.alts);
    return Pn.rank(R, [...new Set([...ns, ...extra])], A).map(x => x.r.id);
  };
  assert.ok(have('dailybis-tahini-chicken-bulgur').includes('dailybis-tahini-chicken-bulgur'));
  assert.ok(have('foodislove-turkey-shawarma-10min').includes('foodislove-turkey-shawarma-10min'));
  assert.ok(have('dailybis-tuna-rice-edamame-bowl').includes('dailybis-tuna-rice-edamame-bowl'));
  assert.ok(have('dailybis-pan-salmon-asparagus').includes('dailybis-pan-salmon-asparagus'));
  const vocab = new Set(Pn.vocabulary(R, A).map(v => v.name));
  for (const c of ['אבוקדו', 'טחינה', 'לחם מלא', 'אדממה', 'פסיפלורה', 'מעדן חלבון', 'עדשים מבושלות', 'חלבון ביצה', 'בורגול', 'אספרגוס', 'ליים', 'אבקת מרק', 'גבינה צהובה', 'זיתים', 'חומץ בלסמי', 'חזה הודו', 'ירקות קפואים', 'פיתה', 'צלפים'])
    assert.ok(vocab.has(c), 'missing from pantry vocab: ' + c);
});
