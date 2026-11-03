import test from 'node:test'; import assert from 'node:assert/strict';
import * as B from '../js/backup.js'; import * as L from '../js/logic.js';
const NOW = Date.parse('2026-11-03T12:00:00Z'), ago = d => new Date(NOW - d * 864e5).toISOString();
const R = (o) => B.shouldRemind({ hasData: true, now: NOW, ...o });
test('reminder date logic', () => {
  assert.equal(R({ last: null }), true, 'never');
  assert.equal(R({ last: ago(6) }), false, '6d'); assert.equal(R({ last: ago(7) }), true, '7d'); assert.equal(R({ last: ago(8) }), true, '8d');
  assert.equal(B.shouldRemind({ hasData: false, last: null, now: NOW }), false, 'no user data -> no banner');
  assert.equal(R({ last: null, snooze: new Date(NOW + 3600e3).toISOString() }), false, 'snooze active');
  assert.equal(R({ last: null, snooze: new Date(NOW - 1).toISOString() }), true, 'snooze expired');
  assert.equal(R({ last: null, snooze: new Date(NOW + 30 * 864e5).toISOString() }), true, 'skewed snooze ignored');
  assert.equal(R({ last: new Date(NOW + 864e5).toISOString() }), true, 'future last -> never, not suppressed');
  for (const bad of ['', 'garbage', '{"x":1}', '2026-13-45T00:00:00Z', 123, undefined]) { assert.equal(R({ last: bad }), true, String(bad)); assert.equal(B.daysSince(bad, NOW), null); }
  assert.match(B.message(ago(9), NOW), /לא גיבית כבר 9 ימים/); });
test('filename includes date', () => assert.equal(B.fileName(new Date(2026, 10, 3)), 'recipes-backup-2026-11-03.json'));
function mem(init = {}) { const m = new Map(Object.entries(init)); return { get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear(), m }; }
test('round-trip export->import identical, valid, excludes device-local keys', async () => {
  const ls = mem({ 'recipes-app:v1': JSON.stringify({ plan: ['a', 'b'], checked: ['x'] }), [B.LAST_KEY]: ago(3), [B.SNOOZE_KEY]: ago(-1) });
  globalThis.localStorage = ls; const St = await import('../js/store.js');
  St.setGoal(120); St.setRecent([]); St.setFree([]);
  assert.equal(St.hasData(ls), true); assert.equal(St.hasData(mem({ [B.LAST_KEY]: ago(1) })), false, 'reminder keys alone are not user data');
  const st1 = St.exportState(); const file = JSON.parse(JSON.stringify(B.payload(st1)));
  assert.ok(L.validBackup(file)); assert.deepEqual(Object.keys(file).sort(), ['app', 'exported', 'state']);
  const txt = JSON.stringify(file); assert.ok(!txt.includes(B.LAST_KEY) && !txt.includes(B.SNOOZE_KEY));
  for (const k of [...ls.m.keys()]) if (k !== B.LAST_KEY && k !== B.SNOOZE_KEY) ls.removeItem(k);
  St.importState(L.importState(file), ls); assert.deepEqual(St.exportState(), st1); assert.equal(ls.getItem(B.LAST_KEY), ago(3), 'import leaves device keys'); });
function env({ download = true, ios = false, standalone = false, canShare = null } = {}) { const log = [];
  const a = { click: () => log.push('click') }; if (download) a.download = '';
  return { log, e: { doc: { createElement: () => a }, nav: { userAgent: ios ? 'iPhone' : 'X', standalone, canShare: canShare && (o => { log.push(['canShare', o.files[0].name]); return canShare(); }), share: async o => log.push(['share', o.files[0].name]) },
    win: { open: (u, t) => log.push(['open', t]), matchMedia: () => ({ matches: false }) }, URL: { createObjectURL: () => 'blob:1', revokeObjectURL() {} }, Blob, File, notify: t => log.push(['note', t]) } }; }
test('deliver: <a download> path', async () => { const { log, e } = env(); assert.equal(await B.deliver('{}', 'f.json', e), 'download'); assert.deepEqual(log, ['click']); });
test('deliver: iOS standalone -> share File when canShare', async () => { const { log, e } = env({ ios: true, standalone: true, canShare: () => true });
  assert.equal(await B.deliver('{}', 'f.json', e), 'share'); assert.deepEqual(log.at(-1), ['share', 'f.json']); });
test('deliver: no download, no share -> new tab + Hebrew instruction', async () => { const { log, e } = env({ download: false, canShare: () => false });
  assert.equal(await B.deliver('{}', 'f.json', e), 'tab'); assert.deepEqual(log.find(x => x[0] === 'open'), ['open', '_blank']); assert.match(log.find(x => x[0] === 'note')[1], /שמור בקבצים/); });
