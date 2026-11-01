// Pure logic (no DOM) — tested in tests/logic.test.mjs
export const MEALS = { breakfast: 'בוקר', shake: 'שייק', lunchbox: 'קופסה לעבודה', dinner: 'ערב' };
export const DEVICES = { ninja_foodi: "נינג'ה פודי", blender: "מיקסר נינג'ה", microwave: 'מיקרו', pan: 'מחבת', stovetop: 'כירה' };
const FR = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3 };
const UNITS = ['גרם', 'ק"ג', 'מ"ל', 'ליטר', 'כוס', 'כוסות', 'כף', 'כפות', 'כפית', 'כפיות', 'שיני', 'שן', 'גביע', 'גביעים', 'יחידות', 'פרוסות', 'קופסה', 'קופסאות', 'קורט'];
const num = s => { s = s.trim(); let v = 0; for (const p of s.split(/\s+/)) { if (FR[p] != null) v += FR[p]; else if (/^\d+(\.\d+)?$/.test(p)) v += +p; else if (/^\d+[½¼¾⅓⅔]$/.test(p)) v += +p.slice(0, -1) + FR[p.slice(-1)]; else if (/^\d+\/\d+$/.test(p)) { const [a, b] = p.split('/'); v += a / b; } else return null; } return v; };
export function parseIngredient(x) {
  if (x && typeof x === 'object') return { name: String(x.name || '').trim(), qty: x.qty ?? null, amount: typeof x.qty === 'number' ? x.qty : null, unit: x.unit || '' };
  const s = String(x || '').trim();
  const m = s.match(/^((?:\d+(?:[.\/]\d+)?[½¼¾⅓⅔]?|[½¼¾⅓⅔])(?:\s+[½¼¾⅓⅔])?)(?:[–-]\d+)?\s+(.*)$/);
  if (!m || /[–-]\d/.test(s.slice(0, m[1].length + 3))) return { name: s, qty: null, amount: null, unit: '' };
  let rest = m[2], unit = '';
  const u = UNITS.find(u => rest.startsWith(u + ' ')); if (u) { unit = u; rest = rest.slice(u.length + 1); }
  return { name: rest.trim(), qty: (m[1] + (unit ? ' ' + unit : '')).trim(), amount: num(m[1]), unit };
}
// Schema-tolerant: accepts {recipes:[...]} or [...], old (title/devices/prepMinutes/sourceUrl) or new (name/equipment/active_minutes/url) keys.
export function normalize(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.recipes) ? raw.recipes : []);
  const seen = new Set();
  return list.filter(r => r && typeof r === 'object').map((r, i) => {
    let id = String(r.id ?? 'r' + i); while (seen.has(id)) id += '_'; seen.add(id);
    const mealRaw = r.meal ?? ''; const meal = MEALS[mealRaw] ? mealRaw : (Object.keys(MEALS).find(k => MEALS[k] === mealRaw) || 'other');
    const devs = (r.equipment ?? r.devices ?? []).map(d => DEVICES[d] ? d : (Object.keys(DEVICES).find(k => DEVICES[k] === d) || d));
    const pm = r.active_minutes ?? r.prepMinutes ?? r.prep_minutes ?? null;
    const p = r.protein_g;
    return { id, title: String(r.name ?? r.title ?? 'ללא שם'), meal, devices: devs,
      prepMinutes: Number.isFinite(+pm) && pm !== null && pm !== '' ? +pm : null,
      ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).map(parseIngredient).filter(x => x.name),
      steps: Array.isArray(r.steps) ? r.steps.map(String) : [],
      sourceUrl: typeof (r.url ?? r.sourceUrl) === 'string' && /^https:\/\//.test(r.url ?? r.sourceUrl) ? (r.url ?? r.sourceUrl) : '',
      protein_g: typeof p === 'number' && p >= 0 ? p : null,
      proteinCalculated: r.protein_basis === 'calculated', proteinBasis: ['source', 'calculated'].includes(r.protein_basis) ? '' : (typeof r.protein_basis === 'string' ? r.protein_basis : ''),
      servings: r.servings ?? null, note: r.short_note || r.notes || '', ninjaBake: !!r.ninja_bake_adaptation, ninjaNote: typeof r.ninja_note === 'string' ? r.ninja_note : '' };
  });
}
// maxPrep: recipes with unknown prep time are excluded when a max is set (can't confirm they fit).
export function filterRecipes(rs, { meal = '', device = '', maxPrep = null } = {}) {
  return rs.filter(r => (!meal || r.meal === meal) && (!device || r.devices.includes(device)) && (maxPrep == null || (r.prepMinutes != null && r.prepMinutes <= maxPrep)));
}
// When a max time is set: recipes matching meal/device whose time is unknown (shown as a separate group).
export function unknownPrep(rs, { meal = '', device = '', maxPrep = null } = {}) {
  if (maxPrep == null) return [];
  return rs.filter(r => (!meal || r.meal === meal) && (!device || r.devices.includes(device)) && r.prepMinutes == null);
}
const norm = s => s.replace(/[׳'"״]/g, '').replace(/\s+/g, ' ').trim();
// Simple Hebrew singular/plural folding: ביצה/ביצים, עגבנייה/עגבניות -> same stem (words of 4+ letters only).
export const stem = s => norm(s).split(' ').map(w => w.length >= 4 ? w.replace(/(ים|ות|יה|ה)$/, '') : w).join(' ');
export function rankByPantry(rs, haveText) {
  const have = haveText.split(/[,\n،]+/).map(stem).filter(Boolean);
  if (!have.length) return [];
  return rs.map(r => { const hit = r.ingredients.filter(i => have.some(h => stem(i.name).includes(h)));
    return { r, hit: hit.length, total: r.ingredients.length, score: r.ingredients.length ? hit.length / r.ingredients.length : 0 }; })
    .filter(x => x.hit > 0).sort((a, b) => b.hit - a.hit || b.score - a.score);
}
export function shoppingList(rs, ids) {
  const map = new Map();
  for (const id of ids) { const r = rs.find(x => x.id === id); if (!r) continue;
    for (const i of r.ingredients) { const k = stem(i.name); const e = map.get(k) || { name: i.name, sums: {}, other: [], from: new Set() };
      if (i.amount != null) e.sums[i.unit] = (e.sums[i.unit] || 0) + i.amount; else if (i.qty) e.other.push(i.qty);
      e.from.add(r.title); map.set(k, e); } }
  return [...map.values()].map(e => ({ name: e.name, count: e.from.size,
    qty: [...Object.entries(e.sums).map(([u, v]) => `${Math.round(v * 100) / 100}${u ? ' ' + u : ''}`), ...e.other].join(' + ') }))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}
export const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayTotal = entries => (entries || []).reduce((s, e) => s + (+e.g || 0), 0);
// Streak: consecutive days reaching goal, ending today (or yesterday if today not yet reached).
export function streak(log, goal, today = new Date()) {
  if (!(goal > 0)) return 0; const d = new Date(today); let n = 0;
  if (dayTotal(log[dayKey(d)]) < goal) d.setDate(d.getDate() - 1);
  while (dayTotal(log[dayKey(d)]) >= goal) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function validBackup(o) { return o && typeof o === 'object' && o.app === 'recipes-app' && typeof o.state === 'object'; }
