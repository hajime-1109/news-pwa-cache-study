import { getMaxStalenessSec, judgeCacheFreshness } from '/src/cache/stalenessPolicy.js';

let activeRequests = 0;
let preparingCache = false;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !(url.pathname === '/api' || url.pathname.startsWith('/api/'))
  ) {
    return;
  }

  const strategyName = event.request.headers.get('X-Cache-Strategy') ?? 'freshness-aware';
  const strategies = {
    'cache-first': cacheFirst,
    'network-first': networkFirst,
    'freshness-aware': freshnessAware,
  };
  if (!Object.hasOwn(strategies, strategyName)) {
    event.respondWith(Promise.resolve(new Response('Unknown cache strategy', { status: 400 })));
    return;
  }

  // 選択はリクエスト単位で適用する。APIやキャッシュキーには持ち込まない。
  const headers = new Headers(event.request.headers);
  headers.delete('X-Cache-Strategy');
  const request = new Request(event.request, { headers });
  if (preparingCache) {
    event.respondWith(new Response('Cache preparation in progress', { status: 503 }));
    return;
  }
  console.log('cache strategy:', strategyName, request.url);
  activeRequests += 1;
  event.respondWith(strategies[strategyName](request).finally(() => { activeRequests -= 1; }));
});

const API_CACHE_NAME = 'news-api-cache-v1';
const SAVED_AT_HEADER = 'X-Cache-Saved-At';

// Mark only the response returned to the page; never persist this metadata.
function withResponseSource(response, source) {
  const headers = new Headers(response.headers);
  headers.set('X-Response-Source', source);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function saveResponse(cache, request, response, savedAt = Date.now()) {
  const copy = response.clone();
  const headers = new Headers(copy.headers);
  headers.set(SAVED_AT_HEADER, String(savedAt));
  await cache.put(request, new Response(copy.body, {
    status: copy.status,
    statusText: copy.statusText,
    headers,
  }));
}

self.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (event.data?.type !== 'prepare-cache' || !port) return;
  if (preparingCache || activeRequests > 0) {
    port.postMessage({ ok: false, error: '別の取得または初期化が進行中です。' });
    port.close();
    return;
  }
  preparingCache = true;
  event.waitUntil((async () => {
    try {
      const result = await prepareCache(event.data);
      port.postMessage({ ok: true, ...result });
    } catch (error) {
      port.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      preparingCache = false;
      port.close();
    }
  })());
});

async function prepareCache({ apiPath, condition, state }) {
  const maxAge = getMaxStalenessSec(apiPath);
  const ageMultiplier = { fresh: 0.5, expired: 1.5 };
  if (maxAge === null || apiPath.split('/').length !== 3
      || !['normal', 'mild', 'severe', 'unstable'].includes(condition)
      || (state !== 'cold' && !Object.hasOwn(ageMultiplier, state))) {
    throw new Error('初期化条件が不正です。');
  }

  await caches.delete(API_CACHE_NAME);
  if (await caches.has(API_CACHE_NAME)) throw new Error('実験用キャッシュを削除できませんでした。');
  if (state === 'cold') return { configuredAgeSec: null, paths: [] };

  try {
    const urlFor = (path, networkCondition) =>
      new URL(`${path}?condition=${networkCondition}`, self.location.origin);
    const signal = AbortSignal.timeout(10000);
    const fetchNormal = async (path) => {
      const response = await fetch(urlFor(path, 'normal'), { cache: 'no-store', signal });
      if (!response.ok) throw new Error(`準備用APIの取得に失敗しました (HTTP ${response.status})。`);
      return response;
    };
    const list = await fetchNormal(apiPath);
    const articles = await list.clone().json();
    if (!Array.isArray(articles) || articles.length === 0) throw new Error('準備対象の記事がありません。');
    const paths = [apiPath];
    const responses = [list];
    for (const article of articles) {
      if (typeof article?.id !== 'string' || !article.id || ['.', '..'].includes(article.id)) {
        throw new Error('準備対象の記事IDが不正です。');
      }
      const path = `${apiPath}/${encodeURIComponent(article.id)}`;
      const response = await fetchNormal(path);
      const detail = await response.clone().json();
      if (detail?.id !== article.id) throw new Error('準備対象の記事詳細が一致しません。');
      paths.push(path);
      responses.push(response);
    }
    const configuredAgeSec = maxAge * ageMultiplier[state];
    const cache = await caches.open(API_CACHE_NAME);
    const savedAt = Date.now() - configuredAgeSec * 1000;
    for (const [index, path] of paths.entries()) {
      const key = new Request(urlFor(path, condition));
      await saveResponse(cache, key, responses[index], savedAt);
      const stored = await cache.match(key);
      if (stored?.headers.get(SAVED_AT_HEADER) !== String(savedAt)) {
        throw new Error('初期化後のキャッシュを確認できませんでした。');
      }
    }
    return { configuredAgeSec, paths };
  } catch (error) {
    await caches.delete(API_CACHE_NAME);
    if (await caches.has(API_CACHE_NAME)) throw new Error('初期化に失敗し、キャッシュも削除できませんでした。');
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('cache hit:', request.url);
    return withResponseSource(cachedResponse, 'cache');
  }

  console.log('network fetch:', request.url);
  const response = await fetch(request);
  if (response.ok) {
    try {
      await saveResponse(cache, request, response);
    } catch (error) {
      // 保存できなくても、取得済みの記事は画面に返す。
      console.error('Cache save failed:', error);
    }
  }
  return withResponseSource(response, 'network');
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
      await saveResponse(cache, request, response);
    } catch (error) {
      // 保存失敗を通信失敗と混同せず、取得済みの記事を返す。
      console.error('Cache save failed:', error);
    }
    return withResponseSource(response, 'network');
  }

  console.log('network failed:', request.url, response?.status ?? networkError);
  // 404などはそのまま返す。503と、API停止時のプロキシの500を含む
  // サーバーエラーではキャッシュへのフォールバックを試みる。
  if (response && response.status < 500) {
    return withResponseSource(response, 'network');
  }

  try {
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('fallback cache hit:', request.url);
      return withResponseSource(cachedResponse, 'cache-fallback');
    }
  } catch (error) {
    console.error('Cache read failed:', error);
  }

  console.log('fallback cache miss:', request.url);
  if (response) {
    return withResponseSource(response, 'network');
  }
  throw networkError;
}

async function freshnessAware(request) {
  const pathname = new URL(request.url).pathname;
  let cache;
  let cachedResponse;
  try {
    cache = await caches.open(API_CACHE_NAME);
    cachedResponse = await cache.match(request);
  } catch (error) {
    console.error('Cache read failed:', error);
  }

  if (cachedResponse) {
    const freshness = judgeCacheFreshness(pathname, cachedResponse.headers.get(SAVED_AT_HEADER));
    if (freshness.isFresh) {
      console.log('freshness cache hit:', request.url, freshness);
      return withResponseSource(cachedResponse, 'cache');
    }
    console.log('freshness cache expired:', request.url, freshness);
  } else {
    console.log('freshness cache miss:', request.url);
  }

  let response;
  let networkError;
  try {
    response = await fetch(request);
  } catch (error) {
    networkError = error;
  }

  if (response?.ok) {
    console.log('freshness network success:', request.url);
    try {
      cache ??= await caches.open(API_CACHE_NAME);
      await saveResponse(cache, request, response);
    } catch (error) {
      console.error('Cache save failed:', error);
    }
    return withResponseSource(response, 'network');
  }

  console.log('freshness network failed:', request.url, response?.status ?? networkError);
  // 404などはキャッシュで隠さない。通信エラー・503を含む5xxのみ救済する。
  if (response && response.status < 500) return withResponseSource(response, 'network');

  if (cachedResponse) {
    const freshness = judgeCacheFreshness(pathname, cachedResponse.headers.get(SAVED_AT_HEADER));
    console.warn('freshness fallback stale cache:', request.url, {
      cacheAgeSec: freshness.cacheAgeSec ?? 'unknown',
      maxStalenessSec: freshness.maxStalenessSec ?? 'unknown',
      stalenessViolation: true,
    });
    // 警告は今回返すレスポンスだけに付加し、キャッシュや保存時刻は変更しない。
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Cache-Stale', 'true');
    headers.set('X-Cache-Age-Sec', String(freshness.cacheAgeSec ?? 'unknown'));
    headers.set('X-Cache-Max-Staleness-Sec', String(freshness.maxStalenessSec ?? 'unknown'));
    headers.set('X-Response-Source', 'cache-fallback');
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  }

  if (response) return withResponseSource(response, 'network');
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
