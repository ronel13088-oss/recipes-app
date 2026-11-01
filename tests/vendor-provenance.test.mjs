import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCRIPT = path.join(ROOT, 'scripts/check-vendor-provenance.mjs');

function runIn(dir) {
  // Must run the *copy* under dir/scripts so import.meta.url resolves ROOT to the sandbox.
  const script = path.join(dir, 'scripts/check-vendor-provenance.mjs');
  return spawnSync(process.execPath, [script], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env },
  });
}

/** Script resolves ROOT as scripts/.. — sandbox needs scripts/ + planted trees. */
function makeSandbox() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-'));
  fs.mkdirSync(path.join(d, 'scripts'));
  fs.copyFileSync(SCRIPT, path.join(d, 'scripts/check-vendor-provenance.mjs'));
  return d;
}

test('bypass: vendor/anime.min.js (loose file) fails', () => {
  const d = makeSandbox();
  fs.mkdirSync(path.join(d, 'vendor'));
  fs.writeFileSync(path.join(d, 'vendor/anime.min.js'), '/* fake */\n');
  const r = runIn(d);
  assert.notEqual(r.status, 0, 'must fail');
  assert.match(r.stderr, /loose file not allowed in vendor/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('bypass: js/vendor/anime.min.js (loose file) fails', () => {
  const d = makeSandbox();
  fs.mkdirSync(path.join(d, 'js/vendor'), { recursive: true });
  fs.writeFileSync(path.join(d, 'js/vendor/anime.min.js'), '/* fake */\n');
  const r = runIn(d);
  assert.notEqual(r.status, 0, 'must fail');
  assert.match(r.stderr, /loose file not allowed in js\/vendor/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('bypass: icons/evil.js (loose top-level) fails', () => {
  const d = makeSandbox();
  fs.mkdirSync(path.join(d, 'icons'));
  fs.writeFileSync(path.join(d, 'icons/evil.js'), '/* fake */\n');
  const r = runIn(d);
  assert.notEqual(r.status, 0, 'must fail');
  assert.match(r.stderr, /loose file not allowed in icons/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('bypass: icons/lucide/sub/x.js (nested, no sha256) fails', () => {
  const d = makeSandbox();
  const set = path.join(d, 'icons/lucide');
  fs.mkdirSync(path.join(set, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(set, 'LICENSE'), 'ISC\n');
  fs.writeFileSync(
    path.join(set, 'README.md'),
    '# lucide\n- Package: lucide-static@1.0.0\n- Source: https://example.com\n- Date: 2026-10-19\n',
  );
  fs.writeFileSync(path.join(set, 'sub/x.js'), '/* nested fake */\n');
  const r = runIn(d);
  assert.notEqual(r.status, 0, 'must fail');
  assert.match(r.stderr, /missing sha256 for sub\/x\.js/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('clean icons/<set>/ with LICENSE+sha256 passes', () => {
  const d = makeSandbox();
  const set = path.join(d, 'icons/lucide');
  fs.mkdirSync(set, { recursive: true });
  const body = '<svg/>\n';
  fs.writeFileSync(path.join(set, 'home.svg'), body);
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  fs.writeFileSync(path.join(set, 'LICENSE'), 'ISC\n');
  fs.writeFileSync(
    path.join(set, 'README.md'),
    [
      '# lucide',
      '- Package: lucide-static@1.59.0',
      '- Source: https://www.npmjs.com/package/lucide-static',
      '- Date: 2026-10-19',
      '',
      '| file | sha256 |',
      '|---|---|',
      `| home.svg | \`${hash}\` |`,
      '',
    ].join('\n'),
  );
  fs.writeFileSync(path.join(d, 'icons/icon-192.png'), Buffer.from([137, 80, 78, 71]));
  const r = runIn(d);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  fs.rmSync(d, { recursive: true, force: true });
});
