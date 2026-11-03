// localStorage persistence using the spec keys. All reads are validated; bad data is ignored, never trusted.
import * as P from './protein.js';
const PLAN_KEY = 'recipes-app:v1';
const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export function plan() { const o = get(PLAN_KEY); return { plan: Array.isArray(o?.plan) ? o.plan.filter(x => typeof x === 'string') : [], checked: Array.isArray(o?.checked) ? o.checked.filter(x => typeof x === 'string') : [] }; }
export const savePlan = (p) => { const o = get(PLAN_KEY) || {}; set(PLAN_KEY, { ...o, plan: p.plan, checked: p.checked }); };
export const goal = () => P.parseGoal(localStorage.getItem(P.GOAL_KEY));
export const setGoal = g => g == null ? localStorage.removeItem(P.GOAL_KEY) : localStorage.setItem(P.GOAL_KEY, String(g));
export function today(d = new Date()) { const v = get(P.logKey(d)); if (!Array.isArray(v)) return []; const l = v.filter(P.validEntry);
  if (l.some(e => !e.uid) || !P.uniqueDay(l)) { const m = P.withUids(l); try { set(P.logKey(d), m); } catch {} return m; } return l; } // migrate old entries to uids
export const setToday = (list, d = new Date()) => set(P.logKey(d), list);
export const recent = () => { const v = get(P.RECENT_KEY); return P.validRecent(v) ? v : []; };
export const setRecent = v => set(P.RECENT_KEY, v);
export const free = () => { const v = get(P.FREE_KEY); return P.validFree(v) ? v : []; };
export const setFree = v => set(P.FREE_KEY, v);
export function prune(d = new Date()) { const keys = []; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); P.staleKeys(keys, d).forEach(k => localStorage.removeItem(k)); }
export function exportState() { const log = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P.LOG_PREFIX)) { const v = get(k); if (Array.isArray(v)) log[k.slice(P.LOG_PREFIX.length)] = v.filter(P.validEntry); } }
  const p = plan(); return { v: 2, plan: p.plan, checked: p.checked, goal: goal(), log, recent: recent(), free: free() }; }
const ownKey = k => k === PLAN_KEY || k === P.GOAL_KEY || k === P.RECENT_KEY || k === P.FREE_KEY || k.startsWith(P.LOG_PREFIX);
// Atomic-ish import: snapshot every app key, write, and on any error (e.g. QuotaExceededError) restore the snapshot and rethrow.
export function importState(st, ls = localStorage) { const keys = []; for (let i = 0; i < ls.length; i++) keys.push(ls.key(i));
  const snap = keys.filter(ownKey).map(k => [k, ls.getItem(k)]);
  const wipe = () => { const ks = []; for (let i = 0; i < ls.length; i++) ks.push(ls.key(i)); ks.filter(ownKey).forEach(k => ls.removeItem(k)); };
  try { wipe(); const o = (() => { try { return JSON.parse(ls.getItem(PLAN_KEY)); } catch { return null; } })() || {};
    ls.setItem(PLAN_KEY, JSON.stringify({ ...o, plan: st.plan, checked: st.checked || [] }));
    if (st.goal != null) ls.setItem(P.GOAL_KEY, String(st.goal));
    for (const [d, v] of Object.entries(st.log)) ls.setItem(P.LOG_PREFIX + d, JSON.stringify(v));
    ls.setItem(P.RECENT_KEY, JSON.stringify(st.recent)); ls.setItem(P.FREE_KEY, JSON.stringify(st.free));
  } catch (e) { try { wipe(); for (const [k, v] of snap) ls.setItem(k, v); } catch {} throw e; } }
export function hasData(ls = localStorage) { for (let i = 0; i < ls.length; i++) if (ownKey(ls.key(i))) return true; return false; }
