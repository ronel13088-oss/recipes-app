// "מה יש בבית" — pure logic (no DOM). Ingredient -> canonical name, pantry staples, matching and ranking.
// Canonical source order: ingredient.canon (from data) > data/ingredient-aliases.json (raw text -> canon) > interim cleanup below.
export const PANTRY_KEY = 'pantry_items', PANTRY_MAX = 200, ITEM_MAX = 40;
const QTY_WORDS = /^(?:(?:חצי|רבע|שליש|קורט|קמצוץ|מעט|קצת|חופן|צרור|סקופ(?:ים)?|מנת|מנה|חבילת|חבילה|מגש|קופסה|גדושה|כף|כפות|כפית|כפיות|כוס|כוסות|אחת|של|קטן|קטנה|גדול|גדולה|בינוני|בינונית)\s+)+/;
const DESC = /\s+(?:קצוצ(?:ה|ים|ות)?|קצוץ|דק|פרוס(?:ה|ים|ות)?|חתוכ(?:ה|ים|ות)?|חתוך|מגורד(?:ת)?|כתוש(?:ה|ות)?|טרי(?:ה|ים|ות)?|קפוא(?:ה|ים|ות)?|מבושל(?:ים|ת)?|לפי הטעם|לקישוט|להגשה|גס|גרוס|טחון)\b.*$/;
// Interim normalization: strip parentheses, text after comma/dash/colon, leading quantity words and trailing prep descriptors.
export function cleanName(name) {
  let s = String(name ?? '').replace(/[\u0591-\u05C7]/g, '').replace(/\([^)]*\)/g, ' ').replace(/[׳'`’]/g, '׳').split(/[,–:]| - |\//)[0];
  s = s.replace(/^[\d.,½¼¾⅓⅔\s-]+/, '').replace(QTY_WORDS, '').replace(/\s+/g, ' ').trim();
  return s.replace(DESC, '').trim();
}
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
export function loadAliases(raw) { const a = isObj(raw) && isObj(raw.aliases) ? raw.aliases : {}; const aliases = Object.create(null);
  for (const [k, v] of Object.entries(a)) if (typeof v === 'string' && v.trim()) aliases[k.trim()] = v.trim();
  return { aliases, staples: new Set(isObj(raw) && Array.isArray(raw.staples) ? raw.staples.filter(x => typeof x === 'string') : []) }; }
// i: normalized ingredient {name, raw?, canon?, pantryBasic?}. Returns {canon, staple, via}.
export function canonOf(i, A) {
  const raw = (i.raw ?? i.name ?? '').trim();
  let canon = typeof i.canon === 'string' && i.canon.trim() ? i.canon.trim() : null, via = 'data';
  if (!canon && Object.hasOwn(A.aliases, raw)) { canon = A.aliases[raw]; via = 'alias'; }
  if (!canon) { canon = cleanName(i.name ?? raw); via = 'interim'; }
  return { canon, staple: i.pantryBasic === true || A.staples.has(canon), via };
}
// Requirements of a recipe: [{canon (display name), alts: [names, any one satisfies], staple}], deduped by alts.
// canon_all (every name required) > canon_any (one 'or' requirement) > single canon.
export function needs(r, A) { const m = new Map(); const add = (alts, basic) => { alts = [...new Set(alts)].filter(Boolean); if (!alts.length) return;
    const k = [...alts].sort().join('|'); const staple = basic === true || alts.some(x => A.staples.has(x)); const p = m.get(k);
    m.set(k, { canon: alts.join(' / '), alts, staple: staple || (p?.staple ?? false) }); };
  // canon_any (non-empty) wins: one of them suffices; else canon_all: each is required. Teammate data repeats alternatives in canon_all, so any must come first.
  for (const i of r.ingredients) { if (i.canonAny) add(i.canonAny, i.pantryBasic); else if (i.canonAll) i.canonAll.forEach(c => add([c], A.staples.has(c))); else { const c = canonOf(i, A); add([c.canon], c.staple); } }
  return [...m.values()]; }
// Picker vocabulary: every non-staple canonical name, with how many recipes use it.
export function vocabulary(rs, A) { const n = new Map(); for (const r of rs) { const seen = new Set(); for (const x of needs(r, A)) if (!x.staple) for (const c of x.alts) if (!A.staples.has(c) && !seen.has(c)) { seen.add(c); n.set(c, (n.get(c) || 0) + 1); } }
  return [...n].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he')); }
export const stapleList = (rs, A) => [...new Set(rs.flatMap(r => needs(r, A).filter(x => x.staple).map(x => x.canon)))].sort((a, b) => a.localeCompare(b, 'he'));
// Note: a recipe whose requirements are all staples has 0 non-staple needs, so matched=0 and it never shows (by design).
// Exact canonical match only (no substrings: חלב never matches חלבון). Empty pantry -> [] (never "יש הכול").
export const MAX_MISSING = 2;
// Full matches first, then recipes missing 1..maxMissing items (missing names listed). Others are dropped.
export function rank(rs, have, A, maxMissing = MAX_MISSING) {
  const H = new Set(have); if (!H.size) return [];
  return rs.map(r => { const ns = needs(r, A).filter(x => !x.staple); const ok = x => x.alts.some(c => H.has(c));
      return { r, matched: ns.filter(ok).map(x => x.canon), missing: ns.filter(x => !ok(x)).map(x => x.canon), total: ns.length }; })
    .filter(x => x.matched.length > 0 && x.missing.length <= maxMissing)
    .sort((a, b) => a.missing.length - b.missing.length || b.matched.length - a.matched.length || a.r.title.localeCompare(b.r.title, 'he'));
}
// Picker items: vocabulary plus saved pantry names not in it (e.g. after a data/alias change) so they stay visible and removable by tap.
export const pickerItems = (vocab, saved) => { const k = new Set(vocab.map(v => v.name)); return [...saved.filter(n => !k.has(n)).map(name => ({ name, count: 0 })), ...vocab]; };
export const filterVocab = (vocab, q) => { const s = String(q ?? '').trim(); return s ? vocab.filter(v => v.name.includes(s)) : vocab; };
export function validPantry(v) { return Array.isArray(v) && v.length <= PANTRY_MAX && v.every(x => typeof x === 'string' && x.trim() === x && x.length >= 1 && x.length <= ITEM_MAX) && new Set(v).size === v.length; }
export const toggle = (list, name) => list.includes(name) ? list.filter(x => x !== name) : (list.length < PANTRY_MAX && name && name.length <= ITEM_MAX ? [...list, name] : list);
// Names to add to the free shopping list: skip ones already there (free items) or already covered by a planned recipe's ingredients.
export function toShop(missing, free, planned = []) { const have = new Set([...free.map(f => f.text.trim()), ...planned]); const out = [];
  for (const m of missing) if (!have.has(m)) { have.add(m); out.push(m); } return out; }
