// Версия кэша
const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `estimator-cache-${CACHE_VERSION}`;

// Ресурсы для кэширования при установке
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/pdf-generator.js',
  '/manifest.json',
  '/data/default-templates.json',
  '/data/default-items.json',
  '/data/company-info.json',
  '/data/settings.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Установка...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Кэширование основных ресурсов...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Пропуск ожидания активации');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Ошибка при кэшировании:', error);
      })
  );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем старые кэши
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Активация завершена');
      return self.clients.claim();
    })
  );
});

// Стратегия кэширования: Cache First, затем Network
self.addEventListener('fetch', event => {
  // Пропускаем запросы к внешним API и аналитике
  if (event.request.url.includes('chrome-extension') ||
      event.request.url.includes('analytics') ||
      event.request.url.includes('gtag')) {
    return;
  }

  // Для данных из папки data используем сеть, затем кэш
  if (event.request.url.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Кэшируем свежий ответ
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // Если нет сети, возвращаем из кэша
          return caches.match(event.request);
        })
    );
    return;
  }

  // Для остальных ресурсов: Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Возвращаем из кэша, если есть
        if (cachedResponse) {
          // Обновляем кэш в фоне
          fetchAndCache(event.request);
          return cachedResponse;
        }

        // Если нет в кэше, загружаем из сети
        return fetch(event.request)
          .then(response => {
            // Клонируем ответ для кэширования
            const responseClone = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });
            
            return response;
          })
          .catch(error => {
            console.log('[Service Worker] Ошибка загрузки:', error);
            
            // Для HTML-страниц показываем оффлайн страницу
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            // Для других ресурсов возвращаем ошибку
            return new Response('Нет соединения с сетью', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Функция для фонового обновления кэша
function fetchAndCache(request) {
  fetch(request)
    .then(response => {
      // Проверяем валидность ответа
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return;
      }

      // Клонируем ответ
      const responseToCache = response.clone();

      caches.open(CACHE_NAME)
        .then(cache => {
          cache.put(request, responseToCache);
        });
    })
    .catch(() => {
      // Ошибка сети - оставляем старый кэш
    });
}

// Фоновая синхронизация
self.addEventListener('sync', event => {
  console.log('[Service Worker] Фоновая синхронизация:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Push-уведомления
self.addEventListener('push', event => {
  console.log('[Service Worker] Push-уведомление получено');
  
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Открыть приложение'
      },
      {
        action: 'close',
        title: 'Закрыть'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Настройщик смет', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Нажатие на уведомление');
  
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Функция синхронизации данных
async function syncData() {
  console.log('[Service Worker] Синхронизация данных...');
  
  try {
    // Здесь можно добавить синхронизацию с облачным хранилищем
    // Например, отправка данных на сервер или синхронизация между устройствами
    
    // Пока просто логируем
    const allClients = await clients.matchAll();
    console.log('[Service Worker] Клиенты:', allClients.length);
    
    // Отправляем сообщение всем клиентам о синхронизации
    allClients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: new Date().toISOString()
      });
    });
    
    console.log('[Service Worker] Данные синхронизированы');
  } catch (error) {
    console.error('[Service Worker] Ошибка синхронизации:', error);
  }
}

// Обработка сообщений от основного потока
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
