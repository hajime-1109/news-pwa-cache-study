// 記事JSONのupdatedAtやmaxStalenessSecとは別の、API別キャッシュ許容時間。
export const API_MAX_STALENESS_SEC = Object.freeze({
  '/api/emergency': 60,
  '/api/important': 600,
  '/api/articles': 1800,
  '/api/static-info': 86400,
});
