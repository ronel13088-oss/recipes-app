# App Starter — תבנית פתיחה ל-PWA

תבנית נקייה לאפליקציית ווב מתקינה (PWA) בעברית, שעובדת אופליין ושומרת נתונים במכשיר בלבד.
A clean Hebrew/RTL PWA starter: offline, on-device data, strict CSP, real-data guard, tests, GitHub Pages deploy.

## מה יש בפנים / What's inside
- `index.html` — מסך "שלום", RTL, CSP קשיח בלי מקורות חיצוניים.
- `manifest.webmanifest`, `icons/` — התקנה למסך הבית.
- `sw.js` — service worker עם cache לפי גרסה; `scripts/build-version.mjs` מטביע hash של התוכן ב-`const V`.
- `js/app.js` — רישום SW + באנר "גרסה חדשה זמינה — רענן". `js/db.js` — עזר IndexedDB (get/set/del/clearAll/persist).
- `scripts/check-no-real-data.mjs` — חוסם ת"ז, טלפון ישראלי, IBAN, מספר כרטיס (Luhn), אימייל. `--staged` בודק את מה שנכנס לקומיט.
- `.githooks/pre-commit` + `npm run setup` — הגנה + בדיקות + חותמת גרסה בכל קומיט.
- `tests/` — `node:test` (`npm test`), Node 20+.

## התחלה / Start a new app
```sh
cp -r app-starter my-app && cd my-app && rm -rf .git
git init && npm run setup        # install pre-commit hook
git config core.hooksPath        # must print: .githooks  (after any fresh clone: npm install, or npm run setup)
# RENAME (required): DB_NAME in js/db.js, manifest name/short_name, <title>, version prefix in build-version.mjs, PRIVACY.md
npm test && npm run serve        # http://localhost:8080
```
כל קובץ חדש שהאפליקציה צריכה אופליין — להוסיף ל-`ASSETS` ב-`sw.js`.
Add every new offline file to `ASSETS` in `sw.js`. Fake test data on purpose? put `allow-fake-data` on that line.

## אבטחת נתונים במכשיר / On-device data safety
- IndexedDB **אינו מוצפן**. טלפון גנוב ופתוח = הנתונים חשופים. נעילת מסך וביומטריה הן ההגנה העיקרית.
  *IndexedDB is not encrypted; a stolen unlocked phone exposes the data. Rely on the device lock.*
- הדפדפן עלול למחוק נתונים (ניקוי נתוני אתר, iOS Safari אחרי חוסר שימוש, מחסור במקום). `DB.persist()` מבקש שלא, אבל אין הבטחה. ב-iOS — להתקין למסך הבית.
  *Browsers may evict storage; `persist()` helps but is not a guarantee.*
- **דפוס גיבוי מומלץ:** כפתור "ייצוא" שמוריד JSON (`Blob` + `<a download>`), וכפתור "ייבוא" שקורא קובץ ומאמת אותו לפני `DB.set`. להזכיר למשתמש לגבות מדי פעם; לא לשמור גיבויים בריפו (`*-backup-*.json` ב-.gitignore וחסום ב-guard).
  *Pattern: Export → JSON download; Import → validate then write. Never commit backups.*
- ראו `PRIVACY.md` — תבנית למדיניות פרטיות.


## נכסים מובנים (icons / vendor) / Vendored assets
כל קובץ תחת `icons/<set>/` או `js/vendor/<lib>/` חייב:
1. גרסה נעולה ב־README של התיקייה
2. sha256 לכל קובץ באותו README
3. קובץ `LICENSE` ליד הקבצים
4. שורת מקור + תאריך ב־README

הבדיקה: `npm run check:vendor` (רצה גם ב־`npm test`).

כרגע: Lucide SVG ב־`icons/lucide/` (`lucide-static@1.59.0`, ISC, 2026-10-19). חלופה: Phosphor Icons (MIT) — אותם כללים, לא מובנה בתבנית.

דמו: `demo.html` מציג את האייקונים מקומית (בלי CDN, בלי `style=""`, בלי `<style>`).

## פריסה ל-GitHub Pages / Deploy
1. צרו ריפו ב-GitHub ודחפו את `main`. / Create a repo and push `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. `.github/workflows/pages.yml` (actions pinned by commit SHA, least-privilege permissions) מריץ guard + tests + בדיקת גרסת SW, ואז מפרסם. / Runs guard + tests + SW-version check, then deploys.
4. הכתובת: `https://<user>.github.io/<repo>/`. כל השינויים מגיעים למשתמש דרך באנר "רענן".
