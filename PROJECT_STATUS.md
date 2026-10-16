# プロジェクト進捗

最終更新：2026-10-16

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
- api-custom：API種別ごとに戦略を変える本命方式（Step 9で実装予定）。APIと戦略の対応は実装時に確定する。
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
- Step 3.5は完了（ユーザー報告）。記事IDは既存の `news-001`〜`news-003` を維持しており、詳細確認にはこれらのIDを使用する。
- `vite.config.js` に `/api` → `http://localhost:3000` の開発用プロキシを追加。
- Step 4として `src/main.js` にService Worker対応判定と `/sw.js` の登録を追加。成功はconsole.log、失敗はconsole.errorで表示する。
- Step 5として `public/sw.js` にCache Firstを追加。同一オリジンでパスが `/api` から始まるGETのみを処理する。
- `news-api-cache-v1` 内でリクエストを照合し、命中時はキャッシュを返す。未保存時はネットワーク取得し、response.okの場合のみcloneして保存する。クエリ文字列も区別し、一覧・詳細の両方を対象とする。
- `cache hit` / `network fetch` の確認ログを追加。キャッシュ保存失敗時も取得済みレスポンスは返す。install / activateの既存ログは維持。
- Step 6：`public/sw.js` にNetwork Firstを追加し、一時固定で適用。Cache First関数は保持。同一オリジンの `/api`・`/api/` 配下へのGETのみを対象とする。
- Network Firstは毎回fetchを試み、response.okの場合のみcloneして既存キャッシュへ保存・更新する。通信エラーおよび503を含む5xxで同じURL（クエリを含む）のキャッシュへフォールバックする。API停止時にViteが500を返すことを実測済み。404などは保存せずそのまま返す。キャッシュ未命中はHTTPエラーを返すか通信例外を再送出し、既存UIのエラー処理へ渡す。
- `network success` / `network failed` / `fallback cache hit` / `fallback cache miss` のログを追加。保存に失敗しても取得済みの正常レスポンスは返す。skipWaitingとclients.claimを追加し、更新SWの有効化とクライアント制御を要求する。
- Step 6の構文確認・Node模擬検証は通過：一覧・詳細のネットワーク優先、キャッシュ更新、通信エラー・503・500での命中と未命中、404非保存、保存失敗時の応答維持、対象外URL・メソッドの除外、ライフサイクルとログ。
- `npm run dev` と `node server/mock-api.js` の起動、画面・更新済みsw.js・一覧/詳細APIの200応答を確認。Viteはサンドボックスの読み取り制限で初回起動に失敗したため、権限付きで再実行して確認。確認用プロセスは終了済み。
- Step 6の実ブラウザーでのSW有効化、Consoleログ、Cache Storage、画面表示は未確認。`npm run test` は再実行したがtestスクリプト未設定で失敗。新規ライブラリは追加していない。
- Freshness Aware、戦略切り替え処理、実験ログ、CSV出力は未実装。既存の戦略選択欄の値によらず、対象リクエストにはNetwork Firstを適用する。
- Step 5の構文確認とNodeによる模擬検証は通過：一覧・詳細の初回取得とキャッシュ命中、オフライン時の命中、クエリ区別、404/503を保存しないこと、対象外リクエストの除外、未保存時の通信失敗、保存失敗時の応答維持。起動中のVite経由で更新済みsw.jsの配信と一覧・詳細APIの200応答を確認。
- Step 5はブラウザーでの動作確認まで完了（2026-10-09、ユーザー報告）。API停止後も取得済みの記事は読み込め、未取得の記事は読み込めないことを確認。これはAPI停止時の確認であり、画面自体の完全オフライン起動を確認したものではない。
- Step 4の構文確認と登録成功・失敗・非対応時の模擬検証は通過。`npm run dev` の起動、`/sw.js` のJavaScript配信、Vite経由の一覧・詳細APIの200応答を確認。確認用Viteは終了済み。
- Step 4はブラウザー確認まで完了（2026-10-09、ユーザー報告）。案内したService Worker登録・Consoleの成功ログ・一覧取得と詳細表示の確認について完了報告を受領。
- Vitestとtestスクリプトは未設定。`npm run test` は実行したが Missing script: "test" で失敗。依存追加は行っていない。
- Step 3.5の構文・差分チェック、簡易DOMでの一覧・詳細URL・取得中・成功・404/503・通信エラー・再試行・応答競合の検証は通過。実APIで既存IDの詳細JSON、一覧、404のJSON、severeの約3.06秒後の200応答を確認。`npm run dev` の起動を確認し、検証用プロセスは終了。エージェントによる実ブラウザー確認は未実施だが、ユーザーから完了報告を受領済み。
- Gitはリポジトリとして認識されており、前回作業でGitHubへのmainのpushを確認済み。

## 次にやること
- Step 6の実装と模擬検証・起動確認まで完了。次はブラウザーで更新SWの有効化、normalでの一覧・詳細取得と再取得、API停止後のキャッシュ命中・未命中を確認する。Step 7には着手しない。
- Step 6〜12の順序と目的はユーザー指定の計画として記録済み（2026-10-09）。今回は計画更新のみで、先行実装は行っていない。
- Vitest導入・testスクリプト整備は別途承認が必要。

## 今後の実装順
1. サンプル記事の一覧・詳細表示。
2. API・通信条件を確定し、モックAPIと実験設定を実装。
3. APIから一覧・詳細を取得（Step 3 / 3.5、完了）。
4. Service Workerの登録のみ（Step 4、ブラウザー確認まで完了・ユーザー報告）。
5. Cache Firstのみ（Step 5、ブラウザー動作確認まで完了・ユーザー報告）。
6. Network First実装：実装・模擬検証・起動確認済み。実ブラウザーでの動作確認待ち。
7. Freshness Aware実装：許容鮮度を考慮した戦略を実装する。鮮度判断は `src/cache/stalenessPolicy.js` に配置する（未着手）。
8. 戦略切り替え機能：`all-cache-first` などを画面で選べるようにする（未着手）。
9. api-custom実装：API種別ごとに戦略を変える本命方式を実装する（未着手）。
10. 実験ログ記録：表示時間、成功、取得元、鮮度違反を記録する。`src/metrics/logger.js` に配置する（未着手）。
11. CSV出力：実験結果を卒論で集計できる形にする。`src/metrics/exportCsv.js` に配置する（未着手）。
12. 実験条件リセット機能：キャッシュ削除など、測定条件をそろえる（未着手）。

実装後に条件をそろえて比較実験し、結果と手順を `docs/` に記録する。

## 注意事項
- 作業開始時に本ファイルと実装を確認し、各Step完了時に進捗・次のStep・更新日を更新する。
- 未確認事項を完了扱いにしない。研究方針の変更も記録する。
- React、Workbox、認証、地図、プッシュ通知、実ニュースAPIは導入しない。
- 外部ライブラリの新規導入は事前確認する。並行作業と編集スコープに注意する。
- コード変更時は `npm run test` を実行する。現状は未設定のため、テスト環境の整備が必要。
