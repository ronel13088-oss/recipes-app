import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { scanText } from '../scripts/check-no-real-data.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// All values below are synthetic test numbers (Luhn/checksum-valid but fake).
const FAKE_CARD = ['4111', '1111', '1111', '1111'].join(' ');
test('guard catches a fake card number', () => { assert.ok(scanText(`pay ${FAKE_CARD}`).some(h => h.includes('card'))); });
test('guard catches IBAN, Israeli ID, phone, email', () => {
  assert.ok(scanText('IL62' + '0108000000099999999').some(h => h.includes('IBAN')));
  assert.ok(scanText('id ' + '00000001' + '8').some(h => h.includes('ID')));
  assert.ok(scanText('call 05' + '2-123-4567').some(h => h.includes('phone')));
  assert.ok(scanText('mail ' + 'someone' + '@gmail.com').some(h => h.includes('email')));
});
test('guard ignores ordinary numbers and example emails', () => {
  assert.deepEqual(scanText('total 12345.67, year 2026, x@example.com, 1234567890123'), []);
});
test('staged guard blocks a staged file with a fake card number', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'stg-')); fs.mkdirSync(path.join(d, 'scripts'));
  fs.copyFileSync(path.join(ROOT, 'scripts/check-no-real-data.mjs'), path.join(d, 'scripts/check-no-real-data.mjs'));
  const g = (...a) => execFileSync('git', a, { cwd: d }); g('init', '-q');
  const run = () => spawnSync('node', ['scripts/check-no-real-data.mjs', '--staged'], { cwd: d }).status;
  fs.writeFileSync(path.join(d, 'a.txt'), `card ${FAKE_CARD}\n`); g('add', 'a.txt'); fs.writeFileSync(path.join(d, 'a.txt'), 'clean\n');
  assert.equal(run(), 1, 'staged bad content must block even if working tree is clean');
  g('add', 'a.txt'); assert.equal(run(), 0);
  fs.rmSync(d, { recursive: true, force: true });
});
test('guard: lowercase IBAN', () => { assert.ok(scanText('il62' + '0108000000099999999').some(h => h.includes('IBAN'))); });
test('guard: 8-digit Israeli ID (padded to 9, checksum)', () => {
  assert.ok(scanText('id ' + '0000001' + '8').some(h => h.includes('ID')));   // 00000018 -> 000000018 // allow-fake-data
  assert.ok(!scanText('id ' + '0000001' + '7').some(h => h.includes('ID')));  // bad checksum
});
test('guard: phone written as (0XX) XXX XXXX', () => { assert.ok(scanText('tel (05' + '2) 123 4567').some(h => h.includes('phone'))); });
test('guard: unexpected binary outside icons/ fonts/ is blocked; text inside allowed binaries is scanned', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bin-')); fs.mkdirSync(path.join(d, 'scripts')); fs.mkdirSync(path.join(d, 'icons'));
  fs.copyFileSync(path.join(ROOT, 'scripts/check-no-real-data.mjs'), path.join(d, 'scripts/check-no-real-data.mjs'));
  const g = (...a) => execFileSync('git', a, { cwd: d }); g('init', '-q');
  const run = () => spawnSync('node', ['scripts/check-no-real-data.mjs', '--staged'], { cwd: d, encoding: 'utf8' });
  fs.writeFileSync(path.join(d, 'blob.bin'), Buffer.from([0, 1, 2, 3])); g('add', 'blob.bin');
  let r = run(); assert.equal(r.status, 1); assert.match(r.stderr, /unexpected binary/); g('rm', '-q', '--cached', 'blob.bin');
  fs.writeFileSync(path.join(d, 'icons/x.png'), Buffer.concat([Buffer.from([137, 80, 0, 0]), Buffer.from(`tEXt ${FAKE_CARD} `), Buffer.from([0])])); g('add', 'icons/x.png');
  r = run(); assert.equal(r.status, 1); assert.match(r.stderr, /icons\/x\.png: line \d+: payment card/);
  fs.writeFileSync(path.join(d, 'icons/x.png'), Buffer.from([137, 80, 0, 0, 1, 2])); g('add', 'icons/x.png'); assert.equal(run().status, 0);
  fs.rmSync(d, { recursive: true, force: true });
});
test('guard: sha256 hashes masked, but a real-looking ID next to one is still caught', async () => {
  const { scanText } = await import('../scripts/check-no-real-data.mjs');
  assert.deepEqual(scanText('| pencil.svg | `7724d9b160c18aa2214e6031157af650f3b78881d832b38381182e9c19b4e860` |'), []);
  assert.equal(scanText('7724d9b160c18aa2214e6031157af650f3b78881d832b38381182e9c19b4e860 38381182').length, 1); // allow-fake-data
  });
