#!/usr/bin/env node
// Builds data/ingredient-aliases.json (raw ingredient text -> canonical name, + staples) from SRC/canon_ingredients.json
// (health agent's list: [{canon, pantry_basic, variants:[raw text...]}]). Usage: node scripts/build-aliases.mjs [srcDir]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function buildAliases(list) {
  if (!Array.isArray(list)) throw new Error('canon list must be an array');
  const aliases = {}, staples = new Set();
  for (const [i, e] of list.entries()) {
    if (!e || typeof e.canon !== 'string' || !e.canon.trim() || !Array.isArray(e.variants)) throw new Error(`entry ${i}: needs canon + variants`);
    const c = e.canon.trim(); if (e.pantry_basic === true) staples.add(c);
    for (const v of e.variants) { if (typeof v !== 'string') continue; const k = v.trim();
      if (aliases[k] && aliases[k] !== c) throw new Error(`variant "${k}" maps to both "${aliases[k]}" and "${c}"`); aliases[k] = c; }
  }
  return { staples: [...staples].sort((a, b) => a.localeCompare(b, 'he')), aliases };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const src = path.join(process.argv[2] || '/workspace/health', 'canon_ingredients.json');
  try { const out = { source: path.basename(src), ...buildAliases(JSON.parse(fs.readFileSync(src, 'utf8'))) };
    fs.writeFileSync(path.join(ROOT, 'data/ingredient-aliases.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(`aliases: ${Object.keys(out.aliases).length} raw -> ${new Set(Object.values(out.aliases)).size} canon, ${out.staples.length} staples`);
  } catch (e) { console.error('BUILD-ALIASES FAILED:', e.message); process.exit(1); }
}
