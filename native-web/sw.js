const CACHE = 'hikmah-quest-v10';
const RUNTIME_CACHE = 'hikmah-quest-runtime-v1';
const ASSETS = [
  './beta/index.html',
  './beta/gameplay.html',
  './beta/mode-select.html',
  './beta/results.html',
  './beta/team-beta2.html',
  './beta/terms.html',
  './beta/privacy.html',
  './beta/copyright.html',
  './beta/donation.html',
  './beta/beta-participation.html',
  './beta/cards-99.json',
  './quran-repository.json',
  './manifest.json',
  './card-back.avif',
  './beta/src/styles/tokens.css',
  './beta/src/styles/base.css',
  './beta/src/styles/tiles.css',
  './beta/src/styles/skins.css',
  './beta/src/styles/setup.css',
  './beta/src/styles/buttons.css',
  './beta/src/styles/mobile.css',
  './beta/src/styles/fx.css',
  './beta/src/styles/team-beta2.css',
  './beta/src/app/bootstrap.js',
  './beta/src/app/config.js',
  './beta/src/app/encouragement.js',
  './beta/src/app/mcq.js',
  './beta/src/app/mode-select.js',
  './beta/src/app/fx.js',
  './beta/src/app/sound.js',
  './beta/src/app/multiplayer.js',
  './beta/src/app/proximity.js',
  './beta/src/app/team-beta2.js',
  './beta/src/app/turn-switch.js',
  './beta/src/app/verify-toggle.js',
  './beta/src/content/deck-loader.js',
  './beta/src/gameplay/actions.js',
  './beta/src/gameplay/render.js',
  './beta/src/gameplay/state.js',
  './assets/images/Arch2A_landscape.png',
  './assets/images/Arch2B_landscape.png',
  './assets/images/Arch2C_landscape.png',
  './assets/images/2DArch_landscape.png',
  './assets/images/2AWorldInner_landscape.png',
  './assets/images/2BWorldinner_landscape.png',
  './assets/images/2cWorldInner_landscape.png',
  './assets/images/2DWorldInner.png',
  './beta/assets/fonts/Amiri-Bold.ttf'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const requestUrl = new URL(e.request.url);
  const isHttp = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
  if (!isHttp) return;

  const isNavigation = e.request.mode === 'navigate';
  const isAppAsset = requestUrl.origin === self.location.origin;

  e.respondWith((async () => {
    const staticMatch = await caches.match(e.request);
    if (staticMatch) return staticMatch;

    try {
      const networkResponse = await fetch(e.request);

      if (isAppAsset && networkResponse && networkResponse.ok) {
        const runtime = await caches.open(RUNTIME_CACHE);
        runtime.put(e.request, networkResponse.clone());
      }

      return networkResponse;
    } catch (err) {
      const runtimeMatch = await caches.open(RUNTIME_CACHE).then(c => c.match(e.request));
      if (runtimeMatch) return runtimeMatch;

      if (isNavigation) {
        const fallback = await caches.match('./beta/index.html');
        if (fallback) return fallback;
      }

      throw err;
    }
  })());
});
