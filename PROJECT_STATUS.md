# プロジェクト進捗

最終更新：2026-10-09

## 研究テーマ
- 災害ニュースPWAにおける、記事種別ごとの許容鮮度に基づくキャッシュ戦略の評価。

## 研究目的
- 表示速度・取得成功・情報鮮度のバランスを改善できるか検証する。
- 評価指標：応答時間、取得成功率、鮮度違反率。

## 実装方針
- Vite + Vanilla JavaScript。Service Workerは手書きする。
- 卒論で説明できる、小さく読みやすい実験用プロトタイプにする。
- 指示されたStepのみ実装し、無関係な変更はしない。

## 比較対象
- cache-first
- network-first
- freshness-aware：記事種別ごとの許容鮮度でキャッシュ表示の可否を判断する。
- サンプルの許容鮮度：emergency＝60秒、important＝300秒、normal＝3600秒。

## API設計
- 実ニュースAPIは使わず、`server/mock-api.js` にExpressのモックAPIを実装済み（ポート3000）。
- サンプル記事の項目：`id`、`title`、`category`、`body`、`updatedAt`、`maxStalenessSec`。
- `/api/emergency`、`/api/important`、`/api/articles`、`/api/static-info` が記事配列を返す。記事更新の制御方法は未確定。
- `/api/articles/:id` は通信条件を適用し、IDが一致する記事1件を返す。存在しないIDは404と `{ "error": "Article not found" }` を返す。

## 通信条件
- UIの選択肢：normal / mild / severe / unstable。
- モックAPIに遅延・失敗率を実装済み：normal＝100ms・0%、mild＝1000ms・10%、severe＝3000ms・30%、unstable＝100〜5000ms・30%。`condition` クエリで選択する。乱数の再現方法は未実装。
- 実験設定は `src/config/experimentConfig.js` に配置する。

## 現在の進捗
- Vite設定と依存パッケージを準備済み。
- `index.html` に戦略・通信条件の選択、取得ボタン、記事表示領域を用意済み。
- `src/data/sample-news.json` に記事3件を用意済み。JSON構文確認済み。
- Step 1〜3は完了。Step 3のブラウザー確認も完了（ユーザー報告）。
- 一覧取得は `/api/articles?condition=...` を維持。Step 3.5としてクリック時に選択中の通信条件で詳細APIをfetchし、取得中・成功・失敗を表示する処理を追加。連続クリックと一覧再取得時は古い詳細応答を無視する。
- Step 3.5は記事IDの扱いが承認待ち。現データのIDは `news-001`〜`news-003` であり、完成条件に指定された `/api/articles/1` は404となる。
- `vite.config.js` に `/api` → `http://localhost:3000` の開発用プロキシを追加。
- Service Worker、キャッシュ戦略、鮮度判定、実験ログ、CSV出力は今回の対象外で未実装。
- Vitestとtestスクリプトは未設定。`npm run test` は実行したが Missing script: "test" で失敗。依存追加は行っていない。
- Step 3.5の構文・差分チェック、簡易DOMでの一覧・詳細URL・取得中・成功・404/503・通信エラー・再試行・応答競合の検証は通過。実APIで既存IDの詳細JSON、一覧、404のJSON、severeの約3.06秒後の200応答を確認。`npm run dev` の起動を確認し、検証用プロセスは終了。Step 3.5の実ブラウザー確認は未実施。
- 今回も `npm run test` はtestスクリプト未設定で失敗。ライブラリ追加は行っていない。
- Gitはリポジトリとして認識されており、前回作業でGitHubへのmainのpushを確認済み。

## 次にやること
- 記事IDを1〜3へ変更するか、既存IDを維持して確認URLを変更するか、ユーザーの回答を待つ。
- Step 3.5をブラウザーで確認する：normalの一覧取得後に記事をクリックして詳細を取得し、severeに切り替えて詳細の遅延・エラー表示と再試行を確認する。
- 次の実装Stepはユーザー指示を待つ。Vitest導入・testスクリプト整備は別途承認が必要。
- 以下のStep番号は本ファイルで整理した案。実装はユーザーの指示を受けて進める。

## 今後の実装順
1. サンプル記事の一覧・詳細表示。
2. API・通信条件を確定し、モックAPIと実験設定を実装。
3. Service Workerとcache-first / network-firstを実装。
4. `src/cache/stalenessPolicy.js` とfreshness-awareを実装。
5. `src/metrics/logger.js` と `src/metrics/exportCsv.js` を実装。
6. 条件をそろえて比較実験し、結果と手順を `docs/` に記録。

## 注意事項
- 作業開始時に本ファイルと実装を確認し、各Step完了時に進捗・次のStep・更新日を更新する。
- 未確認事項を完了扱いにしない。研究方針の変更も記録する。
- React、Workbox、認証、地図、プッシュ通知、実ニュースAPIは導入しない。
- 外部ライブラリの新規導入は事前確認する。並行作業と編集スコープに注意する。
- コード変更時は `npm run test` を実行する。現状は未設定のため、テスト環境の整備が必要。
