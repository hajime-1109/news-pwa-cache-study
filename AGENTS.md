# AGENTS.md

## Project

This repository is for an undergraduate thesis prototype.

The project evaluates cache strategies in a disaster-related news PWA.

The research focuses on whether controlling cache usage according to the
acceptable freshness of each article type can improve the balance among
display speed, retrieval success, and information freshness.

## Goal

Build the smallest working prototype for comparing:

- cache-first
- network-first
- freshness-aware

The freshness-aware strategy must:

- define an acceptable freshness threshold for each article type
- judge whether a cached article is fresh enough for its type
- use that judgment to control whether the cached response can be shown

The experiment compares this article-type-aware strategy with the fixed
cache-first and network-first strategies. The research question is whether it
provides a better balance of:

- display speed
- retrieval success
- information freshness

The main evaluation metrics are:

- response time
- success rate
- staleness violation rate

## Technical rules

- Use Vite + Vanilla JavaScript.
- Do not use React.
- Do not use Workbox.
- Write the Service Worker manually.
- Keep the implementation small and readable.
- Avoid unnecessary libraries.
- Do not add authentication, maps, push notifications, or real news APIs.

## Directory rules

- Put the Service Worker in `public/sw.js`.
- Put staleness judgment logic in `src/cache/stalenessPolicy.js`.
- Put experiment settings in `src/config/experimentConfig.js`.
- Put logging code in `src/metrics/logger.js`.
- Put CSV export code in `src/metrics/exportCsv.js`.
- Put mock API code in `server/mock-api.js`.
- Put thesis-related documents in `docs/`.

## Development rules

- Implement one step at a time.
- Do not implement future steps unless explicitly requested.
- After each step, explain changed files and how to test them.
- Prefer simple code over clever code.
- Do not refactor unrelated files.

## 進捗管理

- 作業開始時に PROJECT_STATUS.md を読み、研究方針・進捗・次のStepを確認する。
- 作業完了時に PROJECT_STATUS.md の実装状況・次にやること・最終更新日を更新する。
- 実際のコードと記載が異なる場合は、確認した事実に基づいて修正する。

## Research constraints

The app is not a production news app.

It is an experimental prototype for evaluating cache behavior.

The code must be easy to explain in a thesis.
