#!/usr/bin/env node
// Merges every recipes*.json in SRC (default /workspace/health) into data/recipes.json.
// Fails (exit 1) on invalid JSON, missing id, or a duplicate id across/within files.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Hebrew equipment vocabulary (teammate data) -> app tool keys. null = explicit "not an app tool" (dropped on purpose).
// Any value not listed here fails the build.
export const EQUIP = { 'כיריים': 'stovetop', 'סיר': 'stovetop', 'מחבת': 'pan', 'בלנדר': 'blender', 'מעבד מזון': 'blender', 'מיקרוגל': 'microwave',
  "סיר רב תכליתי נינג'ה": 'ninja_foodi', 'אייר פרייר': 'ninja_foodi', 'תנור': null, 'גריל': null, 'מקרר בלבד': null };
const KEYS = new Set(['stovetop', 'pan', 'blender', 'microwave', 'ninja_foodi']);
const key = (v, where) => { if (KEYS.has(v)) return v; if (typeof v !== 'string' || !Object.hasOwn(EQUIP, v)) throw new Error(`${where}: unmapped equipment "${v}"`); return EQUIP[v]; };
const uniq = a => [...new Set(a.filter(Boolean))];
// equipment -> unique keys; equipment_any -> groups of keys (any one suffices), empty groups dropped.
export function mapEquipment(r, where) { const o = { ...r };
  if (r.equipment !== undefined) { if (!Array.isArray(r.equipment)) throw new Error(`${where}: equipment not an array`); o.equipment = uniq(r.equipment.map(v => key(v, where))); }
  if (r.equipment_any !== undefined) { if (!Array.isArray(r.equipment_any) || !r.equipment_any.every(Array.isArray)) throw new Error(`${where}: equipment_any must be array of arrays`);
    o.equipment_any = r.equipment_any.map(g => uniq(g.map(v => key(v, where)))).filter(g => g.length); }
  return o; }
// Runtime (js/pantry.js needs) uses canon_any when non-empty and ignores canon_all on the same line: warn at build time.
export function anyAllWarnings(r, where) { return (Array.isArray(r?.ingredients) ? r.ingredients : []).flatMap((g, i) =>
  Array.isArray(g?.canon_any) && g.canon_any.length && Array.isArray(g?.canon_all) && g.canon_all.length ? [`${where} ingredient[${i}]: has canon_any and canon_all; canon_all ignored at runtime`] : []); }
export function merge(srcDir) {
  const files = fs.readdirSync(srcDir).filter(f => /^recipes.*\.json$/.test(f) && !/draft/i.test(f)) // drafts excluded.sort();
  if (!files.length) throw new Error(`no recipes*.json in ${srcDir}`);
  const out = [], seen = new Map(), warnings = [];
  for (const f of files) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8')); } catch (e) { throw new Error(`invalid JSON in ${f}: ${e.message}`); }
    const list = Array.isArray(j) ? j : j?.recipes; if (!Array.isArray(list)) throw new Error(`${f}: no recipes array`);
    list.forEach((r, i) => { if (!r?.id) throw new Error(`${f}[${i}]: missing id`);
      if (seen.has(r.id)) throw new Error(`duplicate id "${r.id}" in ${f} (already in ${seen.get(r.id)})`);
      warnings.push(...anyAllWarnings(r, `${f}[${i}] ${r.id}`)); seen.set(r.id, f); out.push(mapEquipment(r, `${f}[${i}] ${r.id}`)); });
  }
  return { files, recipes: out, warnings };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const src = process.argv[2] || '/workspace/health';
  try { const { files, recipes, warnings } = merge(src);
    for (const w of warnings) console.warn('WARN:', w); if (warnings.length) console.warn(`WARN: ${warnings.length} line(s) with both canon_any and canon_all`);
    fs.writeFileSync(path.join(ROOT, 'data/recipes.json'), JSON.stringify({ generated: new Date().toISOString(), sources: files, count: recipes.length, recipes }, null, 1) + '\n');
    console.log(`merged ${recipes.length} recipes from ${files.join(', ')}`);
  } catch (e) { console.error('BUILD-DATA FAILED:', e.message); process.exit(1); }
}
