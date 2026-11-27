const columns = [
  'timestamp',
  'apiPath',
  'requestType',
  'strategy',
  'condition',
  'durationMs',
  'outcome',
  'responseStatus',
  'responseSource',
  'cacheAgeSec',
  'maxStalenessSec',
  'stalenessViolation',
  'error',
  'initialCacheState',
  'configuredAgeSec',
  'seed',
  'trialId',
];

/** @param {string|number|boolean|null|undefined} value */
function escapeCell(value) {
  const cell = String(value ?? '');
  return /[",\r\n]/.test(cell) ? '"' + cell.replaceAll('"', '""') + '"' : cell;
}

/** @param {Readonly<import('./logger.js').ExperimentLog>[]} logs */
export function toCsv(logs) {
  const rows = logs.map((entry) => columns.map((column) => escapeCell(entry[column])).join(','));
  return [columns.join(','), ...rows].join('\r\n') + '\r\n';
}

/** @param {Readonly<import('./logger.js').ExperimentLog>[]} logs */
export function downloadCsv(logs) {
  const blob = new Blob(['\uFEFF', toCsv(logs)], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `experiment-logs-${new Date().toISOString().replaceAll(':', '-')}.csv`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
