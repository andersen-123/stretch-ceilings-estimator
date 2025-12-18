// === sw.js - Исправленная версия ===
const CACHE_NAME = 'ceiling-estimator-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './style.css',
    './app.js',
    './pdf-generator.js',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Установка и кэширование
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Кэширование статических ресурсов');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('Ошибка кэширования:', error);
            })
    );
    // Активация без ожидания
    self.skipWaiting();
});

// Активация и очистка старых кэшей
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Взять управление всеми клиентами
            return self.clients.claim();
        })
    );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
    // Пропускаем запросы к CDN и внешним ресурсам
    if (event.request.url.includes('cdnjs.cloudflare.com')) {
        return;
    }
    
    // Для статических файлов используем кэш-первым
    if (event.request.url.includes(location.origin)) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    return fetch(event.request)
                        .then((response) => {
                            // Кэшируем только успешные ответы
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, responseClone);
                                    });
                            }
                            return response;
                        })
                        .catch(() => {
                            // Fallback для страниц
                            if (event.request.mode === 'navigate') {
                                return caches.match('./index.html');
                            }
                        });
                })
        );
    }
});
