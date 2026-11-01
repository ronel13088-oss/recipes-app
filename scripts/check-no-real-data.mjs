#!/usr/bin/env node
// Fails (exit 1) if repo files look like they contain real personal data.
// Generic patterns: Israeli ID (with checksum), Israeli phone, IBAN, payment card (Luhn), email.
// Usage: node scripts/check-no-real-data.mjs [--staged]   (--staged checks the git index = what will be committed)
// Allow a single line with the marker:  allow-fake-data
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.CHECK_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = /^(node_modules|\.git)\//;
const BIN_OK = /^(icons|fonts)\//; // binaries allowed only here (their embedded text is still scanned)
const BAD_NAME = /(^|\/)(private|real-data)\/|[.-]real\.|-backup-.*\.json$/i;
const luhn = d => { let s = 0; for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; } return s % 10 === 0; };
const ilId = d => { if (d.length === 8) d = '0' + d; if (d.length !== 9) return false; let s = 0; for (let i = 0; i < 9; i++) { let x = +d[i] * ((i % 2) + 1); s += x > 9 ? x - 9 : x; } return s % 10 === 0 && !/^(\d)\1+$/.test(d); };
const ibanOk = s => { s = s.toUpperCase(); const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55); let m = 0; for (const ch of r) m = (m * 10 + +ch) % 97; return m === 1; };
export const RULES = [
  ['payment card number', /\b(?:\d[ -]?){13,19}\b/g, m => { const d = m.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && /^[2-6]/.test(d) && luhn(d) && !/^(\d)\1+$/.test(d); }],
  ['IBAN', /\b[A-Za-z]{2}\d{2}(?: ?[A-Za-z0-9]{4}){3,7}(?: ?[A-Za-z0-9]{1,3})?\b/g, m => ibanOk(m.replace(/ /g, ''))],
  ['Israeli ID number', /(?<![\d.])\d{8,9}(?![\d.])/g, m => ilId(m)],
  ['Israeli phone number', /(?<![\d])(?:\+972[- ]?\(?|\(?0)(?:5\d|[23489]|7[2-9])\)?[- ]?\d{3}[- ]?\d{4}(?!\d)/g, () => true],
  ['email address', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, m => !/@(example\.(com|org|net|invalid)|[a-z0-9-]+\.(invalid|test|example))$/i.test(m)],
];
// Binary = has a NUL byte. Extract printable ASCII runs so patterns hidden in images/fonts are still caught.
export const isBinary = buf => buf.includes(0);
export const binaryText = buf => (buf.toString('latin1').match(/[\x20-\x7e]{6,}/g) || []).join('\n');
export function scanText(text) {
  // sha256 provenance hashes (exactly 64 hex chars incl. at least one a-f letter) can contain checksum-valid digit runs; mask only those tokens.
  const hits = []; text.split('\n').forEach((line, i) => { if (line.includes('allow-fake-data')) return;
    line = line.replace(/(?<![0-9a-fA-F])(?=[0-9a-f]*[a-f])[0-9a-f]{64}(?![0-9a-fA-F])/g, '#');
    for (const [name, re, ok] of RULES) for (const m of line.matchAll(re)) if (ok(m[0])) hits.push(`line ${i + 1}: ${name}`); });
  return hits;
}
function main() {
  const STAGED = process.argv.includes('--staged');
  const git = a => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 });
  let files;
  if (STAGED) files = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).toString().split('\0').filter(Boolean);
  else try { files = git(['ls-files', '-co', '--exclude-standard']).toString().split('\n').filter(Boolean); }
  catch { files = []; const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); e.isDirectory() ? (e.name !== '.git' && e.name !== 'node_modules' && walk(p)) : files.push(p); }); walk(''); }
  const bad = [];
  for (const f of files) {
    if (BAD_NAME.test(f)) { bad.push(`${f}: forbidden file name`); continue; }
    if (SKIP.test(f) || f === 'scripts/check-no-real-data.mjs') continue;
    const buf = STAGED ? git(['show', ':' + f]) : fs.readFileSync(path.join(ROOT, f));
    if (isBinary(buf) && !BIN_OK.test(f)) { bad.push(`${f}: unexpected binary file (only icons/ and fonts/ may hold binaries)`); continue; }
    for (const h of scanText(isBinary(buf) ? binaryText(buf) : buf.toString('utf8'))) bad.push(`${f}: ${h}`);
  }
  if (bad.length) { console.error('BLOCKED – possible real personal data:\n  ' + bad.join('\n  ') + '\n(add "allow-fake-data" on a line only for deliberate fake test data)'); process.exit(1); }
  console.log(`ok: ${files.length} ${STAGED ? 'staged ' : ''}files checked, no real data found`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
