import { validEntry, validRecent, validFree, parseGoal, withUids, uniqueDay, MAX_DAYS, MAX_PER_DAY } from './protein.js';
// Pure logic (no DOM) — tested in tests/logic.test.mjs
export function proteinLabel(r) {
  if (r.protein_g == null) return 'חלבון: לא ידוע';
  const tag = r.proteinCalculated ? (r.proteinVerified === false ? ' (מחושב, לא מאומת)' : ' (מחושב)') : '';
  return `חלבון: ${r.protein_g} ג׳${tag}${r.proteinBasis ? ' (' + r.proteinBasis + ')' : ''}`;
}
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
      steps: normalizeSteps(r.steps), ...deviceRange(r),
      sourceUrl: typeof (r.url ?? r.sourceUrl) === 'string' && /^https:\/\//.test(r.url ?? r.sourceUrl) ? (r.url ?? r.sourceUrl) : '',
      protein_g: typeof p === 'number' && p >= 0 ? p : null,
      proteinCalculated: /^calculated/.test(String(r.protein_basis || '')), proteinVerified: typeof r.protein_verified === 'boolean' ? r.protein_verified : null,
      proteinBasis: typeof r.protein_note === 'string' ? r.protein_note : (typeof r.protein_basis === 'string' && !/^(source|calculated)/.test(r.protein_basis) ? r.protein_basis : ''),
      proteinCalc: r.protein_calc && Array.isArray(r.protein_calc.items) ? { servings: r.protein_calc.servings ?? null, total_g: r.protein_calc.total_g ?? null,
        items: r.protein_calc.items.filter(x => x && typeof x === 'object').map(x => ({ ingredient: String(x.ingredient ?? ''), grams: x.grams ?? null, per100: x.usda_protein_per_100g ?? null, protein_g: x.protein_g ?? null })) } : null,
      totalMinutes: Number.isFinite(r.total_minutes) ? r.total_minutes : null, timeNote: typeof r.time_note === 'string' ? r.time_note : '',
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
// Whole-word match: every token of the (stemmed) query phrase appears contiguously as whole tokens in the ingredient.
export function hasPhrase(name, phrase) { const a = name.split(' '), b = phrase.split(' ').filter(Boolean); if (!b.length) return false;
  for (let i = 0; i + b.length <= a.length; i++) if (b.every((t, j) => a[i + j] === t)) return true; return false; }
export function rankByPantry(rs, haveText) {
  const have = haveText.split(/[,\n،]+/).map(stem).filter(Boolean);
  if (!have.length) return [];
  return rs.map(r => { const hit = r.ingredients.filter(i => have.some(h => hasPhrase(stem(i.name), h)));
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
const isNum = x => typeof x === 'number' && Number.isFinite(x);
export function validBackup(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.app !== 'recipes-app') return false;
  const st = o.state; if (!st || typeof st !== 'object' || Array.isArray(st)) return false;
  if (!Array.isArray(st.plan) || !st.plan.every(x => typeof x === 'string')) return false;
  if (!st.log || typeof st.log !== 'object' || Array.isArray(st.log)) return false;
  for (const v of Object.values(st.log)) if (!Array.isArray(v) || !v.every(e => e && typeof e === 'object' && !Array.isArray(e) && (st.v === 2 || isNum(e.g)))) return false;
  if (Object.keys(st.log).length > MAX_DAYS || Object.values(st.log).some(v => v.length > MAX_PER_DAY)) return false;
  if (st.v === 2) { if (!(st.goal === null || parseGoal(st.goal) === st.goal)) return false;
    if (!validRecent(st.recent) || !validFree(st.free)) return false;
    if (st.checked !== undefined && !(Array.isArray(st.checked) && st.checked.every(x => typeof x === 'string'))) return false;
    for (const [k, v] of Object.entries(st.log)) if (!/^\d{4}-\d\d-\d\d$/.test(k) || v.length > MAX_PER_DAY || !v.every(validEntry) || !uniqueDay(v)) return false;
    return true; }
  return isNum(st.goal) && st.goal > 0;
}
// Convert a validated backup (v1 or v2) into current state shape.
export function importState(o) { const st = o.state;
  if (st.v === 2) return { v: 2, plan: [...st.plan], goal: st.goal, log: Object.fromEntries(Object.entries(st.log).map(([k, v]) => [k, withUids(v)])), recent: structuredClone(st.recent), free: structuredClone(st.free), checked: [...(st.checked || [])] };
  const log = {}; for (const [k, v] of Object.entries(st.log)) log[k] = withUids(v.map((e, i) => ({ type: 'custom', name: (typeof e.label === 'string' && e.label.replace(/\s+/g, ' ').trim().slice(0, 60)) || 'ידני', g: e.g >= 0 && e.g <= 300 ? Math.round(e.g * 10) / 10 : null, servings: 1, ts: i })));
  return { v: 2, plan: [...st.plan], goal: null, log, recent: [], free: [], checked: [] }; } // v1 goal dropped: no-default rule

// Steps: accepts strings (old) or {text, timer_min} objects (new). Empty/missing text -> skipped. timer_min must be a positive finite number (<=600) else null.
const posMin = (x, max = 600) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= max ? x : null;
export function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map(s => { if (typeof s === 'string') return { text: s.trim(), timer_min: null, timer_max: null };
    if (!s || typeof s !== 'object' || typeof s.text !== 'string') return null;
    const a = posMin(s.timer_min ?? s.timer_minutes), b = a == null ? null : posMin(s.timer_max);
    return { text: s.text.trim(), timer_min: a, timer_max: b != null && b > a ? b : null }; }) // countdown (cook mode) starts from timer_min
    .filter(s => s && s.text);
}
// Device time: only from device_min/device_max fields (never derived). Single value -> min=max. Invalid -> null (block hidden).
export function deviceRange(r) {
  let a = posMin(r?.device_min), b = posMin(r?.device_max);
  if (a == null && b == null) return { deviceMin: null, deviceMax: null, devicePartial: false };
  if (a == null) a = b; if (b == null) b = a; if (a > b) [a, b] = [b, a];
  return { deviceMin: a, deviceMax: b, devicePartial: r.device_partial === true };
}
// Dial: stops 5/10/20/30; 30 = "הכול" (no max).
export const STOPS = [5, 10, 20, 30];
export const snapStop = v => STOPS.reduce((best, s) => Math.abs(s - v) < Math.abs(best - v) ? s : best, STOPS[0]);
export const stopToMax = s => s >= 30 ? null : s;
export const stepStop = (cur, dir) => STOPS[Math.max(0, Math.min(STOPS.length - 1, STOPS.indexOf(snapStop(cur)) + dir))];
// angle (deg, 0 = 12 o'clock, clockwise) -> minutes 0..30
export const angleToMinutes = deg => ((deg % 360) + 360) % 360 / 360 * 30;
export const fmtRange = (a, b) => a === b ? `${a}′` : `${a}–${b}′`;
// Cook-mode countdown: starts from timer_min; after it ends, a range step shows the remaining upper bound.
export const countdownStart = s => s?.timer_min ?? null;
export const afterCountdown = s => s?.timer_min != null && s.timer_max != null ? `עוד עד ${s.timer_max - s.timer_min} דק׳` : null;
