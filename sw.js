// Улучшенный Service Worker с расширенными функциями
const CACHE_VERSION = 'v3.0.0';
const CACHE_NAME = `estimator-cache-${CACHE_VERSION}`;

// Стратегии кэширования для разных типов ресурсов
const CACHE_STRATEGIES = {
  STATIC: {
    files: [
      '/',
      '/index.html',
      '/style.css',
      '/app.js',
      '/pdf-generator.js',
      '/manifest.webmanifest',
      '/icons/icon-192.png',
      '/icons/icon-512.png'
    ],
    strategy: 'CACHE_FIRST'
  },
  DATA: {
    files: [
      '/data/default-templates.json',
      '/data/default-items.json',
      '/data/company-info.json',
      '/data/settings.json'
    ],
    strategy: 'NETWORK_FIRST'
  },
  EXTERNAL: {
    files: [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    ],
    strategy: 'CACHE_FIRST'
  }
};

// Установка и кэширование
self.addEventListener('install', event => {
  console.log('[SW] Установка версии:', CACHE_VERSION);
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Кэшируем статические ресурсы
      await cache.addAll(CACHE_STRATEGIES.STATIC.files);
      
      // Предзагружаем остальные ресурсы в фоне
      self.skipWaiting();
      
      console.log('[SW] Основные ресурсы закэшированы');
    })()
  );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', event => {
  console.log('[SW] Активация новой версии');
  
  event.waitUntil(
    (async () => {
      // Удаляем старые кэши
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Удаление старого кэша:', key);
            return caches.delete(key);
          }
        })
      );
      
      // Обновляем данные при активации
      await updateDataCache();
      
      // Берем контроль над клиентами
      await self.clients.claim();
      
      console.log('[SW] Активация завершена');
    })()
  );
});

// Интеллектуальный перехват запросов
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Пропускаем не-GET запросы и chrome-extension
  if (event.request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Определяем стратегию на основе URL
  const strategy = determineStrategy(event.request);
  
  event.respondWith(
    handleRequest(event.request, strategy)
  );
});

// Определение стратегии для запроса
function determineStrategy(request) {
  const url = new URL(request.url);
  
  // Динамические API запросы
  if (url.pathname.startsWith('/api/')) {
    return 'NETWORK_FIRST';
  }
  
  // Данные из папки /data/
  if (url.pathname.startsWith('/data/')) {
    return 'NETWORK_FIRST_STALE';
  }
  
  // Внешние ресурсы
  if (url.origin !== self.location.origin) {
    return 'CACHE_FIRST';
  }
  
  // Статические ресурсы
  if (request.headers.get('Accept')?.includes('text/html') ||
      request.headers.get('Accept')?.includes('text/css') ||
      request.headers.get('Accept')?.includes('application/javascript')) {
    return 'CACHE_FIRST';
  }
  
  // По умолчанию - Network First
  return 'NETWORK_FIRST';
}

// Обработка запроса по стратегии
async function handleRequest(request, strategy) {
  try {
    switch (strategy) {
      case 'CACHE_FIRST':
        return await cacheFirst(request);
      case 'NETWORK_FIRST':
        return await networkFirst(request);
      case 'NETWORK_FIRST_STALE':
        return await networkFirstStale(request);
      default:
        return await networkFirst(request);
    }
  } catch (error) {
    console.error('[SW] Ошибка обработки запроса:', error);
    return offlineResponse(request);
  }
}

// Стратегия: Cache First
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Обновляем кэш в фоне
    updateCacheInBackground(request);
    return cached;
  }
  
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

// Стратегия: Network First
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Обновляем кэш
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Пробуем из кэша
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Стратегия: Network First, но возвращаем устаревшие данные если есть
async function networkFirstStale(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    // Ничего не делаем, пробуем кэш
  }
  
  // Возвращаем устаревшие данные
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  throw new Error('Нет ни сетевого, ни кэшированного ответа');
}

// Фоновое обновление кэша
function updateCacheInBackground(request) {
  fetch(request)
    .then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, response));
      }
    })
    .catch(() => {
      // Игнорируем ошибки фонового обновления
    });
}

// Оффлайн-ответ
function offlineResponse(request) {
  // Для HTML запросов возвращаем оффлайн страницу
  if (request.headers.get('Accept')?.includes('text/html')) {
    return caches.match('/index.html');
  }
  
  // Для API - JSON ответ
  if (request.headers.get('Accept')?.includes('application/json')) {
    return new Response(
      JSON.stringify({ 
        error: 'Оффлайн режим', 
        message: 'Приложение работает без интернета' 
      }),
      { 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
  
  // Общий оффлайн ответ
  return new Response(
    'Нет соединения с интернетом. Приложение работает в оффлайн-режиме.',
    { 
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    }
  );
}

// Обновление кэша данных
async function updateDataCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Обновляем данные из /data/
    for (const file of CACHE_STRATEGIES.DATA.files) {
      try {
        const response = await fetch(file);
        if (response.ok) {
          await cache.put(file, response);
        }
      } catch (error) {
        console.warn('[SW] Не удалось обновить:', file);
      }
    }
    
    console.log('[SW] Кэш данных обновлен');
  } catch (error) {
    console.error('[SW] Ошибка обновления кэша данных:', error);
  }
}

// Продвинутые Push-уведомления
self.addEventListener('push', event => {
  console.log('[SW] Получено push-сообщение:', event.data?.text());
  
  let data = {};
  try {
    data = event.data?.json() || { title: 'Настройщик смет', body: 'Новое уведомление' };
  } catch {
    data = { 
      title: 'Настройщик смет', 
      body: event.data?.text() || 'Новое уведомление' 
    };
  }
  
  const options = {
    body: data.body,
    icon: data.icon || 'icons/icon-192.png',
    badge: 'icons/icon-96.png',
    image: data.image,
    tag: data.tag || 'default',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    data: data.data || { url: data.url || '/' },
    actions: data.actions || [
      {
        action: 'open',
        title: 'Открыть',
        icon: 'icons/open-128.png'
      },
      {
        action: 'dismiss',
        title: 'Закрыть',
        icon: 'icons/close-128.png'
      }
    ],
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    timestamp: data.timestamp || Date.now()
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
  console.log('[SW] Нажатие на уведомление:', event.action);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
      });
      
      // Ищем открытую вкладку
      for (const client of allClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          await client.focus();
          return;
        }
      }
      
      // Открываем новую вкладку
      if (self.clients.openWindow) {
        await self.clients.openWindow(urlToOpen);
      }
    })()
  );
});

// Фоновая синхронизация с отложенными запросами
const SYNC_TAGS = {
  SYNC_DATA: 'sync-data',
  SYNC_ESTIMATES: 'sync-estimates',
  SYNC_SETTINGS: 'sync-settings'
};

self.addEventListener('sync', event => {
  console.log('[SW] Фоновая синхронизация:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.SYNC_DATA:
      event.waitUntil(syncAllData());
      break;
    case SYNC_TAGS.SYNC_ESTIMATES:
      event.waitUntil(syncEstimates());
      break;
    case SYNC_TAGS.SYNC_SETTINGS:
      event.waitUntil(syncSettings());
      break;
    default:
      console.warn('[SW] Неизвестный тег синхронизации:', event.tag);
  }
});

// Периодическая фоновая синхронизация (если поддерживается)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    console.log('[SW] Периодическая синхронизация:', event.tag);
    if (event.tag === 'update-data') {
      event.waitUntil(updateDataCache());
    }
  });
}

// Обработка сообщений от основного потока
self.addEventListener('message', event => {
  console.log('[SW] Сообщение от клиента:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'UPDATE_CACHE':
      updateDataCache();
      break;
    case 'CLEAR_CACHE':
      clearOldCaches();
      break;
    case 'GET_CACHE_INFO':
      getCacheInfo(event.ports[0]);
      break;
    case 'SYNC_NOW':
      syncAllData().then(() => {
        event.ports[0]?.postMessage({ type: 'SYNC_COMPLETE' });
      });
      break;
  }
});

// Функции синхронизации
async function syncAllData() {
  console.log('[SW] Запуск полной синхронизации');
  
  try {
    // 1. Синхронизируем сметы
    await syncEstimates();
    
    // 2. Синхронизируем настройки
    await syncSettings();
    
    // 3. Обновляем кэш данных
    await updateDataCache();
    
    console.log('[SW] Полная синхронизация завершена');
    
    // Уведомляем клиентов
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
      client.postMessage({ 
        type: 'SYNC_COMPLETE',
        timestamp: new Date().toISOString(),
        success: true 
      });
    });
    
    // Показываем уведомление
    self.registration.showNotification('Синхронизация завершена', {
      body: 'Все данные синхронизированы с облаком',
      icon: 'icons/icon-192.png',
      tag: 'sync-complete'
    });
    
  } catch (error) {
    console.error('[SW] Ошибка синхронизации:', error);
    
    // Уведомляем об ошибке
    const allClients = await self.clients.matchAll();
    allClients.forEach(client => {
      client.postMessage({ 
        type: 'SYNC_ERROR',
        error: error.message 
      });
    });
  }
}

async function syncEstimates() {
  // Здесь будет логика синхронизации смет с облачным хранилищем
  // Например, с Google Sheets API или вашим сервером
  console.log('[SW] Синхронизация смет...');
  
  // Заглушка - можно расширить
  return Promise.resolve();
}

async function syncSettings() {
  // Синхронизация настроек
  console.log('[SW] Синхронизация настроек...');
  
  // Заглушка - можно расширить
  return Promise.resolve();
}

async function clearOldCaches() {
  const cacheKeys = await caches.keys();
  const currentCache = cacheKeys.find(key => key.startsWith('estimator-cache-'));
  
  await Promise.all(
    cacheKeys
      .filter(key => key !== currentCache)
      .map(key => caches.delete(key))
  );
}

async function getCacheInfo(port) {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  const info = {
    version: CACHE_VERSION,
    cacheName: CACHE_NAME,
    itemsCount: keys.length,
    size: await calculateCacheSize(cache),
    strategies: Object.keys(CACHE_STRATEGIES)
  };
  
  port.postMessage({ type: 'CACHE_INFO', data: info });
}

async function calculateCacheSize(cache) {
  const keys = await cache.keys();
  let totalSize = 0;
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }
  
  return totalSize;
}

// Регистрация периодической синхронизации при активации
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Регистрируем периодическую синхронизацию если поддерживается
      if ('periodicSync' in self.registration) {
        try {
          await self.registration.periodicSync.register('update-data', {
            minInterval: 24 * 60 * 60 * 1000 // 24 часа
          });
          console.log('[SW] Периодическая синхронизация зарегистрирована');
        } catch (error) {
          console.warn('[SW] Не удалось зарегистрировать периодическую синхронизацию:', error);
        }
      }
    })()
  );
});
