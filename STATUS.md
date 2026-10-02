# 開発状況

更新日: 2026-09-25

## 現在の到達点

ローカルJSONによる記事一覧・記事詳細の表示と、単独で起動できるモックAPIまで実装済み。
画面とモックAPIはまだ接続していない。

## 実装済み

### 画面

- `index.html`: キャッシュ戦略選択 `strategy`、通信条件選択 `condition`、取得ボタン `fetch-news`、一覧領域 `news-list`、詳細領域 `article-detail` を配置。
- `src/main.js`: CSSを読み込み、`src/app.js` の `initApp()` を呼び出す。
- `src/app.js`: ローカルJSONを読み込み、取得ボタンで記事一覧、記事クリックで詳細を表示。
- 詳細の表示項目: `title`, `category`, `updatedAt`, `maxStalenessSec`, `body`。
- `src/styles.css`: 最小限の見た目とフォーカス表示を設定。
- `src/data/sample-news.json`: `emergency`, `important`, `normal` を各1件、計3件用意。各記事は上記の詳細項目と `id` を持つ。
- 戦略・通信条件の選択は、現在の画面の記事取得処理にはまだ反映していない。

### モックAPI

- `server/mock-api.js`: Expressを使い、ポート3000で起動。
- `package.json` / `package-lock.json`: Expressを追加。
- `README.md`: APIサーバの起動方法、確認URL、通信条件を記載。
- 成功時は既存のサンプルJSONから記事の配列を返す。

| API | 内容 |
| --- | --- |
| `/api/emergency` | emergencyの記事 |
| `/api/important` | importantの記事 |
| `/api/articles` | 全記事 |
| `/api/static-info` | normalの記事 |

| condition | 遅延 | 失敗率 |
| --- | --- | --- |
| normal | 100ms | 0% |
| mild | 1000ms | 10% |
| severe | 3000ms | 30% |
| unstable | 100〜5000msのランダムな整数 | 30% |

- 遅延後に失敗を判定し、失敗時はHTTP 503と `{"error":"Service unavailable"}` を返す。
- `condition` 未指定時はnormal。不正な値はHTTP 400と `{"error":"Invalid condition"}` を返す。

## 動作確認の状況

- エージェント確認済み: Viteの起動、画面用JS・CSS・JSONのHTTP配信。
- ユーザー確認済み: 取得ボタンからの記事一覧表示、記事クリックからの詳細表示、Consoleにエラーがないこと。
- エージェント確認済み: `node server/mock-api.js` による起動、4つのAPIのnormal時のJSON応答。
- エージェント確認済み: severe時の約3秒の遅延、conditionの省略・不正値への応答。
- 検証プロセスだけで乱数を固定し、mild・severe・unstableの503とエラーJSONを確認済み。本体の乱数処理は変更していない。
- 失敗率の統計的な検証と、unstableの遅延分布の検証は未実施。
- `npm run test` はtestスクリプト未定義のため実行不可。自動テスト基盤は未整備。
- Express導入時、npmが依存関係の脆弱性を高severityで2件報告。原因の特定と修正は未実施。
- API検証用に起動したサーバは確認後に停止済み。

## 起動・確認方法

画面:

```sh
npm run dev
```

表示されたURLで「ニュースを取得」を押し、記事をクリックして詳細を確認する。

モックAPI（別ターミナル）:

```sh
node server/mock-api.js
```

- http://localhost:3000/api/emergency?condition=normal
- http://localhost:3000/api/important?condition=normal
- http://localhost:3000/api/articles?condition=normal
- http://localhost:3000/api/static-info?condition=normal
- http://localhost:3000/api/articles?condition=severe

## 未実装・今後の作業候補

- 画面からモックAPIへの接続と、選択した通信条件の反映。
- Service Worker。
- cache-first / network-first / freshness-aware の各キャッシュ戦略。
- 記事種別ごとの鮮度判定と、許容時間に基づくキャッシュ表示制御。
- 実験用ログ、応答時間・成功率・鮮度違反率の計測。
- CSV出力。
- 自動テストの整備と、比較実験。

今後の項目は進捗整理であり、今回の依頼では実装していない。
