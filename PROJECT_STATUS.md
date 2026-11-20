# プロジェクト進捗

最終更新：2026-11-20

## 研究テーマ
- ニュースPWAにおけるAPI種別と許容鮮度に基づくキャッシュ戦略カスタマイズの性能評価。

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
- freshness-aware：Step 7ではユーザー指定により、API種別ごとの許容鮮度とキャッシュ保存時刻で利用を判断する。期限超過・鮮度不明でも通信失敗時は警告付きで返す。記事自体の更新時刻に基づく鮮度とは区別する。
- api-custom：API種別ごとに戦略を変える本命方式。今回のStep 9には含めず、実装時期・対応戦略は今後の指示で確定する。
- 記事JSONはmaxStalenessSecを持たない。キャッシュ鮮度はAPI別許容時間と保存時刻から判断し、updatedAtは使用しない。
- API別許容鮮度：`/api/emergency`＝60秒、`/api/important`＝600秒、`/api/articles`＝1800秒、`/api/static-info`＝86400秒。一覧・各API配下の詳細ともpathnameで判定し、クエリには依存しない。

## API設計
- 実ニュースAPIは使わず、`server/mock-api.js` にExpressのモックAPIを実装済み（ポート3000）。
- サンプル記事の項目：`id`、`title`、`category`、`body`、`updatedAt`。
- `/api/emergency`、`/api/important`、`/api/articles`、`/api/static-info` が、それぞれemergency・important・normal・static-infoの記事配列を各1件、重複なしで返す。記事更新の制御方法は未確定。
- 各APIの `/:id` は通信条件を適用し、そのAPIの分類とIDが一致する記事を返す。不存在・別分類IDは404と `{ "error": "Article not found" }` を返す。

## 通信条件
- UIの選択肢：normal / mild / severe / unstable。
- モックAPIに遅延・失敗率を実装済み：normal＝100ms・0%、mild＝1000ms・10%、severe＝3000ms・30%、unstable＝100〜5000ms・30%。`condition` クエリで選択する。乱数の再現方法は未実装。
- 実験設定は `src/config/experimentConfig.js` に配置する。
- `condition` 省略時は `normal`。不正値はHTTP 400と `{ "error": "Invalid condition" }` を返す。模擬通信失敗は遅延後に判定し、HTTP 503と `{ "error": "Service unavailable" }` を返す。`unstable` の遅延は100〜5000msの整数から一様に選ぶ。
- 初期検証（2026-09-25）：4 APIの `normal` 応答、`condition` の省略・不正値への応答、検証時の乱数固定による `mild`・`severe`・`unstable` の503とエラーJSONを確認。
- 旧進捗表には、Express導入時のnpm監査で重大度Highの報告が2件あったとの記録がある（2026-09-25時点）。

## 現在の進捗
- Vite設定と依存パッケージを準備済み。
- `index.html` にAPI種別・戦略・通信条件の選択、取得ボタン、記事表示領域を用意済み。
- `src/data/sample-news.json` に4分類の記事4件を用意済み。既存ID news-001〜003を維持し、通常ニュースnews-004を追加。防災用品はstatic-infoへ分類。
- Step 1〜3は完了。Step 3のブラウザー確認も完了（ユーザー報告）。
- 一覧取得はStep 9で選択APIへ変更。クリック時に選択中の通信条件で同じAPI種別の詳細をfetchし、取得中・成功・失敗を表示する。連続クリック・一覧再取得・API切り替え時は古い詳細応答を無視する。
- Step 3.5は完了（ユーザー報告）。記事IDは既存の `news-001`〜`news-003` を維持しており、詳細確認にはこれらのIDを使用する。
- `vite.config.js` に `/api` → `http://localhost:3000` の開発用プロキシを追加。
- Step 4として `src/main.js` にService Worker対応判定と `/sw.js` の登録を追加。成功はconsole.log、失敗はconsole.errorで表示する。
- Step 5として `public/sw.js` にCache Firstを追加。同一オリジンでパスが `/api` から始まるGETのみを処理する。
- `news-api-cache-v1` 内でリクエストを照合し、命中時はキャッシュを返す。未保存時はネットワーク取得し、response.okの場合のみcloneして保存する。クエリ文字列も区別し、一覧・詳細の両方を対象とする。
- `cache hit` / `network fetch` の確認ログを追加。キャッシュ保存失敗時も取得済みレスポンスは返す。install / activateの既存ログは維持。
- Step 6：`public/sw.js` にNetwork Firstを追加。当初は一時固定で適用し、現在はStep 8の選択に従う。Cache First関数は保持。同一オリジンの `/api`・`/api/` 配下へのGETのみを対象とする。
- Network Firstは毎回fetchを試み、response.okの場合のみcloneして既存キャッシュへ保存・更新する。通信エラーおよび503を含む5xxで同じURL（クエリを含む）のキャッシュへフォールバックする。API停止時にViteが500を返すことを実測済み。404などは保存せずそのまま返す。キャッシュ未命中はHTTPエラーを返すか通信例外を再送出し、既存UIのエラー処理へ渡す。
- `network success` / `network failed` / `fallback cache hit` / `fallback cache miss` のログを追加。保存に失敗しても取得済みの正常レスポンスは返す。skipWaitingとclients.claimを追加し、更新SWの有効化とクライアント制御を要求する。
- Step 6の構文確認・Node模擬検証は通過：一覧・詳細のネットワーク優先、キャッシュ更新、通信エラー・503・500での命中と未命中、404非保存、保存失敗時の応答維持、対象外URL・メソッドの除外、ライフサイクルとログ。
- `npm run dev` と `node server/mock-api.js` の起動、画面・更新済みsw.js・一覧/詳細APIの200応答を確認。Viteはサンドボックスの読み取り制限で初回起動に失敗したため、権限付きで再実行して確認。確認用プロセスは終了済み。
- Step 6のネットワーク失敗時のキャッシュへのフォールバックは確認済み（Step 7依頼時のユーザー報告）。`npm run test` はtestスクリプト未設定で失敗。新規ライブラリは追加していない。
- Step 7：`src/config/experimentConfig.js` にAPI別許容鮮度、`src/cache/stalenessPolicy.js` に経過秒数と鮮度判定を追加。`cacheAgeSec <= maxStalenessSec`（境界を含む）で新鮮と判断する。保存時刻が欠落・不正・未来の場合や未知のAPIは新鮮と判断しない。
- `public/sw.js` に独立したfreshnessAware関数を追加。当初の一時固定から、現在はStep 8の選択に従う。既存cacheFirst・networkFirstは保持。3戦略の正常なネットワーク取得後の保存処理を共通化し、キャッシュレスポンスの `X-Cache-Saved-At` ヘッダーへDate.now()を記録する。キャッシュ利用のみでは更新しない。
- 新鮮なキャッシュは通信せず返す。期限超過・鮮度不明・未保存はネットワーク取得を試み、成功時に本文と保存時刻を更新する。通信エラー・503を含む5xxで古いキャッシュがあれば返す。404などは保存せず通常のエラーとして返す。キャッシュも利用できない場合は既存画面のエラー処理へ渡す。
- 指定の6種類のfreshnessログを追加。古いキャッシュを返す場合は経過秒数（不明時unknown）・許容鮮度・stalenessViolationをConsoleに表示し、返却レスポンスだけに警告用ヘッダーを付加する。`src/app.js` は一覧・詳細それぞれに簡単な注意を表示し、正常取得や再取得時に古い注意を解除する。実験ログの永続記録は行わない。
- `src/main.js` のSW登録をmodule形式へ変更。`vite.config.js` はビルド時にSWが参照する設定・判定モジュールを同じパスへ出力する。新規ライブラリは追加していない。
- Step 7の構文・差分確認、Viteビルド、Node模擬検証は通過：5種類のAPIの指定閾値・境界、保存と更新、通信なしの命中、Worker再作成後の時刻維持、503/500/通信失敗時の警告付きフォールバック、404非保存、未保存時の失敗、時刻欠落・不正・未来、キャッシュ保存/読み取り失敗、既存2戦略の維持、対象外リクエスト除外、指定ログ。一覧・詳細の警告表示/解除とエラー表示は簡易DOMでも検証済み。
- Step 7の実ブラウザーでのSW更新・再起動、Cache Storageの保存時刻、一覧・詳細の警告表示は未確認。`npm run test` は今回もtestスクリプト未設定で失敗。模擬検証を実ブラウザー確認の代わりに完了扱いにはしない。
- Step 8：ユーザーの追加依頼により、既存の戦略プルダウンを取得処理へ接続。Cache First / Network First / Freshness Awareを選べる。内部値 `freshness-aware` は既存freshnessAware関数へ対応する。新しいボタンやCSSは追加していない。
- 2026-10-16のコード再確認で、`index.html` の表示名もFreshness Awareに統一されていることを確認。HTMLのvalueは内部識別子、optionの本文は画面表示名として区別する。画面の初期選択は先頭のCache First。
- 鮮度を調整するファイルは `src/config/experimentConfig.js`、判定処理は `src/cache/stalenessPolicy.js`。現設定は指定どおり60・600・1800・86400秒で、検証用の5秒設定には変更されていない。
- 一覧・詳細の取得時に選択値を `X-Cache-Strategy` ヘッダーでSWへ渡し、SWが3つの独立した関数から選択する。ヘッダーはAPI取得・キャッシュ照合の前に取り除き、同じURLのキャッシュを共有する。リクエストごとの指定なのでWorker再起動や別タブの選択に依存しない。指定なしはFreshness Aware、無効値は400を返す。
- 戦略変更時は前の一覧・詳細表示をクリアし、取得中だった古い応答を無視する。SWがページを制御していない間は取得せず、再試行・再読み込みを案内する。
- Step 8の構文・差分確認、Viteビルド、Node模擬検証は通過：一覧/詳細の3戦略切り替え、共有キャッシュ、Network Firstの通信優先、Freshness Awareの新鮮キャッシュ利用、無効値の拒否、APIへの戦略ヘッダー非送信、UI選択値の反映、切り替え前応答の無視、SW未制御時の案内。実ブラウザーでの操作は未確認。`npm run test` はtestスクリプト未設定で失敗。
- 実験ログはStep 10でメモリー内への記録、Step 11でCSV出力を実装済み。api-customは未実装。
- Step 5の構文確認とNodeによる模擬検証は通過：一覧・詳細の初回取得とキャッシュ命中、オフライン時の命中、クエリ区別、404/503を保存しないこと、対象外リクエストの除外、未保存時の通信失敗、保存失敗時の応答維持。起動中のVite経由で更新済みsw.jsの配信と一覧・詳細APIの200応答を確認。
- Step 5はブラウザーでの動作確認まで完了（2026-10-09、ユーザー報告）。API停止後も取得済みの記事は読み込め、未取得の記事は読み込めないことを確認。これはAPI停止時の確認であり、画面自体の完全オフライン起動を確認したものではない。
- Step 4の構文確認と登録成功・失敗・非対応時の模擬検証は通過。`npm run dev` の起動、`/sw.js` のJavaScript配信、Vite経由の一覧・詳細APIの200応答を確認。確認用Viteは終了済み。
- Step 4はブラウザー確認まで完了（2026-10-09、ユーザー報告）。案内したService Worker登録・Consoleの成功ログ・一覧取得と詳細表示の確認について完了報告を受領。
- Vitestとtestスクリプトは未設定。`npm run test` は実行したが Missing script: "test" で失敗。依存追加は行っていない。
- Step 3.5の構文・差分チェック、簡易DOMでの一覧・詳細URL・取得中・成功・404/503・通信エラー・再試行・応答競合の検証は通過。実APIで既存IDの詳細JSON、一覧、404のJSON、severeの約3.06秒後の200応答を確認。`npm run dev` の起動を確認し、検証用プロセスは終了。エージェントによる実ブラウザー確認は未実施だが、ユーザーから完了報告を受領済み。
- Gitはリポジトリとして認識されており、前回作業でGitHubへのmainのpushを確認済み。

## Step 9（2026-11-13）
- 変更：src/data/sample-news.json、server/mock-api.js、index.html、src/app.js、src/cache/stalenessPolicy.js、PROJECT_STATUS.md。
- 実HTTP確認：emergency＝news-001、important＝news-002、articles＝news-004、static-info＝news-003。各一覧1件・詳細200・不存在ID404。確認用HTTPサーバーは終了済み。
- Node模擬検証：全APIの別分類ID404、通信条件4種類の遅延・失敗分岐、一覧・詳細の60 / 600 / 1800 / 86400秒と境界判定が通過。
- UI模擬検証：選択APIの一覧・詳細URL、conditionとX-Cache-Strategy、URLに基づく許容鮮度表示、警告、切り替え前の一覧・詳細応答の無視が通過。undefined表示なし。詳細の通信条件はクリック時の選択値。
- SW模擬検証：全APIの一覧・詳細で3戦略、共有キャッシュ、保存時刻、期限超過後の503フォールバックと警告ヘッダーが通過。public/sw.js・experimentConfig.js・通信条件の設定値は変更なし。
- Viteビルド成功。初回はサンドボックスの設定読込制限で失敗し、権限付き再実行で通過。npm run testはMissing script: "test"で失敗。新規ライブラリ・testスクリプトは追加していない。
- UI模擬検証は日本語文字列のパイプ転送で一度失敗し、検証文字列をUnicode表記へ変更して通過。
- 未確認：実ブラウザー操作、SW更新・Cache Storage、実時間経過での警告、実通信の確率分布。実装・自動検証は完了、実ブラウザー確認を含む最終完了判定は保留。
- 手動確認：node server/mock-api.jsとnpm run devを起動し、SW更新・制御を確認。4 API×3戦略で一覧・詳細を取得。Network Firstで通信条件を変更し、低速取得中のAPI切り替えで旧応答が現れないことを確認。Cache Storageの保存時刻を期限超過にし、Freshness Awareで同じURLへの通信を失敗させ、一覧・詳細の警告を確認。正常な再取得で警告が解除されることも確認する。
- api-custom・実験ログ・CSV・キャッシュ初期化・予備実験・Step 10は未実装。

## Step 10（2026-11-13）
- 変更：src/metrics/logger.js（新規）、src/app.js、public/sw.js、PROJECT_STATUS.md。Step 9のAPI選択・分類・詳細ルートを維持。ライブラリ追加なし。
- logger.jsのrecordLog()で配列へ記録し、getLogs()でコピーを参照する。startMeasurement()で測定開始時のAPI・戦略・通信条件を固定し、操作ごとに1件記録。ページ再読み込みでログは消える。
- 項目：timestamp、apiPath、requestType、strategy、condition、durationMs、outcome、responseStatus、responseSource、cacheAgeSec、maxStalenessSec、stalenessViolation、error。
- timestampは操作開始時のISO日時。apiPathはクエリなしの要求pathname（詳細はIDを含む）。requestTypeはlist / detail。durationMsはperformance.now()による操作開始〜DOM更新完了で、実描画時間ではない。discardedでは破棄を検出した時点までの時間。
- SWは返却経路ごとにX-Response-Sourceをnetwork / cache / cache-fallbackに設定する。保存前の応答・保存関数・戦略判断は変更しない。計測用取得元ヘッダーはキャッシュへ保存しない。
- outcomeはsuccess / failure / discarded。通信失敗後もキャッシュを表示できればsuccessかつcache-fallback。キャッシュ優先で通信せず表示した場合はcache。最終HTTP応答がない場合はresponseStatus=null、responseSource=none。errorは最終表示失敗の内容で、正常なフォールバック時はnull。
- 鮮度違反は全3戦略共通で、実際に表示したキャッシュ応答のX-Cache-Saved-AtとDOM更新完了時の時刻から計算する。cacheAgeSec > maxStalenessSecをtrue、境界はfalse。保存時刻不明・不正・未来はnull。Console・警告・X-Cache-Staleは判定根拠にしない。
- ネットワーク成功はcacheAgeSec=null、stalenessViolation=false。失敗・discardedは表示したキャッシュがないため両方null。取得元ヘッダーがない旧SW応答はnoneとし、鮮度違反を推測しない。
- 模擬統合検証148件：4 API×3戦略の一覧・詳細、normal / severe、キャッシュ有無、通信例外・500・503・404、DOM更新後の時間計測、期限超過・保存時刻不明・境界・DOM更新中の期限超過、切り替え前の成功／失敗応答と詳細のdiscarded、ログコピーの独立性、保存失敗時のネットワーク応答維持が通過。
- 実HTTP検証21件：Emergencyの一覧・詳細で3戦略のnormal / severe、API停止後のキャッシュ利用・フォールバック・未保存時の失敗を確認。severeは検証用乱数を固定して成功経路を確認し、503分岐は模擬統合検証で確認。HTTP検証はSWとログ関数をNodeで接続したもので、実ブラウザー検証ではない。検証用サーバーは終了済み。
- 検証コードは警告要素の取り違えと、HTTP応答ストリームの簡易保存方式で一度ずつ失敗。要素選択と、本文を読み切って保存する検証用Cache Storageを修正し再検証通過。
- Viteビルド成功（初回はサンドボックスの設定読込制限で失敗、権限付き再実行で通過）。構文・差分チェック通過。npm run testは既存のMissing script: "test"で失敗。Vitestやtestスクリプトは追加していない。
- 未確認：実ブラウザーでのSW更新、画面操作、Cache Storageの永続化を含む実環境でのログ照合。実装・自動検証は完了し、実ブラウザー確認は保留。
- 手動確認：APIとViteを起動し、SW更新・制御を確認して一覧・詳細を取得。開発者ツールのConsoleで const { getLogs } = await import('/src/metrics/logger.js'); console.table(getLogs()); を実行して確認する。Network Firstでnormal / severeを試し、API停止後に同一URLの保存済みデータがsuccess / cache-fallbackになること、未保存URLがfailureになることを確認。Cache FirstとFreshness Awareは通信なしの命中がcacheになることを確認。低速取得中のAPI・戦略切り替えではdiscardedが記録されることを確認する。
- Step 10完了時点ではCSV出力、キャッシュ経過時間の操作、api-custom、予備実験・本実験は未実装。

## Step 11（2026-11-20）
- `src/metrics/exportCsv.js`、`src/app.js`、`index.html` を変更。「実験ログをCSVで保存」でクリック時点のログ全件を記録順にダウンロードする。0件のときは画面に案内を表示する。
- Step 10の13項目を固定順で出力する。nullは空欄、真偽値はtrue/falseとし、カンマ・引用符・改行を含むセルはCSV形式に従ってエスケープする。UTF-8 BOM付きで、ファイル名にUTC日時を含める。
- Node模擬検証で0件時の案内、3種類の結果の出力、列順、空欄、数値・真偽値、エスケープ、BOM、ダウンロード処理、ログの保持を確認。Viteビルドと構文・差分チェックは通過。npm run testはtestスクリプト未設定で実行不可。実ブラウザーからのダウンロードは未確認。

## Step 12（2026-11-20）
- 画面にCold・Fresh・Expiredの選択と初期化結果表示を追加。Service Workerが実験用キャッシュを削除し、Fresh・Expiredではnormalで再取得した一覧・詳細を選択中の通信条件のキーで保存する。設定経過時間はAPI別許容鮮度の50%・150%。保存時刻を検証し、準備途中に失敗した場合は実験用キャッシュを削除する。
- 初期化と取得の競合を画面とService Workerで防止する。初期化は測定ログに含めず、初期化後の一致するキーごとの最初の取得に初期状態と設定経過秒数を記録し、CSV末尾の2列に出力する。
- Node模擬検証を通過。4 API×一覧・詳細×3戦略×3状態の72通り、期限切れ時の503フォールバック8通り、保存途中の失敗時の削除、取得と初期化の排他、画面とログ・CSVへの連携を確認。Viteビルド、構文・差分チェックも通過。npm run testはtestスクリプト未設定。実ブラウザーでの初期化・ダウンロードは未確認。
- 実験手順と指標の集計定義は `docs/experiment-protocol.md` に記録。予備実験には未着手。

## 次にやること
- 実ブラウザーで4 API×3戦略の表示・警告・ログを照合し、キャッシュ初期化とダウンロードしたCSVを確認する。
- Step 6〜12の順序と目的はユーザー指定の計画として記録済み（2026-10-09）。実装は依頼されたStepまでとする。
- Vitest導入・testスクリプト整備は別途承認が必要。

## 今後の実装順
1. サンプル記事の一覧・詳細表示。
2. API・通信条件を確定し、モックAPIと実験設定を実装。
3. APIから一覧・詳細を取得（Step 3 / 3.5、完了）。
4. Service Workerの登録のみ（Step 4、ブラウザー確認まで完了・ユーザー報告）。
5. Cache Firstのみ（Step 5、ブラウザー動作確認まで完了・ユーザー報告）。
6. Network First実装：実装・模擬検証・起動確認済み。ネットワーク失敗時のフォールバック確認済み（ユーザー報告）。
7. Freshness Aware実装：実装・模擬検証・ビルド確認済み。実ブラウザーでの動作確認待ち。
8. 戦略切り替え機能：既存プルダウンで3戦略を選択する実装・模擬検証・ビルド確認済み。実ブラウザーでの動作確認待ち。
9. API種別ごとの取得処理の整理：4分類・一覧と詳細の分離・API選択・URLに基づく許容鮮度表示を実装済み。実ブラウザー確認待ち。api-customは含めない。
10. 実験ログ記録：`src/metrics/logger.js` に配列保持・記録・参照を実装済み。DOM更新までの時間、成功／失敗／破棄、取得元、保存時刻に基づく鮮度違反を記録。自動検証済み、実ブラウザー確認待ち。
11. CSV出力：`src/metrics/exportCsv.js` に実装済み。実ブラウザーでのダウンロード確認待ち。
12. 実験条件リセット機能：Cold・Fresh・Expiredを実装し、模擬検証を通過。実ブラウザー確認待ち。

実装後に条件をそろえて比較実験し、結果と手順を `docs/` に記録する。

## 注意事項
- 作業開始時に本ファイルと実装を確認し、各Step完了時に進捗・次のStep・更新日を更新する。
- 未確認事項を完了扱いにしない。研究方針の変更も記録する。
- React、Workbox、認証、地図、プッシュ通知、実ニュースAPIは導入しない。
- 外部ライブラリの新規導入は事前確認する。並行作業と編集スコープに注意する。
- コード変更時は `npm run test` を実行する。現状は未設定のため、テスト環境の整備が必要。
