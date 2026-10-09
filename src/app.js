export function initApp() {
  const fetchButton = document.getElementById('fetch-news');
  const conditionSelect = document.getElementById('condition');
  const newsList = document.getElementById('news-list');
  const articleDetail = document.getElementById('article-detail');

  if (!fetchButton || !conditionSelect || !newsList || !articleDetail) {
    throw new Error('記事表示に必要なHTML要素が見つかりません。');
  }

  articleDetail.setAttribute('aria-live', 'polite');
  newsList.setAttribute('aria-live', 'polite');
  let detailRequestId = 0;

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
      const response = await fetch(`/api/articles/${encodeURIComponent(id)}?condition=${encodeURIComponent(condition)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const article = await response.json();
      if (requestId !== detailRequestId) return;
      showDetail(article);
    } catch {
      if (requestId !== detailRequestId) return;
      articleDetail.textContent = '記事詳細を取得できませんでした。APIサーバーと通信条件を確認し、もう一度記事をクリックしてください。';
    }
  }

  fetchButton.addEventListener('click', async () => {
    const condition = conditionSelect.value;
    // 一覧の再取得前に始まった詳細応答は表示しない。
    detailRequestId += 1;
    fetchButton.disabled = true;
    newsList.textContent = 'ニュースを取得中です…';
    articleDetail.replaceChildren();

    try {
      const response = await fetch(`/api/articles?condition=${encodeURIComponent(condition)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const articles = await response.json();
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
    } catch {
      newsList.textContent = 'ニュースを取得できませんでした。APIサーバーと通信条件を確認し、もう一度お試しください。';
    } finally {
      fetchButton.disabled = false;
    }
  });
}
