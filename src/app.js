export function initApp() {
  const fetchButton = document.getElementById('fetch-news');
  const conditionSelect = document.getElementById('condition');
  const strategySelect = document.getElementById('strategy');
  const newsList = document.getElementById('news-list');
  const articleDetail = document.getElementById('article-detail');

  if (!fetchButton || !conditionSelect || !strategySelect || !newsList || !articleDetail) {
    throw new Error('記事表示に必要なHTML要素が見つかりません。');
  }

  articleDetail.setAttribute('aria-live', 'polite');
  newsList.setAttribute('aria-live', 'polite');
  let detailRequestId = 0;
  let listRequestId = 0;

  strategySelect.addEventListener('change', () => {
    // 前の戦略で取得中だった応答は表示しない。
    detailRequestId += 1;
    listRequestId += 1;
    fetchButton.disabled = false;
    newsList.textContent = '戦略を変更しました。「ニュースを取得」を押してください。';
    articleDetail.replaceChildren();
  });

  function fetchWithStrategy(url) {
    if (!navigator.serviceWorker?.controller) {
      throw new Error('Service Worker not ready');
    }
    return fetch(url, { headers: { 'X-Cache-Strategy': strategySelect.value } });
  }

  function showStaleWarning(container, response) {
    if (response.headers.get('X-Cache-Stale') !== 'true') return;
    const warning = document.createElement('p');
    warning.setAttribute('role', 'status');
    warning.textContent = '注意：最新情報を取得できないため、許容鮮度を超えた、または保存時刻が不明なキャッシュを表示しています。';
    container.prepend(warning);
  }

  function showDetail(article) {
    const title = document.createElement('h2');
    title.textContent = article.title;

    const metadata = document.createElement('dl');
    const fields = [
      ['カテゴリ', article.category],
      ['更新日時', article.updatedAt],
      ['鮮度の許容時間', `${article.maxStalenessSec} 秒`],
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

  async function fetchDetail(id) {
    const requestId = ++detailRequestId;
    const condition = conditionSelect.value;
    articleDetail.textContent = '記事詳細を取得中です…';

    try {
      const response = await fetchWithStrategy(`/api/articles/${encodeURIComponent(id)}?condition=${encodeURIComponent(condition)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const article = await response.json();
      if (requestId !== detailRequestId) return;
      showDetail(article);
      showStaleWarning(articleDetail, response);
    } catch {
      if (requestId !== detailRequestId) return;
      articleDetail.textContent = !navigator.serviceWorker?.controller
        ? 'キャッシュ戦略の準備ができていません。少し待って再取得するか、ページを再読み込みしてください。'
        : '記事詳細を取得できませんでした。APIサーバーと通信条件を確認し、もう一度記事をクリックしてください。';
    }
  }

  fetchButton.addEventListener('click', async () => {
    const requestId = ++listRequestId;
    const condition = conditionSelect.value;
    // 一覧の再取得前に始まった詳細応答は表示しない。
    detailRequestId += 1;
    fetchButton.disabled = true;
    newsList.textContent = 'ニュースを取得中です…';
    articleDetail.replaceChildren();

    try {
      const response = await fetchWithStrategy(`/api/articles?condition=${encodeURIComponent(condition)}`);
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
        button.addEventListener('click', () => fetchDetail(article.id));
        item.append(button);
        list.append(item);
      }

      newsList.replaceChildren(list);
      showStaleWarning(newsList, response);
    } catch {
      if (requestId !== listRequestId) return;
      newsList.textContent = !navigator.serviceWorker?.controller
        ? 'キャッシュ戦略の準備ができていません。少し待って再取得するか、ページを再読み込みしてください。'
        : 'ニュースを取得できませんでした。APIサーバーと通信条件を確認し、もう一度お試しください。';
    } finally {
      if (requestId === listRequestId) fetchButton.disabled = false;
    }
  });
}
