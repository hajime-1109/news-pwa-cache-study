self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !(url.pathname === '/api' || url.pathname.startsWith('/api/'))
  ) {
    return;
  }

  // Step 6の検証中はNetwork Firstに固定する。
  event.respondWith(networkFirst(event.request));
});

const API_CACHE_NAME = 'news-api-cache-v1';

async function cacheFirst(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('cache hit:', request.url);
    return cachedResponse;
  }

  console.log('network fetch:', request.url);
  const response = await fetch(request);
  if (response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch (error) {
      // 保存できなくても、取得済みの記事は画面に返す。
      console.error('Cache save failed:', error);
    }
  }
  return response;
}

async function networkFirst(request) {
  let response;
  let networkError;
  try {
    response = await fetch(request);
  } catch (error) {
    networkError = error;
  }

  if (response?.ok) {
    console.log('network success:', request.url);
    try {
      const cache = await caches.open(API_CACHE_NAME);
      await cache.put(request, response.clone());
    } catch (error) {
      // 保存失敗を通信失敗と混同せず、取得済みの記事を返す。
      console.error('Cache save failed:', error);
    }
    return response;
  }

  console.log('network failed:', request.url, response?.status ?? networkError);
  // 404などはそのまま返す。503と、API停止時のプロキシの500を含む
  // サーバーエラーではキャッシュへのフォールバックを試みる。
  if (response && response.status < 500) {
    return response;
  }

  try {
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('fallback cache hit:', request.url);
      return cachedResponse;
    }
  } catch (error) {
    console.error('Cache read failed:', error);
  }

  console.log('fallback cache miss:', request.url);
  if (response) {
    return response;
  }
  throw networkError;
}

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});
