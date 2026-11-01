#!/usr/bin/env node
// Merges every recipes*.json in SRC (default /workspace/health) into data/recipes.json.
// Fails (exit 1) on invalid JSON, missing id, or a duplicate id across/within files.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function merge(srcDir) {
  const files = fs.readdirSync(srcDir).filter(f => /^recipes.*\.json$/.test(f)).sort();
  if (!files.length) throw new Error(`no recipes*.json in ${srcDir}`);
  const out = [], seen = new Map();
  for (const f of files) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8')); } catch (e) { throw new Error(`invalid JSON in ${f}: ${e.message}`); }
    const list = Array.isArray(j) ? j : j?.recipes; if (!Array.isArray(list)) throw new Error(`${f}: no recipes array`);
    list.forEach((r, i) => { if (!r?.id) throw new Error(`${f}[${i}]: missing id`);
      if (seen.has(r.id)) throw new Error(`duplicate id "${r.id}" in ${f} (already in ${seen.get(r.id)})`);
      seen.set(r.id, f); out.push(r); });
  }
  return { files, recipes: out };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const src = process.argv[2] || '/workspace/health';
  try { const { files, recipes } = merge(src);
    fs.writeFileSync(path.join(ROOT, 'data/recipes.json'), JSON.stringify({ generated: new Date().toISOString(), sources: files, count: recipes.length, recipes }, null, 1) + '\n');
    console.log(`merged ${recipes.length} recipes from ${files.join(', ')}`);
  } catch (e) { console.error('BUILD-DATA FAILED:', e.message); process.exit(1); }
}
