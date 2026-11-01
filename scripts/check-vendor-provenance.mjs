#!/usr/bin/env node
/**
 * Provenance for vendored assets under icons/, js/vendor/, and legacy vendor/.
 *
 * Rules:
 * - icons/: only icon-*.png allowed at top level; everything else must live under
 *   icons/<set>/ with LICENSE + README (version, source URL, date, sha256 per file
 *   at any depth).
 * - js/vendor/ and vendor/: no loose files at the root; every asset must live under
 *   <lib>/ with the same LICENSE + README provenance. Prefer js/vendor/<lib>/.
 * Exit 1 on any violation.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const META = new Set(['LICENSE', 'README.md', '.gitkeep']);
let failed = 0;

function rel(p) {
  return path.relative(ROOT, p);
}

function fail(msg) {
  console.error(msg);
  failed++;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** All files under dir, recursively (relative to dir). */
function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.') && name !== '.gitkeep') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p).map((f) => path.join(name, f)));
    else if (st.isFile()) out.push(name);
  }
  return out;
}

function checkLibDir(dir) {
  const license = path.join(dir, 'LICENSE');
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(license)) fail(`missing LICENSE in ${rel(dir)}`);
  if (!fs.existsSync(readme)) {
    fail(`missing README.md in ${rel(dir)}`);
    return;
  }
  const readmeText = fs.readFileSync(readme, 'utf8');
  if (!/\d{4}-\d{2}-\d{2}/.test(readmeText)) {
    fail(`README in ${rel(dir)} must include a vendored date (YYYY-MM-DD)`);
  }
  if (!/https?:\/\//.test(readmeText)) {
    fail(`README in ${rel(dir)} must include a source URL`);
  }
  if (!(/@\d+\.\d+\.\d+/.test(readmeText) || /v\d+\.\d+\.\d+/.test(readmeText))) {
    fail(`README in ${rel(dir)} must pin a version (e.g. @1.2.3)`);
  }
  for (const name of walkFiles(dir)) {
    const base = path.basename(name);
    if (META.has(base)) continue;
    const file = path.join(dir, name);
    const hash = sha256(file);
    if (!readmeText.includes(hash)) {
      fail(`README in ${rel(dir)} missing sha256 for ${name} (expected ${hash})`);
    }
  }
}

function checkVendorRoot(vendorRoot) {
  if (!fs.existsSync(vendorRoot)) return;
  for (const name of fs.readdirSync(vendorRoot)) {
    if (name.startsWith('.')) continue;
    const p = path.join(vendorRoot, name);
    const st = fs.statSync(p);
    if (st.isFile()) {
      fail(`loose file not allowed in ${rel(vendorRoot)}/: ${name} (put it under ${rel(vendorRoot)}/<lib>/)`);
    } else if (st.isDirectory()) {
      checkLibDir(p);
    }
  }
}

function checkIconsRoot(iconsRoot) {
  if (!fs.existsSync(iconsRoot)) return;
  for (const name of fs.readdirSync(iconsRoot)) {
    if (name.startsWith('.')) continue;
    const p = path.join(iconsRoot, name);
    const st = fs.statSync(p);
    if (st.isFile()) {
      if (!/^icon-.+\.png$/i.test(name)) {
        fail(`loose file not allowed in icons/: ${name} (only icon-*.png at top level; other assets go under icons/<set>/)`);
      }
    } else if (st.isDirectory()) {
      checkLibDir(p);
    }
  }
}

checkIconsRoot(path.join(ROOT, 'icons'));
checkVendorRoot(path.join(ROOT, 'js', 'vendor'));
checkVendorRoot(path.join(ROOT, 'vendor')); // legacy path — same rules; prefer js/vendor/<lib>/

if (failed) {
  console.error(`vendor provenance: ${failed} issue(s)`);
  process.exit(1);
}
console.log('vendor provenance: ok');
