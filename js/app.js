import * as L from './logic.js';
const $ = s => document.querySelector(s);
const KEY = 'recipes-app:v1';
const load = () => { try { return { plan: [], log: {}, goal: 150, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { plan: [], log: {}, goal: 150 }; } };
let S = load(); const save = () => localStorage.setItem(KEY, JSON.stringify(S));
let R = [];
try { R = L.normalize(await (await fetch('data/recipes.json')).json()); } catch { R = []; }
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c)); return e; };
const view = $('#view'); const F = { meal: '', device: '', maxPrep: null }; let pantry = '';
const prot = L.proteinLabel;
const prep = r => (r.prepMinutes == null ? 'זמן עבודה: לא ידוע' + (r.timeNote ? ` (${r.timeNote})` : '') : `${r.prepMinutes} דק׳ עבודה`) + (r.totalMinutes ? ` · סה״כ ${r.totalMinutes} דק׳` : '');
const card = (r, extra) => h('li', { class: 'card' }, h('button', { class: 'title', onclick: () => show('recipe', r.id) }, r.title),
  h('div', { class: 'meta' }, `${L.MEALS[r.meal] || r.meal} · ${prep(r)} · ${prot(r)}`), extra || null);
const sel = (label, val, opts, on) => h('label', {}, label, h('select', { onchange: e => on(e.target.value) },
  h('option', { value: '' }, 'הכל'), ...Object.entries(opts).map(([k, v]) => h('option', { value: k, selected: k === val }, v))));
const tabs = {
  list() { const rs = L.filterRecipes(R, F), unk = L.unknownPrep(R, F);
    return [h('h1', {}, 'מתכונים'), h('div', { class: 'filters' },
      sel('ארוחה', F.meal, L.MEALS, v => { F.meal = v; show('list'); }),
      sel('מכשיר', F.device, L.DEVICES, v => { F.device = v; show('list'); }),
      sel('עד זמן עבודה', F.maxPrep == null ? '' : String(F.maxPrep), { 5: '5 דק׳', 10: '10 דק׳', 15: '15 דק׳', 20: '20 דק׳' }, v => { F.maxPrep = v ? +v : null; show('list'); })),
      h('p', { class: 'hint', id: 'count' }, `${rs.length} מתוך ${R.length} מתכונים`), h('ul', { class: 'cards' }, rs.map(r => card(r))),
      unk.length ? h('section', { id: 'unknown-time' }, h('h2', {}, `זמן לא ידוע (${unk.length})`), h('ul', { class: 'cards' }, unk.map(r => card(r)))) : null]; },
  pantry() { const ta = h('textarea', { rows: 3, placeholder: 'למשל: ביצים, טונה, יוגורט יווני', 'aria-label': 'מצרכים שיש בבית' }); ta.value = pantry;
    const out = h('ul', { class: 'cards' });
    const run = () => { pantry = ta.value; out.replaceChildren(...L.rankByPantry(R, pantry).map(x => card(x.r, h('div', { class: 'meta' }, `יש לך ${x.hit} מתוך ${x.total} מצרכים`)))); };
    ta.addEventListener('input', run); run();
    return [h('h1', {}, 'מה יש בבית?'), h('p', { class: 'hint' }, 'כתוב מצרכים מופרדים בפסיק. המתכונים מדורגים לפי מספר המצרכים שיש לך.'), ta, out]; },
  plan() { const list = L.shoppingList(R, S.plan);
    return [h('h1', {}, 'תוכנית שבועית'),
      S.plan.length ? h('ul', { class: 'cards' }, S.plan.map((id, i) => { const r = R.find(x => x.id === id); return r ? card(r, h('button', { class: 'small', onclick: () => { S.plan.splice(i, 1); save(); show('plan'); } }, 'הסר')) : null; }))
        : h('p', { class: 'hint' }, 'עוד לא בחרת מתכונים. הוסף מתוך עמוד מתכון.'),
      h('h2', {}, 'רשימת קניות'), h('ul', { class: 'shop' }, list.map(i => h('li', {}, h('label', {}, h('input', { type: 'checkbox' }), ` ${i.name}`, i.qty ? h('span', { class: 'qty' }, ` — ${i.qty}`) : null, i.count > 1 ? h('span', { class: 'hint' }, ` (${i.count} מתכונים)`) : null)))),
      S.plan.length ? h('button', { onclick: () => { if (confirm('לנקות את התוכנית?')) { S.plan = []; save(); show('plan'); } } }, 'נקה תוכנית') : null]; },
  protein() { const k = L.dayKey(new Date()); const today = S.log[k] || []; const tot = L.dayTotal(today);
    const add = (g, label) => { if (!(g > 0)) return; (S.log[k] ||= []).push({ g, label }); save(); show('protein'); };
    const pick = h('select', { 'aria-label': 'מתכון' }, h('option', { value: '' }, 'בחר מתכון…'), R.map(r => h('option', { value: r.id }, r.title)));
    const grams = h('input', { type: 'number', min: 0, inputmode: 'numeric', placeholder: 'גרם', 'aria-label': 'גרם חלבון' });
    pick.addEventListener('change', () => { const r = R.find(x => x.id === pick.value); grams.value = r?.protein_g ?? ''; grams.placeholder = r && r.protein_g == null ? 'לא ידוע — הזן גרם' : 'גרם'; });
    return [h('h1', {}, 'חלבון היום'), h('p', { class: 'big', id: 'ptotal' }, `${tot} / ${S.goal} ג׳`),
      h('progress', { max: S.goal, value: Math.min(tot, S.goal) }), h('p', { id: 'streak' }, `רצף: ${L.streak(S.log, S.goal)} ימים`),
      h('div', { class: 'row' }, pick, grams, h('button', { onclick: () => add(+grams.value, R.find(x => x.id === pick.value)?.title || 'ידני') }, 'הוסף')),
      h('ul', { class: 'shop' }, today.map((e, i) => h('li', {}, `${e.label}: ${e.g} ג׳ `, h('button', { class: 'small', onclick: () => { today.splice(i, 1); save(); show('protein'); } }, 'מחק'))))]; },
  settings() { const goal = h('input', { type: 'number', min: 1, value: S.goal, 'aria-label': 'יעד יומי' });
    const file = h('input', { type: 'file', accept: 'application/json', 'aria-label': 'ייבוא גיבוי' });
    file.addEventListener('change', async () => { try { const o = JSON.parse(await file.files[0].text()); if (!L.validBackup(o)) throw 0;
      if (confirm('הייבוא יחליף את הנתונים הקיימים. להמשיך?')) { S = { plan: o.state.plan, log: o.state.log, goal: o.state.goal }; save(); show('settings'); } } catch { alert('קובץ גיבוי לא תקין'); } });
    return [h('h1', {}, 'הגדרות'), h('label', {}, 'יעד חלבון יומי (גרם) ', goal), h('button', { onclick: () => { if (+goal.value > 0) { S.goal = +goal.value; save(); show('protein'); } } }, 'שמור'),
      h('h2', {}, 'גיבוי'), h('button', { onclick: () => { const b = new Blob([JSON.stringify({ app: 'recipes-app', exported: new Date().toISOString(), state: S })], { type: 'application/json' });
        const url = URL.createObjectURL(b); const a = h('a', { href: url, download: `recipes-${L.dayKey(new Date())}.json` }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 0); } }, 'ייצוא גיבוי'), h('p', {}, 'ייבוא: ', file),
      h('p', { class: 'hint' }, 'הנתונים נשמרים רק במכשיר הזה.')]; },
  recipe(id) { const r = R.find(x => x.id === id); if (!r) return [h('p', {}, 'מתכון לא נמצא')]; const inPlan = S.plan.includes(id);
    return [h('button', { class: 'small', onclick: () => show('list') }, 'חזרה'), h('h1', {}, r.title),
      h('p', { class: 'meta' }, `${L.MEALS[r.meal] || r.meal} · ${prep(r)}${r.servings ? ' · מנות: ' + r.servings : ''}`),
      h('p', { class: 'meta' }, r.devices.map(d => L.DEVICES[d] || d).join(' · ') || 'בלי ציוד'),
      h('p', {}, prot(r)),
      r.proteinCalc ? h('details', { class: 'calc' }, h('summary', {}, 'פירוט חישוב החלבון'),
        h('ul', {}, r.proteinCalc.items.map(x => h('li', {}, `${x.ingredient}: ${x.grams ?? '?'} ג׳ × ${x.per100 ?? '?'}/100 = ${x.protein_g ?? '?'} ג׳ חלבון`))),
        h('p', { class: 'hint' }, `סה״כ ${r.proteinCalc.total_g ?? '?'} ג׳${r.proteinCalc.servings ? ` ל־${r.proteinCalc.servings} מנות` : ''} (USDA)`)) : null,
      r.note ? h('p', { class: 'note-box' }, r.note) : null,
      r.ninjaBake ? h('p', { class: 'note-box' }, 'אין תנור: אופים בנינג׳ה (Bake / Air Crisp) בחום נמוך ב־10–20 מעלות מהמתכון.') : null,
      r.ninjaNote ? h('p', { class: 'note-box est' }, h('strong', {}, 'הערכה שלנו: '), r.ninjaNote) : null,
      h('button', { onclick: () => { inPlan ? S.plan = S.plan.filter(x => x !== id) : S.plan.push(id); save(); show('recipe', id); } }, inPlan ? 'הסר מהתוכנית השבועית' : 'הוסף לתוכנית השבועית'),
      h('h2', {}, 'מצרכים'), h('ul', {}, r.ingredients.map(i => h('li', {}, i.qty ? `${i.qty} ${i.name}` : i.name))),
      h('h2', {}, 'הוראות'), r.steps.length ? h('ol', {}, r.steps.map(s => h('li', {}, s))) : h('p', { class: 'hint' }, 'אין שלבים, ראה במקור.'),
      r.sourceUrl ? h('p', {}, h('a', { href: r.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, 'למתכון המקורי')) : null]; },
};
function show(tab, arg) { document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  view.replaceChildren(...tabs[tab](arg).filter(Boolean)); scrollTo(0, 0); }
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
show('list');
if ('serviceWorker' in navigator) {
  const banner = w => { if ($('#upd')) return; const b = document.createElement('div'); b.id = 'upd'; b.className = 'note';
    b.append('גרסה חדשה זמינה — '); const btn = document.createElement('button'); btn.className = 'link'; btn.textContent = 'רענן';
    btn.onclick = () => w.postMessage('skipWaiting'); b.append(btn); document.body.prepend(b); };
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) banner(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) banner(w); }); });
    setInterval(() => reg.update(), 60 * 60 * 1000); });
  let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}
