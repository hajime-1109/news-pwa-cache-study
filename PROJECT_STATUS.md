# プロジェクト進捗

最終更新：2026-09-25

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
- 実ニュースAPIは使わず、`server/mock-api.js` にモックAPIを実装する（未実装）。
- サンプル記事の項目：`id`、`title`、`category`、`body`、`updatedAt`、`maxStalenessSec`。
- エンドポイント、応答形式、記事更新の制御方法は未確定。

## 通信条件
- UIの選択肢：normal / mild / severe / unstable。
- 遅延・失敗率などの数値と再現方法は未確定・未実装。
- 実験設定は `src/config/experimentConfig.js` に配置する。

## 現在の進捗
- Vite設定と依存パッケージを準備済み。
- `index.html` に戦略・通信条件の選択、取得ボタン、記事表示領域を用意済み。
- `src/data/sample-news.json` に記事3件を用意済み。JSON構文確認済み。
- `src/main.js`、`src/app.js`、`src/styles.css` は実質空。記事取得・表示は未実装。
- Service Worker、鮮度判定、モックAPI、実験設定、ログ、CSV出力は未実装。
- マニフェスト、README、仕様書は実質空。Vitestとtestスクリプトも未設定。
- ブラウザでの動作は未確認。Gitは `.git` が存在するもののリポジトリとして認識されず、履歴・差分は未確認。

## 次にやること
- 次のStep案：サンプル記事の一覧・詳細表示を実装し、ブラウザで確認する。
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
