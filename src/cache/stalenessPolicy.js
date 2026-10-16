import { API_MAX_STALENESS_SEC } from '../config/experimentConfig.js';

export function getMaxStalenessSec(pathname) {
  const apiPath = /^\/api\/articles\/[^/]+$/.test(pathname)
    ? '/api/articles'
    : pathname;
  return Object.hasOwn(API_MAX_STALENESS_SEC, apiPath)
    ? API_MAX_STALENESS_SEC[apiPath]
    : null;
}

export function judgeCacheFreshness(pathname, savedAtHeader, now = Date.now()) {
  const maxStalenessSec = getMaxStalenessSec(pathname);
  const savedAt = typeof savedAtHeader === 'string' && savedAtHeader.trim() !== ''
    ? Number(savedAtHeader)
    : NaN;
  // 不明・不正な時刻や時計の巻き戻りは、新鮮と判断しない。
  const knownAge = Number.isFinite(savedAt) && savedAt >= 0 && savedAt <= now;
  const cacheAgeSec = knownAge ? (now - savedAt) / 1000 : null;
  return {
    cacheAgeSec,
    maxStalenessSec,
    isFresh: cacheAgeSec !== null && maxStalenessSec !== null
      && cacheAgeSec <= maxStalenessSec,
  };
}
