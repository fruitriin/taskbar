---
title: Playwright MCP不在時にCDPで直接ブラウザを操作してE2E診断する
created: 2026-07-16
last_verified: 2026-07-16
depends_on: []
status: active
---

# Playwright MCP不在時にCDPで直接ブラウザを操作してE2E診断する

## 発見した知見

Playwright MCPがセッションに接続されていない環境でも、ローカルにChromeがあれば
Chrome DevTools Protocol（CDP）を素のNode.js（`node:child_process` + グローバル
`WebSocket`、Node 18+）だけで直接叩いて、実ブラウザでのE2E診断ができる。npm/bunの
追加インストールも最小限（`npx chrome-remote-interface`程度、実際には自前のCDP
JSON-RPCクライアントを10行程度書けば十分で依存すら不要）。

**手順の骨格**:
1. `spawn('/Applications/Google Chrome.app/.../Google Chrome', ['--remote-debugging-port=PORT', '--user-data-dir=<一時dir>', URL])`
2. `http://localhost:PORT/json/list` をポーリングして対象タブの `webSocketDebuggerUrl` を取得
3. その WebSocket に接続し、`{id, method, params}` 形式でCDPコマンドを送る（`Runtime.enable`, `Page.enable`, `Runtime.evaluate` 等）
4. `Runtime.evaluate` に `awaitPromise: true, returnByValue: true` を付けて、ページ内で
   async IIFEを実行させれば、DOM操作・イベント発火・ログ収集を全部ページ側JSで完結でき、
   結果をJSON文字列でNode側に戻せる

## プロジェクトへの適用

taskbar.fm の D&D フリッカー修正（group-drag-swap-fix.md）で、オーナーとの主観的な
「アニメーションが早すぎる/効いてない」フィードバックが何往復しても収束しなかったため、
実際に何が起きているかを計測することにした:

- `bun run dev:web`（ブラウザ用モック注入サーバー）を起動
- `window.__mockHelpers.updateWindows(...)` でグループ化されたウィンドウ構成を注入
- `PointerEvent` を `dispatchEvent` で合成し、実際のドラッグを再現（`document.dispatchEvent`
  でリッスンしているコードに対しては `document` 側にdispatchする必要がある — コンポーネント側の
  リスナー登録箇所と揃えること）
- 全 `.task-group`/`.task` 要素に `transitionrun`/`transitionstart`/`transitionend`/
  `transitioncancel` のリスナーを仕込み、`performance.now()` 基準のタイムスタンプで記録
- 結果、実際のスワップは設定した duration（150ms）とほぼ一致する時間（実測140ms）で
  完走していることを客観的に確認できた。主観的な「速すぎる/効いてない」という体感と、
  実測のタイミングが一致しているとは限らない（本件では「短距離移動 + 目立たない背景要素」が
  体感の原因で、メカニズム自体は正しく動いていた）

## 注意点・制約

- **`Page.navigate` でフルリロードすること**: Vite の HMR を長時間使い続けた開発サーバーの
  ページをそのまま使うと、複数の Vue コンポーネントインスタンスが残留し（onMounted の
  リスナーが多重登録される等）、データが混ざって見える現象が起きた（本件で実際に発生し、
  「初期データがサンプルとカスタムの混合になる」という不可解な結果に繋がった）。診断前に
  必ず `Page.navigate` で新規ロードし、ページ側の状態を1インスタンスにリセットすること
- **モックのイベント発火に遅延がある場合、注入直後の待ち時間を長めに取る**: taskbar.fm の
  `electron-mocks.ts` は `windowReady` 受信後に `setTimeout(..., 100〜400ms)` で段階的に
  `process`/`iconUpdate`/`displayInfo`/`updateOptions` を発火する設計だった。ページ読み込み
  直後に自動発火するこれらの遅延イベントと、診断スクリプトが追加で注入するデータの発火が
  競合すると、後着イベントが先に注入したデータを上書きして「消えた」ように見える。
  ページロード後に十分待つ（遅延の合計以上）か、モック側の自動発火をバイパスする方法を
  用意してから注入すること
- **合成 `PointerEvent` はバブリングとリスナー登録先を実装と一致させる**: `pointerdown` は
  要素に、`pointermove`/`pointerup` は `document` にリッスンされている、といった実装の
  詳細を把握してから `dispatchEvent` の対象を選ぶこと。ずれると何のイベントも処理されず
  沈黙する（エラーも出ないため気づきにくい）
- **`transitionrun`/`transitionstart` が観測できないことがある**: リスナー登録前に
  トランジションが開始していた場合、`transitionend` だけ観測されて start/run が欠落する。
  「開始時刻不明の transitionend」が出たら、リスナー登録前から進行中だった別の遷移（本件では
  データ注入時のレイアウト再構成）を疑うこと

## 参照

- `/private/tmp/.../scratchpad/e2e-drag-probe.mjs`（本件で使った診断スクリプトの実装。
  セッションのスクラッチパット配下のため永続しない — 再利用する場合はこのファイルの
  「手順の骨格」からその都度書き起こす）
- `src-renderer/src/mocks/electron-mocks.ts`（taskbar.fm のモック実装。他プロジェクトでは
  対象の dev サーバー・モック機構に合わせて読み替える）
