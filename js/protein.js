// Pure protein-goal / daily log / custom entries / free shopping items (no DOM). Spec: final_D/spec_he.md.
export const GOAL_KEY = 'protein_goal_g', LOG_PREFIX = 'protein_log_', RECENT_KEY = 'custom_recent', FREE_KEY = 'shopping_free_items';
export const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const logKey = d => LOG_PREFIX + dayKey(d);
const isNum = x => typeof x === 'number' && Number.isFinite(x);
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
// Goal: integer 1..400, no default. Returns number or null.
export function parseGoal(v) { if (v === '' || v == null) return null; const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 400 ? n : null; }
// Grams: '' -> null (unknown); 0..300 with at most 1 decimal; otherwise undefined (invalid).
export function parseGrams(v) { if (v === '' || v == null) return null;
  if (typeof v === 'string') { if (!/^\s*\d+(\.\d)?\s*$/.test(v)) return undefined; v = Number(v); }
  return isNum(v) && v >= 0 && v <= 300 && Math.round(v * 10) === v * 10 ? v : undefined; }
export const NAME_MAX = 60;
export function parseName(v) { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s && s.length <= NAME_MAX ? s : null; }
export const parseServings = v => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null; };
export function recipeEntry(r, ts = Date.now()) { return { id: r.id, g: isNum(r.protein_g) ? r.protein_g : null, basis: r.protein_g == null ? null : (r.proteinCalculated ? 'calculated' : 'source'), ts }; }
// Returns entry or {error}.
export function customEntry({ name, g, servings = 1 }, ts = Date.now()) {
  const n = parseName(name); if (!n) return { error: 'name' };
  const grams = parseGrams(g); if (grams === undefined) return { error: 'grams' };
  const s = parseServings(servings); if (!s) return { error: 'servings' };
  return { type: 'custom', name: n, g: grams, servings: s, ts }; }
export const entryGrams = e => isNum(e.g) ? (e.type === 'custom' ? e.g * e.servings : e.g) : null;
// Sum: null g never counted; approx only if a counted recipe entry is not from source.
export function daySum(entries) { const e = Array.isArray(entries) ? entries : []; const counted = e.filter(x => entryGrams(x) != null);
  return { g: Math.round(counted.reduce((s, x) => s + entryGrams(x), 0) * 10) / 10, approx: counted.some(x => x.type !== 'custom' && x.basis !== 'source'), unknown: e.length - counted.length, n: e.length }; }
export function ring(sum, goal) { if (!(goal > 0)) return null; return { pct: Math.min(100, sum / goal * 100), left: Math.max(0, Math.round((goal - sum) * 10) / 10), over: Math.max(0, Math.round((sum - goal) * 10) / 10) }; }
export function staleKeys(keys, today = new Date()) { const cut = new Date(today); cut.setDate(cut.getDate() - 30); const c = dayKey(cut);
  return keys.filter(k => k.startsWith(LOG_PREFIX) && /^\d{4}-\d\d-\d\d$/.test(k.slice(LOG_PREFIX.length)) && k.slice(LOG_PREFIX.length) < c); }
// custom_recent: max 8, unique by name, newest first.
export function pushRecent(list, { name, g }) { const r = (Array.isArray(list) ? list : []).filter(x => x.name !== name); r.unshift({ name, g }); return r.slice(0, 8); }
export function validEntry(x) { if (!isObj(x) || !isNum(x.ts)) return false;
  if (x.type === 'custom') return parseName(x.name) === x.name && (x.g === null || parseGrams(x.g) === x.g) && parseServings(x.servings) === x.servings;
  return typeof x.id === 'string' && x.id.length <= 100 && (x.g === null || (isNum(x.g) && x.g >= 0 && x.g <= 1000)) && [null, 'source', 'calculated'].includes(x.basis ?? null); }
export const validRecent = l => Array.isArray(l) && l.length <= 8 && l.every(x => isObj(x) && parseName(x.name) === x.name && (x.g === null || parseGrams(x.g) === x.g)) && new Set(l.map(x => x.name)).size === l.length;
export const validFree = l => Array.isArray(l) && l.length <= 500 && l.every(x => isObj(x) && parseName(x.text) === x.text && typeof x.done === 'boolean' && isNum(x.ts));
export function addFree(list, text, ts = Date.now()) { const t = parseName(text); return t ? [...list, { text: t, done: false, ts }] : list; }
export const clearDone = list => list.filter(x => !x.done);
