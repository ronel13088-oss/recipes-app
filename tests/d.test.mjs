import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import * as L from '../js/logic.js'; import * as P from '../js/protein.js';
class FakeLS { constructor(o = {}, quotaAfter = Infinity) { this.m = new Map(Object.entries(o)); this.writes = 0; this.quotaAfter = quotaAfter; }
  get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { const size = [...this.m].reduce((n, [a, b]) => n + (a === k ? 0 : a.length + b.length), 0) + k.length + String(v).length; if (size > this.quotaAfter) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
globalThis.localStorage = new FakeLS(); const St = await import('../js/store.js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/recipes.json'), 'utf8')).recipes; const R = L.normalize(RAW);
test('steps: strings (old) and {text,timer_min} objects both accepted', () => {
  assert.deepEqual(L.normalizeSteps(['a', ' b ']), [{ text: 'a', timer_min: null, timer_max: null }, { text: 'b', timer_min: null, timer_max: null }]);
  assert.deepEqual(L.normalizeSteps([{ text: 'x', timer_min: 12 }, 'y']), [{ text: 'x', timer_min: 12, timer_max: null }, { text: 'y', timer_min: null, timer_max: null }]); });
test('steps: missing/empty text skipped, garbage no crash', () => {
  assert.deepEqual(L.normalizeSteps([{ timer_min: 5 }, { text: '' }, { text: '   ' }, '', null, 5, [], { text: 7 }, { text: 'ok' }]), [{ text: 'ok', timer_min: null, timer_max: null }]);
  assert.deepEqual(L.normalizeSteps(null), []); assert.deepEqual(L.normalizeSteps('x'), []); });
test('steps: timer_min missing / non-positive / NaN / string -> null (no dial)', () => {
  for (const t of [undefined, null, 0, -3, NaN, Infinity, '10', 601, {}]) assert.equal(L.normalizeSteps([{ text: 'a', timer_min: t }])[0].timer_min, null, String(t));
  assert.equal(L.normalizeSteps([{ text: 'a', timer_minutes: 4 }])[0].timer_min, 4); });
test('device range: null unless given, single value -> min=max, never derived from total', () => {
  assert.deepEqual(L.deviceRange({ total_minutes: 30, active_minutes: 10 }), { deviceMin: null, deviceMax: null, devicePartial: false });
  assert.deepEqual(L.deviceRange({ device_min: 12, device_max: 15 }), { deviceMin: 12, deviceMax: 15, devicePartial: false });
  assert.deepEqual(L.deviceRange({ device_min: 8 }), { deviceMin: 8, deviceMax: 8, devicePartial: false });
  assert.equal(L.deviceRange({ device_min: 0, device_max: -1 }).deviceMin, null); assert.equal(L.deviceRange({ device_min: 5, device_max: 9, device_partial: true }).devicePartial, true); });
test('real data: device & timer counts match raw source; step texts preserved', () => {
  assert.equal(R.filter(r => r.deviceMin != null).length, RAW.filter(r => typeof r.device_min === 'number' && r.device_min > 0).length);
  const rawT = RAW.flatMap(r => r.steps).filter(s => typeof s === 'object' && typeof s.timer_min === 'number' && s.timer_min > 0).length;
  assert.equal(R.flatMap(r => r.steps).filter(s => s.timer_min != null).length, rawT);
  RAW.forEach((r, i) => assert.deepEqual(R[i].steps.map(s => s.text), r.steps.map(s => (typeof s === 'string' ? s : s.text).trim()).filter(Boolean))); });
test('dial stops: snap, step, 30 = all', () => { assert.equal(L.snapStop(7), 5); assert.equal(L.snapStop(8), 10); assert.equal(L.snapStop(16), 20); assert.equal(L.snapStop(26), 30);
  assert.equal(L.stopToMax(30), null); assert.equal(L.stopToMax(20), 20); assert.equal(L.stepStop(10, 1), 20); assert.equal(L.stepStop(5, -1), 5); assert.equal(L.stepStop(30, 1), 30);
  assert.equal(L.angleToMinutes(180), 15); assert.equal(L.angleToMinutes(-90), 22.5); });
test('protein goal: unset by default, int 1..400 only', () => { assert.equal(P.parseGoal(null), null); assert.equal(P.parseGoal(''), null);
  for (const b of ['0', '401', '12.5', 'abc', '-5', '1e2', '0x10', ' ', '+5']) assert.equal(P.parseGoal(b), null, b); assert.equal(P.parseGoal('120'), 120); assert.equal(P.parseGoal('400'), 400); assert.equal(P.ring(50, null), null); });
test('ring: capped at 100%, over/left', () => { assert.deepEqual(P.ring(60, 120), { pct: 50, left: 60, over: 0 }); assert.deepEqual(P.ring(150, 120), { pct: 100, left: 0, over: 30 }); });
test('eat: recipe entry; null protein logged but not counted; calculated -> approx', () => {
  const src = P.recipeEntry({ id: 'a', protein_g: 48, proteinCalculated: false }, 1), calc = P.recipeEntry({ id: 'b', protein_g: 11, proteinCalculated: true }, 2), unk = P.recipeEntry({ id: 'c', protein_g: null }, 3);
  assert.deepEqual(P.daySum([src]), { g: 48, approx: false, unknown: 0, n: 1 }); assert.deepEqual(P.daySum([src, calc, unk]), { g: 59, approx: true, unknown: 1, n: 3 });
  assert.ok([src, calc, unk].every(P.validEntry)); });
test('undo: removing last entry restores sum', () => { const l = [P.recipeEntry({ id: 'a', protein_g: 20 }, 1), P.recipeEntry({ id: 'b', protein_g: 30 }, 2)]; l.pop(); assert.equal(P.daySum(l).g, 20); l.pop(); assert.equal(P.daySum(l).g, 0); });
test('day rollover: local-date keys differ across midnight; stale >30d pruned', () => {
  const a = new Date(2026, 10, 1, 23, 59), b = new Date(2026, 10, 2, 0, 0); assert.notEqual(P.logKey(a), P.logKey(b)); assert.equal(P.logKey(b), 'protein_log_2026-11-02');
  assert.deepEqual(P.staleKeys(['protein_log_2026-10-01', 'protein_log_2026-10-02', 'protein_log_2026-10-31', 'protein_goal_g', 'protein_log_bad'], new Date(2026, 10, 1)), ['protein_log_2026-10-01']); });
test('custom entry bounds: name 1..60, grams 0..300 (1 decimal) or empty=null, servings 1..10', () => {
  assert.deepEqual(P.customEntry({ name: '  יוגורט  ', g: '15', servings: 2 }, 5, 'u1'), { uid: 'u1', type: 'custom', name: 'יוגורט', g: 15, servings: 2, ts: 5 });
  assert.equal(P.customEntry({ name: '', g: '1' }).error, 'name'); assert.equal(P.customEntry({ name: '   ' }).error, 'name'); assert.equal(P.customEntry({ name: 'x'.repeat(61) }).error, 'name'); assert.ok(!P.customEntry({ name: 'x'.repeat(60) }).error);
  for (const g of ['-1', '300.1', '301', 'abc', 'NaN', '1e2', '2.55', -1, NaN]) assert.equal(P.customEntry({ name: 'a', g }).error, 'grams', String(g));
  assert.equal(P.customEntry({ name: 'a', g: '' }).g, null); assert.equal(P.customEntry({ name: 'a', g: '0' }).g, 0); assert.equal(P.customEntry({ name: 'a', g: '300' }).g, 300); assert.equal(P.customEntry({ name: 'a', g: '2.5' }).g, 2.5);
  for (const s of [0, 11, 1.5, 'x']) assert.equal(P.customEntry({ name: 'a', g: '1', servings: s }).error, 'servings', String(s)); });
test('custom: g × servings counted, unknown not counted, not approx', () => { const a = P.customEntry({ name: 'a', g: '15', servings: 3 }, 1), b = P.customEntry({ name: 'b', g: '' }, 2);
  assert.deepEqual(P.daySum([a, b]), { g: 45, approx: false, unknown: 1, n: 2 }); assert.ok(P.validEntry(a) && P.validEntry(b)); });
test('custom_recent: max 8, unique by name, newest first', () => { let r = []; for (let i = 0; i < 10; i++) r = P.pushRecent(r, { name: 'n' + i, g: i });
  assert.equal(r.length, 8); assert.equal(r[0].name, 'n9'); r = P.pushRecent(r, { name: 'n5', g: 1 }); assert.equal(r[0].name, 'n5'); assert.equal(r.filter(x => x.name === 'n5').length, 1); assert.ok(P.validRecent(r));
  assert.equal(P.validRecent([{ name: 'a', g: 1 }, { name: 'a', g: 2 }]), false); });
test('free shopping items: add trims/validates, clearDone keeps unchecked', () => { let l = P.addFree([], '  חלב ', 1); l = P.addFree(l, '', 2); l = P.addFree(l, 'x'.repeat(61), 3); assert.deepEqual(l, [{ text: 'חלב', done: false, ts: 1 }]);
  l = P.addFree(l, 'לחם', 4); l[0].done = true; assert.deepEqual(P.clearDone(l).map(x => x.text), ['לחם']); assert.ok(P.validFree(l)); assert.equal(P.validFree([{ text: '', done: false, ts: 1 }]), false); });
const v2 = (o = {}) => ({ app: 'recipes-app', state: { v: 2, plan: ['a'], checked: ['a|0'], goal: null, log: { '2026-11-01': [P.recipeEntry({ id: 'a', protein_g: 48 }, 1), P.customEntry({ name: 'יוגורט', g: '15' }, 2)] }, recent: [{ name: 'יוגורט', g: 15 }], free: [{ text: 'חלב', done: true, ts: 3 }], ...o } });
test('backup v2: valid roundtrip incl. goal null, custom, recent, free', () => { const b = v2(); assert.equal(L.validBackup(b), true);
  const back = JSON.parse(JSON.stringify(b)); assert.equal(L.validBackup(back), true); assert.deepEqual(L.importState(back), { v: 2, plan: ['a'], goal: null, log: b.state.log, recent: b.state.recent, free: b.state.free, checked: ['a|0'] });
  assert.equal(L.validBackup(v2({ goal: 120 })), true); });
test('backup v2: rejects bad goal/entries/recent/free', () => {
  for (const bad of [{ goal: 0 }, { goal: 401 }, { goal: '120' }, { log: { 'x': [] } }, { log: { '2026-11-01': [{ type: 'custom', name: '', g: 1, servings: 1, ts: 1 }] } },
    { log: { '2026-11-01': [{ type: 'custom', name: 'a', g: -1, servings: 1, ts: 1 }] } }, { log: { '2026-11-01': [{ type: 'custom', name: 'a', g: 1, servings: 11, ts: 1 }] } },
    { recent: 'x' }, { recent: Array.from({ length: 9 }, (_, i) => ({ name: 'n' + i, g: 1 })) }, { free: [{ text: 'a', done: 'no', ts: 1 }] }, { free: undefined }, { checked: [1] }])
    assert.equal(L.validBackup(v2(bad)), false, JSON.stringify(bad)); });
test('backup v1 (old) still imports; legacy goal kept only if valid', () => { const o = { app: 'recipes-app', state: { plan: ['a'], log: { '2026-11-01': [{ g: 30, label: 'x' }] }, goal: 150 } };
  assert.equal(L.validBackup(o), true); const s = L.importState(o); assert.equal(s.goal, null); assert.equal(s.log['2026-11-01'][0].type, 'custom'); assert.ok(s.log['2026-11-01'].every(P.validEntry)); });
test('no innerHTML / outerHTML / insertAdjacentHTML in app code', () => { for (const f of ['app.js', 'logic.js', 'protein.js', 'store.js']) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, f); });
test('sw precaches all js, font and used icons', () => { const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  for (const f of ['js/protein.js', 'js/store.js', 'fonts/rubik/Rubik-VariableFont_wght.woff2']) assert.ok(sw.includes(`'${f}'`), f);
  for (const m of css.matchAll(/url\((icons\/lucide\/[\w-]+\.svg)\)/g)) assert.ok(sw.includes(`'${m[1]}'`), m[1]); });
test('timer_max: kept only when valid and > timer_min; never without timer_min', () => { const t = (a, b) => L.normalizeSteps([{ text: 'a', timer_min: a, timer_max: b }])[0];
  assert.deepEqual([t(12, 15).timer_min, t(12, 15).timer_max], [12, 15]); assert.equal(t(12, 12).timer_max, null); assert.equal(t(12, 10).timer_max, null);
  assert.equal(t(null, 15).timer_max, null); assert.equal(t(12, -1).timer_max, null); assert.equal(t(12, '15').timer_max, null); assert.equal(t(12, NaN).timer_max, null); });
test('v1 backup: legacy goal never imported (no-default rule)', () => { for (const goal of [150, 120, 1]) assert.equal(L.importState({ app: 'recipes-app', state: { plan: [], log: {}, goal } }).goal, null); });
test('validBackup caps: >31 days or >50 entries/day rejected (v1 and v2)', () => {
  const day = n => Array.from({ length: n }, (_, i) => P.recipeEntry({ id: 'a', protein_g: 1 }, i, 'u' + i));
  const days = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`.replace('2026-10-32', '2026-11-01'), []]));
  assert.equal(L.validBackup(v2({ log: { '2026-11-01': day(50) } })), true); assert.equal(L.validBackup(v2({ log: { '2026-11-01': day(51) } })), false);
  assert.equal(L.validBackup(v2({ log: days(31) })), true); assert.equal(L.validBackup(v2({ log: days(32) })), false);
  assert.equal(L.validBackup({ app: 'recipes-app', state: { plan: [], goal: 1, log: { d: Array.from({ length: 51 }, () => ({ g: 1 })) } } }), false); });
test('duplicate uid (or legacy duplicate ts) in a day rejected', () => { const a = P.recipeEntry({ id: 'a', protein_g: 1 }, 1, 'same'), b = P.recipeEntry({ id: 'b', protein_g: 2 }, 2, 'same');
  assert.equal(L.validBackup(v2({ log: { '2026-11-01': [a, b] } })), false);
  const { uid: _1, ...la } = a, { uid: _2, ...lb } = { ...b, ts: 1 }; assert.equal(L.validBackup(v2({ log: { '2026-11-01': [la, lb] } })), false);
  assert.equal(L.validBackup(v2({ log: { '2026-11-01': [{ ...a, uid: 'BAD UID' }] } })), false); });
test('migration: old entries without uid get unique uids; import assigns them', () => { const l = P.withUids([{ id: 'a', g: 1, ts: 5 }, { id: 'b', g: 2, ts: 5 }, { uid: 'keep', id: 'c', g: 3, ts: 6 }]);
  assert.equal(new Set(l.map(e => e.uid)).size, 3); assert.equal(l[2].uid, 'keep'); assert.ok(l.every(P.validEntry));
  const s = L.importState({ app: 'recipes-app', state: { plan: [], log: { '2026-11-01': [{ g: 1 }, { g: 2 }] }, goal: 5 } }); assert.ok(s.log['2026-11-01'].every(e => P.UID_RE.test(e.uid)));
  localStorage.setItem(P.logKey(new Date()), JSON.stringify([{ id: 'a', g: 1, basis: 'source', ts: 1 }, { id: 'a', g: 1, basis: 'source', ts: 1 }])); const t = St.today();
  assert.equal(new Set(t.map(e => e.uid)).size, 2); assert.ok(JSON.parse(localStorage.getItem(P.logKey(new Date()))).every(e => e.uid)); });
test('undo/edit by uid touches only the target entry even with equal ts', () => { const l = P.withUids([{ id: 'a', g: 10, basis: 'source', ts: 1 }, { id: 'a', g: 10, basis: 'source', ts: 1 }]);
  const after = l.filter(x => x.uid !== l[1].uid); assert.equal(after.length, 1); assert.equal(after[0].uid, l[0].uid); });
test('importState rolls back to snapshot on QuotaExceededError', () => {
  const before = { 'recipes-app:v1': JSON.stringify({ plan: ['old'], checked: [] }), protein_goal_g: '90', 'protein_log_2026-11-01': '[]', custom_recent: '[]', shopping_free_items: '[]', unrelated: 'x' };
  const ls = new FakeLS(before, Object.entries(before).reduce((n, [a, b]) => n + a.length + b.length, 0) + 40); /* byte quota: restore fits, bigger import does not */ const st = L.importState(v2({ goal: 120 }));
  assert.throws(() => St.importState(st, ls), e => e.name === 'QuotaExceededError');
  ls.quotaAfter = Infinity; assert.deepEqual(Object.fromEntries(ls.m), before);
  const ok = new FakeLS(before); St.importState(st, ok); assert.equal(ok.getItem('protein_goal_g'), '120'); assert.equal(JSON.parse(ok.getItem('recipes-app:v1')).plan[0], 'a'); assert.equal(ok.getItem('unrelated'), 'x'); });
test('range countdown: starts at timer_min, then "עוד עד N דק׳"', () => { const [a, b] = L.normalizeSteps([{ text: 'x', timer_min: 8, timer_max: 10 }, { text: 'y', timer_min: 5 }]);
  assert.equal(L.countdownStart(a), 8); assert.equal(L.afterCountdown(a), 'עוד עד 2 דק׳'); assert.equal(L.countdownStart(b), 5); assert.equal(L.afterCountdown(b), null); assert.equal(L.afterCountdown({ text: 'z', timer_min: null, timer_max: null }), null); });
test('range badge uses en dash and bdi in app code', () => { const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8'); assert.match(app, /bdi\(s\.timer_max != null \? `\$\{s\.timer_min\}–\$\{s\.timer_max\}`/); assert.match(app, /'tag-partial' }, 'חלקי'/); });
