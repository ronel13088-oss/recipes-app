// localStorage persistence using the spec keys. All reads are validated; bad data is ignored, never trusted.
import * as P from './protein.js';
const PLAN_KEY = 'recipes-app:v1';
const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export function plan() { const o = get(PLAN_KEY); return { plan: Array.isArray(o?.plan) ? o.plan.filter(x => typeof x === 'string') : [], checked: Array.isArray(o?.checked) ? o.checked.filter(x => typeof x === 'string') : [] }; }
export const savePlan = (p) => { const o = get(PLAN_KEY) || {}; set(PLAN_KEY, { ...o, plan: p.plan, checked: p.checked }); };
export const goal = () => P.parseGoal(localStorage.getItem(P.GOAL_KEY));
export const setGoal = g => g == null ? localStorage.removeItem(P.GOAL_KEY) : localStorage.setItem(P.GOAL_KEY, String(g));
export function today(d = new Date()) { const v = get(P.logKey(d)); return Array.isArray(v) ? v.filter(P.validEntry) : []; }
export const setToday = (list, d = new Date()) => set(P.logKey(d), list);
export const recent = () => { const v = get(P.RECENT_KEY); return P.validRecent(v) ? v : []; };
export const setRecent = v => set(P.RECENT_KEY, v);
export const free = () => { const v = get(P.FREE_KEY); return P.validFree(v) ? v : []; };
export const setFree = v => set(P.FREE_KEY, v);
export function prune(d = new Date()) { const keys = []; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); P.staleKeys(keys, d).forEach(k => localStorage.removeItem(k)); }
export function exportState() { const log = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P.LOG_PREFIX)) { const v = get(k); if (Array.isArray(v)) log[k.slice(P.LOG_PREFIX.length)] = v.filter(P.validEntry); } }
  const p = plan(); return { v: 2, plan: p.plan, checked: p.checked, goal: goal(), log, recent: recent(), free: free() }; }
export function importState(st) { for (const k of Object.keys(localStorage)) if (k.startsWith(P.LOG_PREFIX)) localStorage.removeItem(k);
  savePlan({ plan: st.plan, checked: st.checked || [] }); setGoal(st.goal); for (const [d, v] of Object.entries(st.log)) set(P.LOG_PREFIX + d, v); setRecent(st.recent); setFree(st.free); }
