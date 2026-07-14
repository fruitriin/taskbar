# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Directory Overview

このディレクトリ（`src/renderer`）は、Taskbar.fm のフロントエンド（Tauri の Webview で動く
Vue 3 アプリケーション）です。Composition API と TypeScript で記述されています。
バックエンドは Rust（`src-tauri/`）で、旧 Electron メインプロセスは Phase 3 で全廃されました。
なお `electron-mocks.ts` / `window.electron` / `utils.ts` の `Electron` オブジェクトという
命名は、モックが旧 Electron ブリッジの API 形状を互換のため踏襲していることによる
**意図的な残置**です（本体の Electron 依存はゼロ）。

## Development Commands

すべてのコマンドはリポジトリルートから実行してください：

### テスト関連

```bash
# レンダラーの全テストを実行
bun run test

# レンダラー＋Rust の全テスト
bun run test:all

# 特定のテストファイルを実行
cd src/renderer && bun test tests/window-sort.test.ts --preload ./tests/setup.ts --env happy-dom
```

### 型チェック

```bash
bun run typecheck
```

### ブラウザベーステスト

```bash
# ブラウザテスト用 dev サーバーを起動（Tauri なし・モック注入）
bun run dev:web

# ブラウザまたはPlaywright MCPでアクセス
# - http://localhost:10234/ (メインタスクバー)
# - http://localhost:10234/?view=option (設定画面)
# - http://localhost:10234/?view=menu (メニュー)
# - http://localhost:10234/?view=fullWindowList (全ウィンドウリスト)
```

実機で動かす場合は `bun run dev`（Tauri 起動、モックは注入されない）。

## Architecture

### Entry Points

エントリーポイントは **index.html / src/main.ts の1つ**で、URL の `?view=` パラメータで
ビューを切り替えます（App.vue がビューホスト）:

| view                | コンポーネント           | 内容                                      |
| ------------------- | ------------------------ | ----------------------------------------- |
| （なし）/ `taskbar` | pages/index.vue          | メインタスクバー UI                       |
| `option`            | pages/option.vue         | 設定画面（レイアウト・フィルター・権限）  |
| `menu`              | pages/menu.vue           | スタートメニュー                          |
| `fullWindowList`    | pages/fullWindowList.vue | 全ウィンドウリスト（開発用、Cmd+Shift+W） |

各ビューは App.vue で **動的 import** されるため、そのウィンドウに必要なモジュールと
スタイルだけが読み込まれます。Rust 側は `WebviewUrl::App("/?view=taskbar")` のように
クエリ付き URL でウィンドウを生成します（`src-tauri/src/display_manager.rs` ほか）。

### Vue Components Structure

```
src/
├── main.ts                      # 唯一のエントリーポイント（モック注入もここ）
├── App.vue                      # ?view= で切り替えるビューホスト（エラーバウンダリ付き）
├── components/
│   ├── AddFilter.vue            # フィルター追加UI
│   ├── Debug.vue                # デバッグ情報表示
│   ├── MainPermissionStatus.vue # メインUI用権限状態表示
│   └── PermissionStatus.vue     # 設定画面用権限状態表示
├── pages/                       # 各ビュー（App.vue から動的 import）
│   ├── index.vue                # メインタスクバーページ
│   ├── option.vue               # 設定ページ
│   ├── menu.vue                 # メニューページ
│   └── fullWindowList.vue       # 全ウィンドウリストページ
├── composables/
│   ├── ipc.ts                   # IPC 抽象層（Tauri / モックのランタイム切替）
│   ├── useOptions.ts            # 設定の購読と保存
│   └── useWindows.ts            # ウィンドウリストの購読
├── mocks/
│   ├── electron-mocks.ts        # ブラウザテスト用 IPC モック
│   └── sample-fixture.ts        # サンプルデータ定義
├── global.d.ts                  # MacWindow グローバル型（Rust 側と キー名一致）
└── utils.ts                     # 純関数群（グルーピング・並び順・D&D 判定）
```

### IPC Communication

IPC は **`src/composables/ipc.ts` に集約**されています。直接 `@tauri-apps/api` や
`window.electron` に触らず、必ずこのラッパーを使います:

- `ipcSend(channel, ...args)` — 戻り値を待たない invoke（旧 Electron の send 相当）
- `ipcInvoke<T>(channel, ...args)` — 戻り値を待つ invoke
- `ipcListen<T>(channel, handler)` — イベント購読（解除関数が返る）

ランタイム判定は `'__TAURI_INTERNALS__' in window`:

- **Tauri 実行時**: camelCase チャンネル名を snake_case コマンド名に変換して invoke
  （`activeWindow` → `active_window`）。位置引数は ARG_KEYS で名前付き引数に変換
- **ブラウザ/テスト時**: `mocks/electron-mocks.ts` が注入する `window.electron.ipcRenderer`
  互換モックへフォールバック

チャンネルとコマンドの対応表は `src-tauri/src/commands.rs` のコメントが一次情報です。

#### Composables（さらに上の層）

`useOptions()` / `useWindows()`（`src/composables/`）はモジュールシングルトンで、
リスナー登録と `windowReady` 送信を1回に抑えます。**`windowReady` はバックエンド側で
ウィンドウリストのリセットという副作用を持つため、コンポーネントから直接送らず
`useWindows()` を使うこと。**

`ipcSend` は引数を JSON クローンするため、Vue の reactivity proxy をそのまま渡せます。

### Browser-Based Testing with Mocks

`bun run dev:web` でブラウザから直接 UI にアクセスできます。

#### モックの仕組み

1. **自動注入**: `main.ts` が「vite DEV かつ Tauri でない」場合のみ
   `mocks/electron-mocks.ts` のモックを注入（Tauri 実機ではモックは入らない）
2. **自動イベント発火**: `windowReady` 送信でサンプルデータ
   （`process` / `iconUpdate` / `displayInfo` / `updateOptions`）が自動送信
3. **開発者ヘルパー**: `window.__mockHelpers` で手動制御が可能

#### 使用例

```javascript
// ブラウザコンソールで実行

// サンプルウィンドウを更新
__mockHelpers.updateWindows([{ kCGWindowOwnerName: 'MyApp', kCGWindowNumber: 999 /* ... */ }])

// イベントを手動発火
__mockHelpers.emit('process', __mockHelpers.sampleWindows)

// windowReadyを再トリガー（全イベントを再送信）
__mockHelpers.triggerWindowReady()
```

フィクスチャーは `src/mocks/sample-fixture.ts` を編集してカスタマイズできます。

### Styling

- **UnoCSS**（shortcuts で旧 bulma クラス名を再定義。`uno.config.ts`）
- コンポーネントスタイルは `<style scoped>`

## Testing

- **テストランナー**: Bun Test
- **セットアップ**: `tests/setup.ts`（happy-dom、IPC モック、window.store モック）
- テストは `tests/` 配下（純関数・composable・drag-session・view-router）

## Type Definitions

- `MacWindow` は `src/global.d.ts` のグローバル型。キー名（kCGWindowOwnerName 等）は
  Rust 側 `src-tauri/src/window_manager.rs` の serde rename と一致させること
- `Store` / `Options` / `LabeledFilters` は `src/types.ts`。
  Rust 側 `src-tauri/src/store.rs` の struct と JSON 互換を保つこと
- `window.electron` / `window.store` のグローバル宣言は `src/utils.ts`
  （モック専用。Tauri 実行時はどちらも存在しない）

## Key Technical Notes

### Window Ready Protocol

レンダラーが準備完了したことをバックエンドに通知する重要なプロトコル：

1. レンダラーが起動し `ipcSend('windowReady')` を送信（useWindows 経由）
2. バックエンドが初期データを emit：
   - `process` - ウィンドウリスト
   - `iconUpdate` - アイコンデータ（owner 名 → 生 base64。`process` の appIcon は
     `data:image/png;base64,` プレフィックス付き、という非対称に注意）
   - `displayInfo` - ディスプレイ情報
   - `updateOptions` - 設定データ

### Lint Rules（oxlint）

- すべての関数に戻り値の型を明示する
- 未使用変数は `_` プレフィックスで無視
