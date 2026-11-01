const V = 'recipes-c291ca28f096'; // auto-set by scripts/build-version.mjs (pre-commit)
const ASSETS = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/logic.js', 'js/protein.js', 'js/store.js', 'fonts/rubik/Rubik-VariableFont_wght.woff2', 'icons/lucide/timer.svg','icons/lucide/shopping-cart.svg','icons/lucide/beef.svg','icons/lucide/play.svg','icons/lucide/plus.svg','icons/lucide/check.svg','icons/lucide/arrow-right.svg','icons/lucide/external-link.svg','icons/lucide/undo-2.svg','icons/lucide/pencil.svg','icons/lucide/x.svg','icons/lucide/trash-2.svg','icons/lucide/home.svg','icons/lucide/settings.svg', 'data/recipes.json', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))))); // waits until user taps refresh
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
