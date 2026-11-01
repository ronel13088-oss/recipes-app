import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
test('sw install bypasses HTTP cache (cache: reload)', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /addAll\(ASSETS\.map\(u => new Request\(u, \{ cache: 'reload' \}\)\)\)/);
});
