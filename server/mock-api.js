const express = require('express');
const articles = require('../src/data/sample-news.json');

const app = express();
const port = 3000;

const conditions = {
  normal: { minDelayMs: 100, maxDelayMs: 100, failureRate: 0 },
  mild: { minDelayMs: 1000, maxDelayMs: 1000, failureRate: 0.1 },
  severe: { minDelayMs: 3000, maxDelayMs: 3000, failureRate: 0.3 },
  unstable: { minDelayMs: 100, maxDelayMs: 5000, failureRate: 0.3 },
};

function simulateCondition(req, res, next) {
  const conditionName = req.query.condition ?? 'normal';

  if (
    typeof conditionName !== 'string' ||
    !Object.hasOwn(conditions, conditionName)
  ) {
    res.status(400).json({ error: 'Invalid condition' });
    return;
  }

  const { minDelayMs, maxDelayMs, failureRate } = conditions[conditionName];
  const delayMs = minDelayMs === maxDelayMs
    ? minDelayMs
    : minDelayMs + Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1));

  setTimeout(() => {
    if (Math.random() < failureRate) {
      res.status(503).json({ error: 'Service unavailable' });
      return;
    }

    next();
  }, delayMs);
}

app.get('/api/emergency', simulateCondition, (req, res) => {
  res.json(articles.filter((article) => article.category === 'emergency'));
});

app.get('/api/important', simulateCondition, (req, res) => {
  res.json(articles.filter((article) => article.category === 'important'));
});

app.get('/api/articles', simulateCondition, (req, res) => {
  res.json(articles);
});

app.get('/api/articles/:id', simulateCondition, (req, res) => {
  const article = articles.find((item) => String(item.id) === req.params.id);
  if (!article) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  res.json(article);
});

app.get('/api/static-info', simulateCondition, (req, res) => {
  res.json(articles.filter((article) => article.category === 'normal'));
});

app.listen(port, () => {
  console.log(`Mock API server: http://localhost:${port}`);
});
