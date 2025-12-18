// Service Worker для конструктора смет
const CACHE_NAME = 'ceiling-estimator-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './style.css',
    './app.js',
    './pdf-generator.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './data/default-templates.json',
    './data/default-items.json',
    './data/company-info.json',
    './data/settings.json'
];

// Установка
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Установка...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Кэширование статических ресурсов');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Пропускаем ожидание');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Ошибка установки:', error);
            })
    );
});

// Активация
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Активация...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Захват клиентов');
            return self.clients.claim();
        })
    );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
    // Пропускаем запросы к CDN
    if (event.request.url.includes('cdnjs.cloudflare.com')) {
        return fetch(event.request);
    }
    
    // Пропускаем не-GET запросы
    if (event.request.method !== 'GET') {
        return fetch(event.request);
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Возвращаем из кэша если есть
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Иначе загружаем из сети
                return fetch(event.request)
                    .then((response) => {
                        // Проверяем валидность ответа
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Клонируем ответ для кэширования
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch((error) => {
                        console.error('[Service Worker] Ошибка fetch:', error);
                        // Для HTML-страниц возвращаем index.html
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
