# 災害ニュースPWA

## モックAPI

Node.js 20以上で、プロジェクトのルートから実行します。

```sh
npm install
node server/mock-api.js
```

APIサーバは `http://localhost:3000` で起動します。終了は `Ctrl+C` です。
画面も起動する場合は、別のターミナルで `npm run dev` を実行します。
現在の画面はローカルJSONを使っており、APIにはまだ接続していません。

### 確認URL

- http://localhost:3000/api/emergency?condition=normal
- http://localhost:3000/api/important?condition=normal
- http://localhost:3000/api/articles?condition=normal
- http://localhost:3000/api/static-info?condition=normal
- http://localhost:3000/api/articles?condition=severe

成功時は `src/data/sample-news.json` の記事をJSON配列で返します。
各記事には `id`, `title`, `category`, `body`, `updatedAt`, `maxStalenessSec` が含まれます。

| API | 返す記事 |
| --- | --- |
| `/api/emergency` | `category` が `emergency` の記事 |
| `/api/important` | `category` が `important` の記事 |
| `/api/articles` | 全記事 |
| `/api/static-info` | `category` が `normal` の記事（防災の基礎情報） |

### 通信条件

| condition | 遅延 | 失敗率 |
| --- | --- | --- |
| `normal` | 100ms | 0% |
| `mild` | 1000ms | 10% |
| `severe` | 3000ms | 30% |
| `unstable` | 100〜5000msの整数を一様ランダムに選択 | 30% |

各リクエストで遅延後に失敗を判定します。失敗時はHTTP 503と
`{"error":"Service unavailable"}` を返します。
失敗は確率的なので、`severe` でも毎回503になるわけではありません。
上記の遅延はサーバ側で追加する待機時間で、実際の応答時間には通信などの時間も加わります。

`condition` の省略時は `normal` です。不正な値はHTTP 400と
`{"error":"Invalid condition"}` を返します。
