import { getMaxStalenessSec } from './cache/stalenessPolicy.js';
import { downloadCsv } from './metrics/exportCsv.js';
import { getLogs, startMeasurement } from './metrics/logger.js';

function requestCachePreparation(worker, settings) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Service Workerから応答がありません。ページを再読み込みしてください。'));
    }, 15000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timeout);
      channel.port1.close();
      if (data.ok) resolve(data);
      else reject(new Error(data.error));
    };
    try {
      worker.postMessage({ type: 'prepare-cache', ...settings }, [channel.port2]);
    } catch (error) {
      clearTimeout(timeout);
      channel.port1.close();
      channel.port2.close();
      reject(error);
    }
  });
}

export function initApp() {
  const fetchButton = document.getElementById('fetch-news');
  const exportButton = document.getElementById('export-csv');
  const exportStatus = document.getElementById('export-status');
  const cacheStateSelect = document.getElementById('cache-state');
  const prepareButton = document.getElementById('prepare-cache');
  const cacheStatus = document.getElementById('cache-status');
  const conditionSelect = document.getElementById('condition');
  const strategySelect = document.getElementById('strategy');
  const apiSelect = document.getElementById('api-type');
  const newsList = document.getElementById('news-list');
  const articleDetail = document.getElementById('article-detail');

  if (!fetchButton || !exportButton || !exportStatus || !cacheStateSelect || !prepareButton || !cacheStatus
    || !conditionSelect || !strategySelect || !apiSelect || !newsList || !articleDetail) {
    throw new Error('画面に必要なHTML要素が見つかりません。');
  }

  exportButton.addEventListener('click', () => {
    const logs = getLogs();
    if (logs.length === 0) {
      exportStatus.textContent = '保存できる実験ログがありません。';
      return;
    }
    downloadCsv(logs);
    exportStatus.textContent = `${logs.length}件のCSVダウンロードを開始しました。`;
  });

  articleDetail.setAttribute('aria-live', 'polite');
  newsList.setAttribute('aria-live', 'polite');
  let detailRequestId = 0;
  let listRequestId = 0;
  let activeMeasurements = 0;
  let preparingCache = false;
  let preparedCache = null;
  const measuredPaths = new Set();

  prepareButton.addEventListener('click', async () => {
    if (preparingCache || activeMeasurements > 0) return;
    const worker = navigator.serviceWorker?.controller;
    if (!worker) {
      cacheStatus.textContent = 'Service Workerの準備後にもう一度お試しください。';
      return;
    }
    const apiPath = apiSelect.value;
    const condition = conditionSelect.value;
    const state = cacheStateSelect.value;
    const apiLabel = apiSelect.selectedOptions[0].textContent;
    const stateLabel = cacheStateSelect.selectedOptions[0].textContent;
    preparingCache = true;
    preparedCache = null;
    measuredPaths.clear();
    const controls = [apiSelect, conditionSelect, strategySelect, cacheStateSelect, fetchButton, prepareButton];
    controls.forEach((control) => { control.disabled = true; });
    newsList.inert = true;
    cacheStatus.textContent = 'キャッシュを初期化しています…';
    try {
      const { configuredAgeSec, paths } = await requestCachePreparation(worker, { apiPath, condition, state });
      preparedCache = { apiPath, condition, state, configuredAgeSec, paths };
      const age = configuredAgeSec === null ? '' : `（設定経過時間${configuredAgeSec}秒）`;
      cacheStatus.textContent = `初期化完了：${apiLabel} / ${condition} / ${stateLabel}${age}`;
    } catch (error) {
      cacheStatus.textContent = `初期化に失敗しました：${error.message}`;
    } finally {
      preparingCache = false;
      controls.forEach((control) => { control.disabled = false; });
      newsList.inert = false;
    }
  });

  function beginMeasurement(context) {
    const { apiPath, condition } = context;
    const applies = preparedCache?.condition === condition && (
      preparedCache.state === 'cold'
        ? apiPath === preparedCache.apiPath || apiPath.startsWith(`${preparedCache.apiPath}/`)
        : preparedCache.paths.includes(apiPath)
    );
    const firstForKey = applies && !measuredPaths.has(apiPath);
    if (firstForKey) measuredPaths.add(apiPath);
    const finish = startMeasurement({
      ...context,
      initialCacheState: firstForKey ? preparedCache.state : null,
      configuredAgeSec: firstForKey ? preparedCache.configuredAgeSec : null,
    });
    activeMeasurements += 1;
    prepareButton.disabled = true;
    return (outcome, response, error) => {
      try {
        finish(outcome, response, error);
      } finally {
        activeMeasurements -= 1;
        prepareButton.disabled = activeMeasurements > 0;
      }
    };
  }

  strategySelect.addEventListener('change', () => {
    // 前の戦略で取得中だった応答は表示しない。
    detailRequestId += 1;
    listRequestId += 1;
    fetchButton.disabled = false;
    newsList.textContent = '戦略を変更しました。「ニュースを取得」を押してください。';
    articleDetail.replaceChildren();
  });

  apiSelect.addEventListener('change', () => {
    // API切り替え前の一覧・詳細応答は表示しない。
    detailRequestId += 1;
    listRequestId += 1;
    fetchButton.disabled = false;
    newsList.replaceChildren();
    articleDetail.replaceChildren();
  });

  function fetchWithStrategy(url, strategy) {
    if (!navigator.serviceWorker?.controller) {
      throw new Error('Service Worker not ready');
    }
    return fetch(url, { headers: { 'X-Cache-Strategy': strategy } });
  }

  function showStaleWarning(container, response) {
    if (response.headers.get('X-Cache-Stale') !== 'true') return;
    const warning = document.createElement('p');
    warning.setAttribute('role', 'status');
    warning.textContent = '注意：最新情報を取得できないため、許容鮮度を超えた、または保存時刻が不明なキャッシュを表示しています。';
    container.prepend(warning);
  }

  function showDetail(article, url) {
    const title = document.createElement('h2');
    title.textContent = article.title;

    const metadata = document.createElement('dl');
    const fields = [
      ['カテゴリ', article.category],
      ['更新日時', article.updatedAt],
      ['鮮度の許容時間', `${getMaxStalenessSec(new URL(url, location.href).pathname)} 秒`],
    ];

    for (const [label, value] of fields) {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      metadata.append(term, description);
    }

    const body = document.createElement('p');
    body.className = 'article-body';
    body.textContent = article.body;
    articleDetail.replaceChildren(title, metadata, body);
  }

  async function fetchDetail(id, apiPath) {
    if (preparingCache) return;
    const strategy = strategySelect.value;
    const condition = conditionSelect.value;
    const pathname = `${apiPath}/${encodeURIComponent(id)}`;
    const finish = beginMeasurement({ apiPath: pathname, requestType: 'detail', strategy, condition });
    let response;
    let outcome = 'failure';
    let requestError = null;
    const requestId = ++detailRequestId;
    const url = `${pathname}?condition=${encodeURIComponent(condition)}`;
    articleDetail.textContent = '記事詳細を取得中です…';

    try {
      response = await fetchWithStrategy(url, strategy);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const article = await response.json();
      if (requestId !== detailRequestId) return;
      showDetail(article, url);
      showStaleWarning(articleDetail, response);
      outcome = 'success';
    } catch (error) {
      requestError = error;
      if (requestId !== detailRequestId) return;
      articleDetail.textContent = !navigator.serviceWorker?.controller
        ? 'キャッシュ戦略の準備ができていません。少し待って再取得するか、ページを再読み込みしてください。'
        : '記事詳細を取得できませんでした。APIサーバーと通信条件を確認し、もう一度記事をクリックしてください。';
    } finally {
      finish(requestId !== detailRequestId ? 'discarded' : outcome, response, requestError);
    }
  }

  fetchButton.addEventListener('click', async () => {
    if (preparingCache) return;
    const strategy = strategySelect.value;
    const condition = conditionSelect.value;
    const apiPath = apiSelect.value;
    const finish = beginMeasurement({ apiPath, requestType: 'list', strategy, condition });
    let response;
    let outcome = 'failure';
    let requestError = null;
    const requestId = ++listRequestId;
    // 一覧の再取得前に始まった詳細応答は表示しない。
    detailRequestId += 1;
    fetchButton.disabled = true;
    newsList.textContent = 'ニュースを取得中です…';
    articleDetail.replaceChildren();

    try {
      response = await fetchWithStrategy(`${apiPath}?condition=${encodeURIComponent(condition)}`, strategy);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const articles = await response.json();
      if (requestId !== listRequestId) return;
      if (!Array.isArray(articles)) {
        throw new Error('記事一覧の形式が不正です。');
      }
      const list = document.createElement('ul');

      for (const article of articles) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = article.title;
        button.addEventListener('click', () => fetchDetail(article.id, apiPath));
        item.append(button);
        list.append(item);
      }

      newsList.replaceChildren(list);
      showStaleWarning(newsList, response);
      outcome = 'success';
    } catch (error) {
      requestError = error;
      if (requestId !== listRequestId) return;
      newsList.textContent = !navigator.serviceWorker?.controller
        ? 'キャッシュ戦略の準備ができていません。少し待って再取得するか、ページを再読み込みしてください。'
        : 'ニュースを取得できませんでした。APIサーバーと通信条件を確認し、もう一度お試しください。';
    } finally {
      if (requestId === listRequestId) fetchButton.disabled = false;
      finish(requestId !== listRequestId ? 'discarded' : outcome, response, requestError);
    }
  });
}
