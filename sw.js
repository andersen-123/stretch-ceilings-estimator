const CACHE_NAME = 'stretch-ceilings-cache-v1';
const FILES_TO_CACHE = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'pdf-generator.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'data/default-items.json',
  'data/default-templates.json',
  'data/settings.json',
  'data/company-info.json'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(resp => resp || fetch(evt.request))
  );
});
