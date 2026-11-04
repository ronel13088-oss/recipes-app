import * as L from './logic.js';
import * as P from './protein.js';
import * as St from './store.js';
import * as B from './backup.js';
const $ = s => document.querySelector(s);
let R = [];
const view = $('#view');
view.replaceChildren(...[1, 2, 3].map(() => h('div', { class: 'skel' })));
try { R = L.normalize(await (await fetch('data/recipes.json')).json()); } catch { R = []; }
St.prune();
// DOM helper: text only via text nodes / setAttribute (no HTML string parsing).
function h(tag, attrs = {}, ...kids) { const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'css') for (const [p, x] of Object.entries(v)) e.style.setProperty(p, x); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c)); return e; }
const ic = n => h('span', { class: 'ic ic-' + n, 'aria-hidden': 'true' });
const bdi = t => h('bdi', {}, t);
const MEAL_KEYS = Object.keys(L.MEALS);
const mealCls = m => 'm-' + (L.MEALS[m] ? m : 'other');
const DEV_WORK = { ninja_foodi: 'הנינג׳ה עובד, אתה לא', microwave: 'המיקרו עובד, אתה לא' };
const protText = r => r.protein_g == null ? 'לא ידוע' : (r.proteinCalculated ? '≈' : '') + r.protein_g;
const vib = () => { try { navigator.vibrate?.(10); } catch {} };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Dial (mode: picker | display) ----------
function Dial({ value, mode = 'picker', cls = '', label, center, onInput, onSnap, valuetext }) {
  const face = h('div', { class: 'face' }); const el = h('div', { class: `dial ${cls}` }, face);
  const ticks = L.STOPS.map(s => { const a = s / 30 * 2 * Math.PI; const t = h(mode === 'picker' ? 'button' : 'span', { class: 'tk', 'data-stop': s, 'aria-hidden': mode === 'picker' ? false : 'true', tabindex: '-1', 'aria-label': s === 30 ? 'הכול' : `עד ${s} דקות` }, bdi(String(s)));
    t.style.left = `calc(50% + ${Math.sin(a)} * (var(--size) / 2 + 2px))`; t.style.top = `calc(50% - ${Math.cos(a)} * (var(--size) / 2 + 2px))`;
    if (mode === 'picker') t.addEventListener('click', e => { e.stopPropagation(); set(s, true); onSnap?.(s); }); el.append(t); return t; });
  let v = value;
  function paint() { el.style.setProperty('--pct', (Math.max(0, Math.min(30, v ?? 0)) / 30 * 100) + '%');
    ticks.forEach(t => t.classList.toggle('on', mode === 'picker' ? L.snapStop(v) === +t.dataset.stop : v === +t.dataset.stop));
    face.replaceChildren(...center(v)); if (mode === 'picker') { el.setAttribute('aria-valuenow', String(Math.round(v))); el.setAttribute('aria-valuetext', valuetext(v)); } }
  function set(nv, animate) { v = nv; if (animate && !reduced()) { el.classList.add('anim'); setTimeout(() => el.classList.remove('anim'), 220); } paint(); }
  if (mode === 'picker') {
    Object.entries({ role: 'slider', tabindex: '0', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '30' }).forEach(([k, x]) => el.setAttribute(k, x));
    const ang = e => { const r = el.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); return Math.atan2(dx, -dy) * 180 / Math.PI; };
    let drag = false;
    el.addEventListener('pointerdown', e => { if (e.target.closest('.tk')) return; drag = true; el.setPointerCapture(e.pointerId); move(e); });
    const move = e => { if (!drag) return; let m = L.angleToMinutes(ang(e)); if (m < 0.5 && v > 25) m = 30; set(m); onInput?.(m); };
    el.addEventListener('pointermove', move);
    const up = () => { if (!drag) return; drag = false; const s = L.snapStop(v); set(s, true); vib(); onSnap?.(s); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', e => { const k = e.key; let s = null;
      if (k === 'ArrowUp' || k === 'ArrowRight') s = L.stepStop(v, +1); else if (k === 'ArrowDown' || k === 'ArrowLeft') s = L.stepStop(v, -1); else if (k === 'Home') s = 5; else if (k === 'End') s = 30;
      if (s != null) { e.preventDefault(); set(s, true); vib(); onSnap?.(s); } });
  } else { el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); }
  paint(); el.setValue = set; return el;
}

// ---------- State ----------
const F = { stop: 30, live: null, meals: new Set() };
let route = { tab: 'home' };
let pantry = '';
function go(tab, arg) { route = { tab, arg }; render(); scrollTo(0, 0); }
function nav() { const items = [['home', 'טיימר', 'timer'], ['shop', 'קניות', 'cart'], ['protein', 'חלבון', 'beef']];
  const cur = route.tab === 'recipe' ? 'home' : route.tab;
  return h('nav', { class: 'nav', 'aria-label': 'ניווט ראשי' }, items.map(([t, l, i]) => h('button', { 'data-tab': t, 'aria-current': cur === t ? 'page' : false, onclick: () => go(t) }, ic(i), l))); }
function render() { const out = (screens[route.tab] || screens.home)(route.arg).filter(Boolean); view.replaceChildren(...out); $('#nav').replaceChildren(nav()); }

let toastT; function toast(msg, undo) { $('#toast')?.remove(); clearTimeout(toastT);
  const t = h('div', { class: 'toast', id: 'toast', role: 'status' }, h('span', {}, ...msg), undo ? h('button', { onclick: () => { undo(); t.remove(); } }, 'בטל') : null);
  document.body.append(t); toastT = setTimeout(() => t.remove(), 5000); }

// ---------- Home ----------
const maxOf = () => L.stopToMax(F.live != null ? F.live : F.stop);
function listFor(max) { const pool = R.filter(r => !F.meals.size || F.meals.has(r.meal));
  const main = pool.filter(r => max == null || (r.prepMinutes != null && r.prepMinutes <= max)).sort((a, b) => (a.prepMinutes ?? 1e9) - (b.prepMinutes ?? 1e9));
  return { main, unk: max == null ? [] : pool.filter(r => r.prepMinutes == null) }; }
const countText = (max) => { const n = listFor(max).main.length; return max == null ? `הכול, ${n} מתכונים` : `עד ${max} דקות, ${n} מתכונים`; };
function block(r) { return h('li', {}, h('button', { class: `blk ${mealCls(r.meal)}`, onclick: () => go('recipe', r.id) },
  h('b', {}, r.title), h('span', { class: 's' }, `${L.MEALS[r.meal] || 'אחר'} · חלבון `, bdi(protText(r)), r.protein_g != null ? ' ג׳' : ''),
  h('span', { class: 'min' }, bdi(r.prepMinutes == null ? '?' : r.prepMinutes + '′')))); }
const screens = {
  home() {
    const count = h('span', { id: 'count' }); const list = h('div', { id: 'list' });
    const chipsT = h('div', { class: 'chips', role: 'group', 'aria-label': 'זמן עבודה' });
    const paintCount = max => { const n = listFor(max).main.length; count.replaceChildren(bdi(String(n)), ' מתוך ', bdi(String(R.length))); };
    const paintList = () => { const max = maxOf(), { main, unk } = listFor(max); paintCount(max);
      const kids = [];
      if (!main.length) { const next = L.STOPS.find(s => s > (max ?? 30));
        kids.push(h('div', { class: 'empty' }, h('p', {}, `אין מתכונים עד ${max} דק׳ בסינון הזה`), next ? h('button', { class: 'btn', onclick: () => { F.stop = next; render(); } }, next === 30 ? 'הרחב להכול' : `הרחב ל־${next} דק׳`) : null)); }
      else kids.push(h('ul', { class: 'tl', id: 'main-list' }, main.map(block)));
      if (unk.length) kids.push(h('section', { id: 'unknown-time' }, h('h2', { class: 'grp' }, 'זמן לא ידוע (', bdi(String(unk.length)), ')'), h('ul', { class: 'tl' }, unk.map(block))));
      list.replaceChildren(...kids);
      chipsT.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.stop === F.stop))); };
    const dial = Dial({ value: F.stop, label: 'כמה דקות יש לך', valuetext: v => countText(L.stopToMax(L.snapStop(v))),
      center: v => [h('b', {}, bdi(v >= 29.5 ? '∞' : String(Math.round(v)))), h('span', {}, v >= 29.5 ? 'הכול' : 'דק׳ שיש לך')],
      onInput: m => { F.live = m >= 29.5 ? 30 : Math.round(m); paintList(); }, onSnap: s => { F.live = null; F.stop = s; paintList(); } });
    L.STOPS.forEach((s, i) => chipsT.append(h('button', { class: 'chip', 'data-stop': s, 'aria-pressed': 'false', onclick: () => { F.stop = s; dial.setValue(s, true); vib(); paintList(); } }, s === 30 ? 'הכול' : ['עד ', bdi(String(s))])));
    const chipsM = h('div', { class: 'chips', role: 'group', 'aria-label': 'ארוחה' }, MEAL_KEYS.map(m => h('button', { class: `chip meal ${mealCls(m)}`, 'aria-pressed': String(F.meals.has(m)),
      onclick: e => { F.meals.has(m) ? F.meals.delete(m) : F.meals.add(m); e.currentTarget.setAttribute('aria-pressed', String(F.meals.has(m))); paintList(); } }, m === 'lunchbox' ? 'קופסה' : L.MEALS[m])));
    paintList();
    return [h('div', { class: 'hd' }, h('button', { class: 'lnk', onclick: () => go('pantry') }, ic('home'), 'מה יש בבית'), h('button', { class: 'lnk', onclick: () => go('settings') }, ic('settings'), 'גיבוי')),
      h('h1', {}, 'סובב לכמה דקות שיש לך'), h('p', { class: 'sub', 'aria-live': 'polite' }, count), dial, chipsT, chipsM, list];
  },
  recipe(id) { const r = R.find(x => x.id === id); if (!r) return [h('p', {}, 'מתכון לא נמצא')];
    const P0 = St.plan(); const inPlan = P0.plan.includes(id); const hasDev = r.deviceMin != null;
    const devName = r.devices.map(d => L.DEVICES[d] || d).join(' · ') || 'בלי ציוד';
    const devKey = r.devices.find(d => DEV_WORK[d]);
    const meta = h('p', { class: 'sub' }, `${L.MEALS[r.meal] || 'אחר'} · ${devName}`, r.servings ? [' · ', bdi(String(r.servings)), ' מנות'] : '', ' · חלבון: ',
      r.protein_g == null ? 'לא ידוע' : [bdi(protText(r)), ' ג׳ ', r.proteinCalculated ? '(מחושב, לא מאומת)' : '(מהמקור)']);
    const dial = Dial({ value: r.prepMinutes, mode: 'display', cls: 'recipe', label: r.prepMinutes == null ? 'זמן עבודה לא ידוע' : `${r.prepMinutes} דקות עבודה שלך`,
      center: v => [h('b', {}, bdi(v == null ? '?' : String(v))), h('span', {}, v == null ? 'זמן עבודה לא ידוע' : 'דק׳ עבודה שלך')] });
    const tl = h('ul', { class: 'tl', id: 'recipe-tl' },
      h('li', {}, h('div', { class: 'blk you' }, h('b', {}, 'אתה'), h('span', { class: 's' }, r.prepMinutes == null ? (r.timeNote || 'המקור לא מציין זמן עבודה') : 'זמן עבודה לפי המקור'), h('span', { class: 'min' }, bdi(r.prepMinutes == null ? 'לא ידוע' : r.prepMinutes + '′')))),
      hasDev ? h('li', {}, h('div', { class: 'blk dev', id: 'device-block' }, h('b', {}, DEV_WORK[devKey] || 'המכשיר עובד, אתה לא'), h('span', { class: 's' }, r.devicePartial ? 'רק חלק מהשלבים מתוזמנים במקור' : 'לפי המקור'), h('span', { class: 'min' }, r.devicePartial ? h('span', { class: 'tag-partial' }, 'חלקי') : null, bdi(L.fmtRange(r.deviceMin, r.deviceMax))))) : null,
      h('li', {}, h('div', { class: 'blk tot' }, h('b', {}, 'סה״כ'), h('span', { class: 's' }, r.totalMinutes == null ? 'המקור לא מציין' : (r.devicePartial ? 'לפי המקור (זמן המכשיר חלקי)' : 'לפי המקור')), h('span', { class: 'min' }, bdi(r.totalMinutes == null ? 'לא ידוע' : r.totalMinutes + '′')))));
    const ingr = r.ingredients.map(i => i.qty ? `${i.qty} ${i.name}` : i.name);
    const eat = () => { const e = P.recipeEntry(r); const list = St.today(); list.push(e); St.setToday(list);
      const undo = () => { const l = St.today(); const k = l.findIndex(x => x.uid === e.uid); if (k >= 0) { l.splice(k, 1); St.setToday(l); } };
      if (e.g == null) toast(['החלבון במתכון הזה לא ידוע — לא נוסף ליעד'], undo); else toast(['✓ נרשמו ', bdi((e.basis === 'calculated' ? '≈' : '') + e.g), ' ג׳ להיום'], undo); };
    return [h('div', { class: 'hd' }, h('button', { class: 'lnk', onclick: () => go('home') }, ic('back'), 'חזרה'),
        r.sourceUrl ? h('a', { href: r.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, 'מקור', ic('ext')) : null),
      h('h1', {}, r.title), meta, dial, tl,
      hasDev ? h('p', { class: 'sub', id: 'ingr-short' }, ingr.slice(0, 6).join(' · ') + (ingr.length > 6 ? ' …' : '')) : null,
      r.proteinCalc ? h('details', { class: 'calc' }, h('summary', {}, 'פירוט חישוב החלבון'),
        h('ul', {}, r.proteinCalc.items.map(x => h('li', {}, `${x.ingredient}: ${x.grams ?? '?'} ג׳ × ${x.per100 ?? '?'}/100 = ${x.protein_g ?? '?'} ג׳ חלבון`))),
        h('p', { class: 'hint' }, `סה״כ ${r.proteinCalc.total_g ?? '?'} ג׳${r.proteinCalc.servings ? ` ל־${r.proteinCalc.servings} מנות` : ''} (USDA)`)) : null,
      r.proteinBasis ? h('p', { class: 'hint' }, r.proteinBasis) : null,
      r.note ? h('p', { class: 'note-box' }, r.note) : null,
      r.ninjaBake ? h('p', { class: 'note-box' }, 'אין תנור: אופים בנינג׳ה (Bake / Air Crisp) בחום נמוך ב־10–20 מעלות מהמתכון.') : null,
      r.ninjaNote ? h('p', { class: 'note-box est' }, h('strong', {}, 'הערכה שלנו: '), r.ninjaNote) : null,
      h('section', { class: 'card', id: 'ingredients' }, h('h2', {}, 'מצרכים'), h('ul', {}, ingr.map(t => h('li', {}, t)))),
      h('section', {}, h('h2', {}, 'הוראות'), r.steps.length ? h('ol', { class: 'steps' }, r.steps.map(s => h('li', {}, s.text, s.timer_min != null ? h('span', { class: 'badge', title: 'זמן לשלב לפי המקור' }, bdi(s.timer_max != null ? `${s.timer_min}–${s.timer_max}` : String(s.timer_min)), ' דק׳') : null))) : h('p', { class: 'hint' }, 'אין שלבים, ראה במקור.')),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', 'aria-pressed': String(inPlan), onclick: () => { const p = St.plan(); p.plan = inPlan ? p.plan.filter(x => x !== id) : [...p.plan, id]; St.savePlan(p); render(); toast([inPlan ? 'הוסר מהקניות' : 'נוסף לקניות']); } }, ic(inPlan ? 'check' : 'plus'), inPlan ? 'בקניות' : 'לקניות'),
        h('button', { class: 'btn primary', id: 'eat', onclick: eat }, 'אכלתי', ic('check')))];
  },
  shop() { const p = St.plan(); const free = St.free(); const chk = new Set(p.checked);
    const toggle = k => { const q = St.plan(); q.checked = q.checked.includes(k) ? q.checked.filter(x => x !== k) : [...q.checked, k]; St.savePlan(q); render(); };
    const cards = p.plan.map(id => { const r = R.find(x => x.id === id); if (!r) return null;
      const lines = r.ingredients.map((i, n) => { const k = `${id}|${n}`, t = i.qty ? `${i.qty} ${i.name}` : i.name;
        return h('li', {}, h('label', { class: chk.has(k) ? 'done' : '' }, h('input', { type: 'checkbox', checked: chk.has(k), onchange: () => toggle(k) }), t)); });
      const more = lines.length > 6; const ul = h('ul', { class: 'lines' }, more ? lines.slice(0, 6) : lines);
      return h('section', { class: `card side ${mealCls(r.meal)}` }, h('div', { class: 'hd' }, h('b', {}, r.title),
          h('button', { class: 'ibtn', 'aria-label': `הסר את ${r.title}`, onclick: () => { const q = St.plan(); q.plan = q.plan.filter(x => x !== id); q.checked = q.checked.filter(x => !x.startsWith(id + '|')); St.savePlan(q); render(); } }, ic('x'))),
        ul, more ? h('button', { class: 'lnk', 'aria-expanded': 'false', onclick: e => { const open = e.currentTarget.getAttribute('aria-expanded') === 'true'; ul.replaceChildren(...(open ? lines.slice(0, 6) : lines)); e.currentTarget.setAttribute('aria-expanded', String(!open)); e.currentTarget.textContent = open ? `+ עוד ${lines.length - 6}` : 'פחות'; } }, `+ עוד ${lines.length - 6}`) : null); });
    const inp = h('input', { type: 'text', maxlength: String(P.NAME_MAX), placeholder: '+ פריט חופשי', 'aria-label': 'פריט חופשי', id: 'free-input' });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const n = P.addFree(St.free(), inp.value); if (n.length !== St.free().length) { St.setFree(n); render(); $('#free-input')?.focus(); } } });
    const freeLines = free.map((f, i) => h('li', {}, h('label', { class: f.done ? 'done' : '' }, h('input', { type: 'checkbox', checked: f.done, onchange: () => { const l = St.free(); l[i].done = !l[i].done; St.setFree(l); render(); } }), f.text), h('span', { class: 'tag' }, 'חופשי'),
      h('button', { class: 'ibtn', 'aria-label': `ערוך ${f.text}`, onclick: () => { const t = prompt('עריכת פריט', f.text); const v = P.parseName(t); if (v) { const l = St.free(); l[i].text = v; St.setFree(l); render(); } } }, ic('edit')),
      h('button', { class: 'ibtn', 'aria-label': `מחק ${f.text}`, onclick: () => { const l = St.free(); l.splice(i, 1); St.setFree(l); render(); } }, ic('trash'))));
    const anyDone = free.some(f => f.done) || p.checked.length;
    return [h('h1', {}, 'קניות'), p.plan.length ? null : h('p', { class: 'empty' }, 'עוד לא הוספת מתכון. ב־\'+ לקניות\' במסך מתכון.'), ...cards,
      h('section', { class: 'card', id: 'free-card' }, h('ul', { class: 'lines' }, freeLines), inp, h('p', { class: 'hint' }, 'Enter שומר. נשמר עד שמוחקים.')),
      anyDone ? h('button', { class: 'btn', onclick: () => { St.setFree(P.clearDone(St.free())); const q = St.plan(); q.checked = []; St.savePlan(q); render(); } }, 'נקה מסומנים') : null];
  },
  protein() { const goal = St.goal(); const log = St.today(); const sum = P.daySum(log); const rg = P.ring(sum.g, goal);
    const sumTxt = (sum.approx ? '≈' : '') + sum.g;
    const goalForm = (val) => { const inp = h('input', { type: 'number', min: '1', max: '400', step: '1', inputmode: 'numeric', id: 'goal-input', 'aria-label': 'יעד חלבון יומי בגרם', value: val ?? '' }); const err = h('p', { class: 'err', 'aria-live': 'polite' });
      return h('section', { class: 'card', id: 'goal-card' }, h('label', { for: 'goal-input' }, 'כמה גרם חלבון ביום אתה רוצה?'), h('div', { class: 'row' }, inp, h('button', { class: 'btn dark', onclick: () => { const g = P.parseGoal(inp.value); if (g == null) { err.textContent = 'מספר שלם בין 1 ל־400'; return; } St.setGoal(g); go('protein'); } }, 'שמור')), err); };
    let editingGoal = false;
    const top = goal == null ? [goalForm(null), h('p', { class: 'sub', id: 'psum' }, 'היום: ', bdi(sumTxt), ' ג׳')] : [
      Dial({ value: rg.pct / 100 * 30, mode: 'display', cls: 'ring', label: `${sumTxt} מתוך ${goal} גרם`, center: () => [h('b', {}, bdi(sumTxt)), h('span', {}, 'מתוך ', bdi(String(goal)), ' ג׳')] }),
      h('p', { class: 'sub', id: 'psum' }, rg.over ? ['+', bdi(String(rg.over)), ' מעל היעד'] : ['נשארו ', bdi(String(rg.left)), ' ג׳'])];
    if (sum.approx) top.push(h('p', { class: 'hint' }, '≈ כי אחד הערכים מחושב, לא מאומת'));
    const items = log.map((e, i) => { const r = e.type === 'custom' ? null : R.find(x => x.id === e.id); const g = P.entryGrams(e);
      return h('li', {}, h('span', {}, e.type === 'custom' ? e.name : (r?.title || e.id), e.type === 'custom' ? h('span', { class: 'tag' }, 'ידני') : null, e.type === 'custom' && e.servings > 1 ? [' ×', bdi(String(e.servings))] : null),
        h('span', { class: 'sub' }, g == null ? 'לא ידוע · לא נרשם' : [bdi((e.basis === 'calculated' ? '≈' : '') + g), ' ג׳']),
        e.type === 'custom' ? h('button', { class: 'ibtn', 'aria-label': `ערוך ${e.name}`, onclick: () => openSheet(e.uid) }, ic('edit')) : null,
        h('button', { class: 'ibtn', 'aria-label': 'מחק רשומה', onclick: () => { St.setToday(St.today().filter(x => x.uid !== e.uid)); render(); } }, ic('trash'))); });
    const byP = [...R].sort((a, b) => (b.protein_g ?? -1) - (a.protein_g ?? -1)); const maxP = Math.max(1, ...R.map(r => r.protein_g ?? 0));
    return [h('h1', {}, 'חלבון היום'), ...top,
      h('h2', {}, 'אכלתי היום'), log.length ? h('ul', { class: 'lines', id: 'plog' }, items) : h('p', { class: 'hint', id: 'plog-empty' }, 'עוד לא נרשם כלום היום.'),
      h('div', { class: 'row' }, h('button', { class: 'lnk', id: 'undo-last', disabled: !log.length, onclick: () => { const l = St.today(); l.pop(); St.setToday(l); render(); } }, ic('undo'), 'בטל אחרון'),
        goal != null ? h('button', { class: 'lnk', id: 'edit-goal', onclick: e => { e.currentTarget.parentNode.after(goalForm(goal)); e.currentTarget.remove(); } }, ic('edit'), 'שנה יעד') : null),
      h('button', { class: 'btn dashed', id: 'add-custom', onclick: () => openSheet(null) }, ic('plus'), 'הוסף משהו אחר'),
      h('h2', {}, 'מתכונים לפי חלבון'), h('ul', { class: 'lines' }, byP.map(r => h('li', { class: mealCls(r.meal) }, h('button', { class: 'lnk', onclick: () => go('recipe', r.id) }, r.title),
        h('span', { class: 'sub' }, bdi(protText(r)), r.protein_g != null ? ' ג׳' : '', ' · ', bdi(r.prepMinutes == null ? '?' : r.prepMinutes + '′')),
        r.protein_g == null ? h('div', { class: 'bar unk', css: { width: '60px' } }) : h('div', { class: 'bar' + (r.proteinCalculated ? ' prot-calc' : ''), css: { width: '60px' } }, h('i', { css: { '--w': (r.protein_g / maxP * 100) + '%' } })))))];
  },
  pantry() { const ta = h('textarea', { rows: 3, placeholder: 'למשל: ביצים, טונה, יוגורט יווני', 'aria-label': 'מצרכים שיש בבית' }); ta.value = pantry;
    const out = h('ul', { class: 'tl' });
    const run = () => { pantry = ta.value; out.replaceChildren(...L.rankByPantry(R, pantry).map(x => { const li = block(x.r); li.firstChild.append(h('span', { class: 's' }, 'יש לך ', bdi(String(x.hit)), ' מתוך ', bdi(String(x.total)), ' מצרכים')); return li; })); };
    ta.addEventListener('input', run); run();
    return [h('div', { class: 'hd' }, h('button', { class: 'lnk', onclick: () => go('home') }, ic('back'), 'חזרה')), h('h1', {}, 'מה יש בבית?'), h('p', { class: 'hint' }, 'כתוב מצרכים מופרדים בפסיק. המתכונים מדורגים לפי מספר המצרכים שיש לך.'), ta, out]; },
  settings() { const file = h('input', { type: 'file', accept: 'application/json', 'aria-label': 'ייבוא גיבוי' });
    file.addEventListener('change', async () => { try { const o = JSON.parse(await file.files[0].text()); if (!L.validBackup(o)) throw 0;
      if (confirm('הייבוא יחליף את הנתונים הקיימים. להמשיך?')) { try { St.importState(L.importState(o)); } catch { alert('הייבוא נכשל (אין מספיק מקום?). הנתונים הקודמים שוחזרו.'); return; } go('home'); } } catch { alert('קובץ גיבוי לא תקין'); } });
    return [h('div', { class: 'hd' }, h('button', { class: 'lnk', onclick: () => go('home') }, ic('back'), 'חזרה')), h('h1', {}, 'גיבוי'),
      h('button', { class: 'btn dark', onclick: doExport }, 'ייצוא גיבוי'),
      h('p', {}, 'ייבוא: ', file), h('p', { class: 'hint' }, 'הנתונים נשמרים רק במכשיר הזה.')]; },
};

// ---------- Custom entry bottom sheet ----------
function openSheet(editUid) { const cur = editUid != null ? St.today().find(x => x.uid === editUid) || null : null;
  const name = h('input', { type: 'text', id: 'c-name', maxlength: String(P.NAME_MAX), required: true, value: cur?.name ?? '' });
  const grams = h('input', { type: 'text', id: 'c-g', inputmode: 'decimal', placeholder: 'לא ידוע', value: cur?.g ?? '' });
  let sv = cur?.servings ?? 1; const out = h('output', { id: 'c-sv', 'aria-live': 'polite' }, String(sv));
  const minus = h('button', { class: 'btn', type: 'button', 'aria-label': 'פחות מנות', onclick: () => { sv = Math.max(1, sv - 1); upd(); } }, '−');
  const plus = h('button', { class: 'btn', type: 'button', 'aria-label': 'עוד מנות', onclick: () => { sv = Math.min(10, sv + 1); upd(); } }, '+');
  const err = h('p', { class: 'err', id: 'c-err', 'aria-live': 'polite' });
  const save = h('button', { class: 'btn primary', type: 'button', id: 'c-save' }, 'שמור');
  const upd = () => { out.textContent = String(sv); minus.disabled = sv <= 1; plus.disabled = sv >= 10; save.disabled = !P.parseName(name.value); };
  name.addEventListener('input', upd);
  const chips = St.recent().map(x => h('button', { class: 'chip', type: 'button', onclick: () => { name.value = x.name; grams.value = x.g ?? ''; upd(); } }, x.name, x.g != null ? [' ', bdi(String(x.g)), ' ג׳'] : ''));
  const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'c-title' }, h('div', { class: 'hd' }, h('h2', { id: 'c-title' }, cur ? 'עריכת רשומה' : 'הוסף משהו אחר'), h('button', { class: 'ibtn', type: 'button', 'aria-label': 'סגור', onclick: () => dlg.close() }, ic('x'))),
    chips.length ? h('div', { class: 'chips', 'aria-label': 'אחרונים' }, chips) : null,
    h('label', { for: 'c-name' }, 'שם'), name, h('label', { for: 'c-g' }, 'גרם חלבון למנה (לא חובה)'), grams,
    h('label', {}, 'מנות'), h('div', { class: 'stepper' }, minus, out, plus), err, h('div', { class: 'row' }, save));
  save.addEventListener('click', () => { const e = P.customEntry({ name: name.value, g: grams.value, servings: sv }, cur?.ts ?? Date.now(), cur?.uid);
    if (e.error) { err.textContent = e.error === 'grams' ? 'מספר בין 0 ל־300' : 'שם חובה (עד 60 תווים)'; return; }
    const l = St.today(); if (cur) { const k = l.findIndex(x => x.uid === cur.uid); if (k >= 0) l[k] = e; else l.push(e); } else l.push(e);
    St.setToday(l); St.setRecent(P.pushRecent(St.recent(), { name: e.name, g: e.g })); dlg.close();
    const before = cur; render();
    toast(e.g == null ? ['נרשם ', e.name, ' · חלבון לא ידוע, לא נוסף ליעד'] : ['✓ נרשמו ', bdi(String(P.entryGrams(e))), ' ג׳ להיום'], () => { const m = St.today(); const k = m.findIndex(x => x.uid === e.uid); if (k >= 0) { before ? m[k] = before : m.splice(k, 1); St.setToday(m); render(); } }); });
  dlg.addEventListener('close', () => dlg.remove()); document.body.append(dlg); upd(); dlg.showModal(); name.focus(); }

// Day rollover: re-render protein screen when the local date changes.
let day = P.dayKey(new Date());
const tick = () => { const d = P.dayKey(new Date()); if (d !== day) { day = d; St.prune(); if (route.tab === 'protein') render(); } };
setInterval(tick, 60000); document.addEventListener('visibilitychange', tick);
const markBackup = () => { localStorage.setItem(B.LAST_KEY, new Date().toISOString()); localStorage.removeItem(B.SNOOZE_KEY); $('#bkp')?.remove(); $('#bkp-ok')?.remove(); };
function confirmSaved() { $('#bkp-ok')?.remove(); const b = h('div', { id: 'bkp-ok', class: 'bkp', role: 'status', 'aria-live': 'polite' }, h('span', {}, 'שמרת את קובץ הגיבוי?'),
    h('span', { class: 'bkp-act' }, h('button', { class: 'btn primary', 'aria-label': 'שמרתי את קובץ הגיבוי', onclick: markBackup }, 'שמרתי'), h('button', { class: 'btn', 'aria-label': 'לא שמרתי', onclick: () => b.remove() }, 'לא')));
  document.body.prepend(b); }
let inFlight = false;
async function doExport() { if (inFlight) return; inFlight = true; try { const json = JSON.stringify(B.payload(St.exportState())); let m;
  try { m = await B.deliver(json, B.fileName(), { doc: document, nav: navigator, win: window, URL, Blob, File: window.File, notify: t => toast([t]) }); }
  catch (e) { if (!B.isAbort(e)) toast([B.FAIL_MSG]); return; }
  if (B.marksDone(m)) markBackup(); else if (m === 'tab') confirmSaved(); return m; } finally { inFlight = false; } }
function backupBanner() { $('#bkp')?.remove(); const last = localStorage.getItem(B.LAST_KEY);
  if (!B.shouldRemind({ hasData: St.hasData(), last, snooze: localStorage.getItem(B.SNOOZE_KEY) })) return;
  const b = h('div', { id: 'bkp', class: 'bkp', role: 'status', 'aria-live': 'polite' }, h('span', {}, B.message(last)),
    h('span', { class: 'bkp-act' }, h('button', { class: 'btn primary', 'aria-label': 'גבה עכשיו: שמור קובץ גיבוי', onclick: doExport }, 'גבה עכשיו'),
      h('button', { class: 'btn', 'aria-label': 'הזכר לי מחר על הגיבוי', onclick: () => { localStorage.setItem(B.SNOOZE_KEY, new Date(Date.now() + 864e5).toISOString()); b.remove(); } }, 'הזכר לי מחר')));
  document.body.prepend(b); }
render(); backupBanner(); B.onVisible(document, backupBanner);
window.__app = { go };
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
