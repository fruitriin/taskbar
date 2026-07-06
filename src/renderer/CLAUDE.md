# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Directory Overview

このディレクトリ（`src/renderer`）は、Taskbar.fmアプリケーションのElectronレンダラープロセスを含んでいます。Vue.js 3を使用したUIレイヤーで、Composition APIとTypeScriptで記述されています。

## Development Commands

すべてのコマンドはリポジトリルートから実行してください：

### テスト関連

```bash
# レンダラープロセスの全テストを実行
bun run test:renderer

# 特定のテストファイルを実行
cd src/renderer && bun test tests/sample.test.ts --preload ./tests/setup.ts

# プロジェクトルートからの実行例
bun test src/renderer/tests/sample.test.ts --preload src/renderer/tests/setup.ts
```

### 型チェック

```bash
# レンダラープロセスの型チェック
bun run typecheck:web
```

### ブラウザベーステスト

```bash
# 開発サーバーを起動
bun run dev

# ブラウザまたはPlaywright MCPでアクセス
# - http://localhost:10234/ (メインタスクバー)
# - http://localhost:10234/?view=option (設定画面)
# - http://localhost:10234/?view=menu (メニュー)
# - http://localhost:10234/?view=fullWindowList (全ウィンドウリスト)
```

## Architecture

### Entry Points

エントリーポイントは **index.html / src/main.ts の1つ**で、URL の `?view=` パラメータで
ビューを切り替えます（リアーキ Phase 1 スライス 1-B で統合。App.vue がビューホスト）:

| view                | コンポーネント           | 内容                                      |
| ------------------- | ------------------------ | ----------------------------------------- |
| （なし）/ `taskbar` | pages/index.vue          | メインタスクバー UI                       |
| `option`            | pages/option.vue         | 設定画面（レイアウト・フィルター・権限）  |
| `menu`              | pages/menu.vue           | 右クリックメニュー                        |
| `fullWindowList`    | pages/fullWindowList.vue | 全ウィンドウリスト（開発用、Cmd+Shift+W） |

各ビューは App.vue で **動的 import** されるため、そのウィンドウに必要なモジュールと
スタイルだけが読み込まれます（menu は bulma 非依存の独自リセットを維持）。
メインプロセス側は dev では `ELECTRON_RENDERER_URL + '/?view=xxx'`、prod では
`loadFile(index.html, { query: { view: 'xxx' } })` で開きます。

### Vue Components Structure

```
src/
├── main.ts                      # 唯一のエントリーポイント（モック注入もここ）
├── App.vue                      # ?view= で切り替えるビューホスト（エラーバウンダリ付き）
├── components/
│   ├── AddFilter.vue            # フィルター追加UI
│   ├── Debug.vue                # デバッグ情報表示
│   ├── MainPermissionStatus.vue # メインUI用権限状態表示
│   ├── PermissionStatus.vue     # 設定画面用権限状態表示
│   └── Versions.vue             # バージョン情報表示
├── pages/                       # 各ビュー（App.vue から動的 import）
│   ├── index.vue                # メインタスクバーページ
│   ├── option.vue               # 設定ページ
│   ├── menu.vue                 # メニューページ
│   └── fullWindowList.vue       # 全ウィンドウリストページ
├── mocks/
│   ├── electron-mocks.ts        # Electron APIのモック実装
│   └── sample-fixture.ts        # サンプルデータ定義
└── utils.ts                     # ユーティリティ関数

```

### IPC Communication

preload（@electron-toolkit/preload）が注入する **`window.electron.ipcRenderer`**（小文字）が実体です。
直接は触らず、以下のラッパーを使います:

- **新規コード（推奨）**: `src/composables/ipc.ts` の `ipcSend` / `ipcListen` / `ipcInvoke`
  （リアーキ Phase 1 で導入。Phase 3 でこの層だけ Tauri 実装に差し替わる）
- **既存コード**: `src/utils.ts` の `Electron.send` / `Electron.listen`（段階的に ipc.ts へ移行中）

#### Sending to Main Process

```typescript
import { ipcSend } from '@/composables/ipc'

ipcSend('activeWindow', win) // ウィンドウをアクティブ化
ipcSend('setOptions', options) // 設定を更新（全体をマージして送る）
ipcSend('windowReady') // レンダラー準備完了を通知
```

#### Receiving from Main Process

```typescript
import { ipcListen } from '@/composables/ipc'

// 解除関数が返る。コンポーネント寿命のリスナーは onUnmounted で必ず解除する
const unlisten = ipcListen<MacWindow[]>('process', (processes) => {
  /* ... */
})
```

#### Composables（さらに上の層）

`useOptions()` / `useWindows()`（`src/composables/`）はモジュールシングルトンで、
リスナー登録と `windowReady` 送信を1回に抑えます。**`windowReady` はメインプロセス側で
ウィンドウリストのリセットという副作用を持つため、コンポーネントから直接送らず
`useWindows()` を使うこと。**

**重要**: `src/main/funcs/events.ts` で定義されたイベントハンドラーと対応しています。
`ipcSend` は引数を JSON クローンするため、Vue の reactivity proxy をそのまま渡せます。

### Browser-Based Testing with Mocks

開発サーバー起動時、ブラウザから直接UIにアクセスできます。Electron APIのモックが自動的に注入されます。

#### モックの仕組み

1. **自動注入**: `src/renderer/src/mocks/electron-mocks.ts` がブラウザ環境を検出し、`window.electron` API（ipcRenderer モック）を提供
2. **自動イベント発火**: `Electron.send('windowReady')` が呼ばれると、サンプルデータが自動送信
3. **開発者ヘルパー**: `window.__mockHelpers` で手動制御が可能

#### 使用例

```javascript
// ブラウザコンソールで実行

// サンプルウィンドウを更新
__mockHelpers.updateWindows([
  {
    kCGWindowOwnerName: 'MyApp',
    kCGWindowNumber: 999
    // ...
  }
])

// イベントを手動発火
__mockHelpers.emit('process', __mockHelpers.sampleWindows)

// windowReadyを再トリガー（全イベントを再送信）
__mockHelpers.triggerWindowReady()
```

#### フィクスチャーのカスタマイズ

`src/renderer/src/mocks/sample-fixture.ts` を編集してサンプルデータをカスタマイズできます：

```typescript
export const sampleWindows: MacWindow[] = [
  {
    kCGWindowOwnerName: 'TextEdit',
    kCGWindowNumber: 123
    // ...
  }
  // 追加のテストデータ
]
```

### Styling

- **CSS Framework**: Bulma
- **Preprocessor**: Less
- **グローバルスタイル**: 各エントリーポイントで `bulma/css/bulma.min.css` をインポート
- **コンポーネントスタイル**: `<style scoped lang="less">` を使用

## Testing

### Test Setup

- **テストランナー**: Bun Test (Vitest互換)
- **セットアップファイル**: `tests/setup.ts`
  - DOM環境のセットアップ（happy-dom）
  - Electron APIのモック
  - グローバル変数の設定

### Test Structure

```
tests/
├── setup.ts           # 共通テストセットアップ
└── sample.test.ts     # サンプルテスト
```

### Running Tests

```bash
# すべてのテストを実行（リポジトリルートから）
bun run test:renderer

# 特定のテストファイルを実行
cd src/renderer
bun test tests/sample.test.ts --preload ./tests/setup.ts

# または、リポジトリルートから
bun test src/renderer/tests/sample.test.ts --preload src/renderer/tests/setup.ts
```

## Type Definitions

### Electron API Types

Window のグローバル型は `src/utils.ts` の `declare global` で拡張されています:

```typescript
declare global {
  interface Window {
    electron: ElectronAPI // @electron-toolkit/preload が注入
    store: Store // preload が注入する初期ストア（型は src/types.ts）
  }
}
```

### MacWindow Type

メインプロセスから受信するウィンドウ情報の型：

```typescript
type MacWindow = {
  kCGWindowLayer: number
  kCGWindowName?: string
  kCGWindowMemoryUsage: number
  kCGWindowIsOnscreen?: number
  kCGWindowSharingState: number
  kCGWindowOwnerPID: number
  kCGWindowOwnerName: string
  kCGWindowNumber: number
  kCGWindowStoreType?: number
  kCGWindowBounds: {
    X: number
    Height: number
    Y: number
    Width: number
  }
  appIcon: string // Base64エンコードされたPNG
}
```

## Key Technical Notes

### Vue 3 Composition API

このプロジェクトはVue 3 Composition APIを使用しています：

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const windows = ref<MacWindow[]>([])

onMounted(() => {
  window.electron.ipcRenderer.on('process', (processes) => {
    windows.value = processes
  })

  window.electron.ipcRenderer.send('windowReady')
})
</script>
```

### View Switching（旧 File-Based Routing）

vue-router は Phase 1 スライス 1-B で削除されました。ビューの切り替えは
`?view=` パラメータと App.vue の動的 import で行います:

- `/` または `/?view=taskbar` → `pages/index.vue`
- `/?view=option` → `pages/option.vue`
- `/?view=menu` → `pages/menu.vue`
- `/?view=fullWindowList` → `pages/fullWindowList.vue`

### Window Ready Protocol

レンダラープロセスが準備完了したことをメインプロセスに通知する重要なプロトコル：

1. レンダラープロセスが起動
2. `window.electron.ipcRenderer.send('windowReady')` を送信
3. メインプロセスが初期データを送信：
   - `process` - ウィンドウリスト
   - `iconUpdate` - アイコンデータ
   - `displayInfo` - ディスプレイ情報
   - `updateOptions` - 設定データ

**重要**: このプロトコルを実装しないと、レンダラープロセスは初期データを受信できません。

### Development vs Production

- **開発環境**: `bun run dev` でブラウザからアクセス可能
  - モック注入: `src/renderer/src/mocks/electron-mocks.ts`
  - 開発サーバー: `http://localhost:10234/`
  - ホットリロード有効

- **本番環境**: Electronアプリ内で動作
  - 実際の `window.Electron` API を使用
  - モックは注入されない
  - `app.isPackaged === true`

### Playwright MCP Testing

Playwright MCPを使用した自動テスト時の注意点：

1. **一時ファイルの保存**: `.playwright-mcp/` ディレクトリを使用
2. **モックの活用**: 実際のElectron環境なしでUIテストが可能
3. **スクリーンショット**: テスト結果の視覚的確認に有効

### ESLint Rules

このプロジェクトでは厳格な型チェックが有効です：

- `@typescript-eslint/explicit-function-return-type: error` - すべての関数に戻り値の型を明示
- `@typescript-eslint/no-unused-vars: error` - 未使用変数は`_`プレフィックスで無視

```typescript
// ✅ Good
function getWindowCount(): number {
  return windows.value.length
}

// ❌ Bad - エラーになる
function getWindowCount() {
  return windows.value.length
}
```

## Common Patterns

### ウィンドウ操作の実装

```vue
<script setup lang="ts">
import { ref } from 'vue'

const windows = ref<MacWindow[]>([])

// ウィンドウをアクティブ化
function activateWindow(windowNumber: number): void {
  window.electron.ipcRenderer.send('activeWindow', { windowNumber })
}

// ウィンドウを閉じる
function closeWindow(windowNumber: number): void {
  window.electron.ipcRenderer.send('closeWindow', { windowNumber })
}

// ウィンドウリストの更新を受信
window.electron.ipcRenderer.on('process', (processes: MacWindow[]) => {
  windows.value = processes
})
</script>

<template>
  <div v-for="win in windows" :key="win.kCGWindowNumber">
    <button @click="activateWindow(win.kCGWindowNumber)">
      {{ win.kCGWindowOwnerName }}
    </button>
  </div>
</template>
```

### 設定の読み書き

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const layout = ref<'top' | 'bottom' | 'left' | 'right'>('bottom')

// 設定を読み込む
onMounted(() => {
  window.electron.ipcRenderer.on('updateOptions', (options) => {
    layout.value = options.layout
  })

  window.electron.ipcRenderer.send('windowReady')
})

// 設定を保存
function saveLayout(): void {
  window.electron.ipcRenderer.send('setOptions', { layout: layout.value })
}
</script>
```

### アイコンの表示

```vue
<script setup lang="ts">
import { ref } from 'vue'

const icons = ref<Record<string, string>>({})

window.electron.ipcRenderer.on('iconUpdate', (iconData) => {
  icons.value = iconData
})
</script>

<template>
  <img
    v-if="icons[window.kCGWindowOwnerName]"
    :src="`data:image/png;base64,${icons[window.kCGWindowOwnerName]}`"
    alt="App Icon"
  />
</template>
```
