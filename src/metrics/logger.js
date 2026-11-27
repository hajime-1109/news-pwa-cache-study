import { judgeCacheFreshness } from '../cache/stalenessPolicy.js';

/**
 * @typedef {Object} ExperimentLog
 * @property {string} timestamp Operation start time (ISO 8601).
 * @property {string} apiPath Requested pathname, including the ID for details.
 * @property {'list'|'detail'} requestType
 * @property {string} strategy
 * @property {string} condition
 * @property {string} seed
 * @property {string} trialId
 * @property {number} durationMs Time until DOM update, or discard detection.
 * @property {'success'|'failure'|'discarded'} outcome
 * @property {number|null} responseStatus
 * @property {'network'|'cache'|'cache-fallback'|'none'} responseSource
 * @property {number|null} cacheAgeSec
 * @property {number|null} maxStalenessSec
 * @property {boolean|null} stalenessViolation
 * @property {string|null} error
 * @property {'cold'|'fresh'|'expired'|'age-30'|'age-300'|'age-1200'|'age-3600'|null} [initialCacheState]
 * @property {number|null} [configuredAgeSec]
 */

/** @type {Readonly<ExperimentLog>[]} */
const logs = [];

/** @param {ExperimentLog} entry */
export function recordLog(entry) {
  logs.push(Object.freeze({ ...entry }));
}

// Return copies so a later CSV exporter cannot modify the stored measurements.
export function getLogs() {
  return logs.map((entry) => ({ ...entry }));
}

/**
 * @param {Pick<ExperimentLog, 'apiPath'|'requestType'|'strategy'|'condition'|'seed'|'trialId'|'initialCacheState'|'configuredAgeSec'>} context
 */
export function startMeasurement(context) {
  const startedAt = performance.now();
  const timestamp = new Date().toISOString();
  const metadata = { ...context };
  let recorded = false;

  /**
   * Call immediately after the final DOM updates (not browser paint).
   * @param {'success'|'failure'|'discarded'} outcome
   * @param {Response|undefined} response
   * @param {unknown} error
   */
  return (outcome, response, error = null) => {
    if (recorded) return;
    const durationMs = performance.now() - startedAt;
    const now = Date.now();
    recorded = true;
    const source = response?.headers.get('X-Response-Source');
    const responseSource = source === 'network' || source === 'cache' || source === 'cache-fallback'
      ? source : 'none';
    const isDisplayedCache = outcome === 'success'
      && (responseSource === 'cache' || responseSource === 'cache-fallback');
    const freshness = judgeCacheFreshness(
      metadata.apiPath,
      isDisplayedCache ? response?.headers.get('X-Cache-Saved-At') ?? null : null,
      now,
    );
    const stalenessViolation = isDisplayedCache
      ? (freshness.cacheAgeSec === null || freshness.maxStalenessSec === null
        ? null : freshness.cacheAgeSec > freshness.maxStalenessSec)
      : (outcome === 'success' && responseSource === 'network' ? false : null);

    recordLog({
      timestamp,
      ...metadata,
      durationMs,
      outcome,
      responseStatus: response?.status ?? null,
      responseSource,
      cacheAgeSec: freshness.cacheAgeSec,
      maxStalenessSec: freshness.maxStalenessSec,
      stalenessViolation,
      error: error === null ? null : error instanceof Error ? error.message : String(error),
    });
  };
}
