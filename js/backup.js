// Weekly backup reminder + export delivery. Pure logic is injectable for tests.
// last_backup_at / backup_snooze_until are device-local: NOT app state, never exported (store.exportState only reads app keys).
export const LAST_KEY = 'last_backup_at', SNOOZE_KEY = 'backup_snooze_until';
const DAY = 864e5;
const parse = s => { if (typeof s !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(s)) return null; const t = Date.parse(s); return Number.isFinite(t) ? t : null; };
// Days since last backup; null = never (missing, corrupt, or in the future = clock skew -> treated as never so it can't suppress forever).
export function daysSince(last, now = Date.now()) { const t = parse(last); if (t == null || t > now) return null; return Math.floor((now - t) / DAY); }
export function shouldRemind({ hasData, last, snooze, now = Date.now() }) {
  if (!hasData) return false;
  const s = parse(snooze); if (s != null && s > now && s - now <= DAY) return false; // active snooze (a snooze >24h ahead = skew, ignored)
  const d = daysSince(last, now); return d == null || d >= 7; }
export function message(last, now = Date.now()) { const d = daysSince(last, now); return d == null ? 'עוד לא גיבית. שמור קובץ גיבוי' : `לא גיבית כבר ${d} ימים. שמור קובץ גיבוי`; }
export const fileName = (d = new Date()) => `recipes-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
export const payload = (state, now = new Date()) => ({ app: 'recipes-app', exported: now.toISOString(), state });
// Deliver the file. Order: <a download> -> navigator.share(File) -> open blob in new tab (+ Hebrew instruction). Returns method used.
export async function deliver(json, name, env) { const { doc, nav, win, URL: U, Blob: B, File: F, notify } = env;
  const blob = new B([json], { type: 'application/json' });
  const a = doc.createElement('a'); const standalone = nav.standalone === true || win.matchMedia?.('(display-mode: standalone)').matches;
  const ios = /iP(hone|ad|od)/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if ('download' in a && !(ios && standalone)) { const url = U.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => U.revokeObjectURL(url), 1000); return 'download'; }
  if (F && nav.canShare && nav.share) { const f = new F([json], name, { type: 'application/json' });
    if (nav.canShare({ files: [f] })) { await nav.share({ files: [f], title: name }); return 'share'; } }
  const url = U.createObjectURL(blob); win.open(url, '_blank'); notify?.('הקובץ נפתח בלשונית חדשה. לחץ על "שתף" ובחר "שמור בקבצים".'); return 'tab'; }
// Outcome of an export attempt -> what the app should do. 'tab' never auto-marks: user must confirm 'שמרתי'.
export const isAbort = e => e?.name === 'AbortError';
export const marksDone = method => method === 'download' || method === 'share';
export const FAIL_MSG = 'הגיבוי נכשל, נסה שוב';
// Re-check reminder when the app becomes visible again (iOS home-screen apps rarely reopen).
export function onVisible(doc, fn) { const h = () => { if (doc.visibilityState === 'visible') fn(); }; doc.addEventListener('visibilitychange', h); return h; }
