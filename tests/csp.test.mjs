import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXPECTED_CSP =
  "default-src 'self'; img-src 'self' data:; style-src 'self'; connect-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

function htmlFiles() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => path.join(ROOT, f));
}

test('CSP meta exists, is unchanged, and allows no external/unsafe origins', () => {
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, 'utf8');
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, `CSP meta missing in ${path.basename(file)}`);
    assert.equal(csp, EXPECTED_CSP, `CSP changed in ${path.basename(file)}`);
    for (const dir of csp.split(';')) {
      for (const src of dir.trim().split(/\s+/).slice(1)) {
        assert.ok(
          /^('self'|'none'|data:)$/.test(src),
          `external/unsafe source in CSP (${path.basename(file)}): ${dir.trim()}`,
        );
      }
    }
  }
});

test('HTML loads no external scripts/styles (no CDN)', () => {
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
      html,
      /(src|href)="(https?:)?\/\//,
      `${path.basename(file)} has CDN/external URL`,
    );
  }
});

test('HTML has no inline style="" attributes and no <style> tags', () => {
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /\sstyle\s*=/i, `${path.basename(file)} has inline style=`);
    assert.doesNotMatch(html, /<style[\s>]/i, `${path.basename(file)} has <style> tag`);
  }
});


test('SW ASSETS does not precache LICENSE/README provenance docs', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const list = sw.match(/const ASSETS = \[([^\]]*)\]/)?.[1] || '';
  assert.doesNotMatch(list, /LICENSE/);
  assert.doesNotMatch(list, /README\.md/);
});
