# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Directory Overview

このディレクトリ（`src/renderer`）は、Taskbar.fmアプリケーションのElectronレンダラープロセスを含んでいます。Vue.js 3を使用したUIレイヤーで、Composition APIとTypeScriptで記述されています。

## Development Commands

すべてのコマンドはリポジトリルートから実行してください：

### テスト関連

```bash
# レンダラープロセスの全テストを実行
mise run test:renderer

# 特定のテストファイルを実行
cd src/renderer && bun test tests/sample.test.ts --preload ./tests/setup.ts

# プロジェクトルートからの実行例
bun test src/renderer/tests/sample.test.ts --preload src/renderer/tests/setup.ts
```

### 型チェック

```bash
# レンダラープロセスの型チェック
mise run typecheck:web
```

### ブラウザベーステスト

```bash
# 開発サーバーを起動
mise run dev

# ブラウザまたはPlaywright MCPでアクセス
# - http://localhost:10234/ (メインタスクバー)
# - http://localhost:10234/option.html (設定画面)
# - http://localhost:10234/menu.html (メニュー)
# - http://localhost:10234/fullWindowList.html (全ウィンドウリスト)
```

## Architecture

### Entry Points

このレンダラープロセスには4つのエントリーポイントがあります：

1. **index.html** / **renderer-main.ts** - メインタスクバーUI
   - ウィンドウリストの表示
   - ウィンドウのクリック・アクティベーション
   - 右クリックメニューの表示

2. **option.html** / **renderer-option.ts** - 設定画面
   - タスクバーのレイアウト設定（top/bottom/left/right）
   - ウィンドウフィルターの管理
   - 権限状態の表示

3. **menu.html** / **renderer-menu.ts** - 右クリックメニュー
   - ウィンドウを閉じる
   - その他のウィンドウ操作

4. **fullWindowList.html** / **renderer-fullWindowList.ts** - 全ウィンドウリスト（開発用）
   - すべてのウィンドウ情報のデバッグ表示
   - 開発時のみ使用（Cmd+Shift+W）

### Vue Components Structure

```
src/
├── App.vue                      # メインタスクバーのルートコンポーネント
├── Option.vue                   # 設定画面のルートコンポーネント
├── Menu.vue                     # メニューのルートコンポーネント
├── FullWindowList.vue           # 全ウィンドウリストのルートコンポーネント
├── components/
│   ├── AddFilter.vue            # フィルター追加UI
│   ├── Debug.vue                # デバッグ情報表示
│   ├── MainPermissionStatus.vue # メインUI用権限状態表示
│   ├── PermissionStatus.vue     # 設定画面用権限状態表示
│   └── Versions.vue             # バージョン情報表示
├── pages/                       # Vue Routerページ（ファイルベースルーティング）
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

レンダラープロセスは `window.Electron` API を通じてメインプロセスと通信します：

#### Sending to Main Process

```typescript
// ウィンドウをアクティブ化
window.Electron.send('activeWindow', { windowNumber: 123 })

// ウィンドウを閉じる
window.Electron.send('closeWindow', { windowNumber: 123 })

// 設定を更新
window.Electron.send('setOptions', { layout: 'bottom' })

// レンダラー準備完了を通知
window.Electron.send('windowReady')
```

#### Receiving from Main Process

```typescript
// ウィンドウ情報の更新を受信
window.Electron.on('process', (processes: MacWindow[]) => {
  // ...
})

// アイコン更新を受信
window.Electron.on('iconUpdate', (iconData: Record<string, string>) => {
  // ...
})

// ディスプレイ情報を受信
window.Electron.on('displayInfo', (info: DisplayInfo) => {
  // ...
})

// 設定更新を受信
window.Electron.on('updateOptions', (options: OptionsType) => {
  // ...
})
```

**重要**: すべてのIPC通信は型安全です。`src/main/funcs/events.ts` で定義されたイベントハンドラーと対応しています。

### Browser-Based Testing with Mocks

開発サーバー起動時、ブラウザから直接UIにアクセスできます。Electron APIのモックが自動的に注入されます。

#### モックの仕組み

1. **自動注入**: `src/renderer/src/mocks/electron-mocks.ts` がブラウザ環境を検出し、`window.Electron` APIを提供
2. **自動イベント発火**: `Electron.send('windowReady')` が呼ばれると、サンプルデータが自動送信
3. **開発者ヘルパー**: `window.__mockHelpers` で手動制御が可能

#### 使用例

```javascript
// ブラウザコンソールで実行

// サンプルウィンドウを更新
__mockHelpers.updateWindows([
  {
    kCGWindowOwnerName: 'MyApp',
    kCGWindowNumber: 999,
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
    kCGWindowNumber: 123,
    // ...
  },
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
mise run test:renderer

# 特定のテストファイルを実行
cd src/renderer
bun test tests/sample.test.ts --preload ./tests/setup.ts

# または、リポジトリルートから
bun test src/renderer/tests/sample.test.ts --preload src/renderer/tests/setup.ts
```

## Type Definitions

### Electron API Types (env.d.ts)

レンダラープロセスで使用可能なElectron APIの型定義：

```typescript
interface Window {
  Electron: {
    send: (channel: string, ...args: any[]) => void
    on: (channel: string, callback: (...args: any[]) => void) => void
    invoke: (channel: string, ...args: any[]) => Promise<any>
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

### Vue Router Types

ファイルベースルーティングの型定義は `typed-router.d.ts` に自動生成されます。

## Key Technical Notes

### Vue 3 Composition API

このプロジェクトはVue 3 Composition APIを使用しています：

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const windows = ref<MacWindow[]>([])

onMounted(() => {
  window.Electron.on('process', (processes) => {
    windows.value = processes
  })

  window.Electron.send('windowReady')
})
</script>
```

### File-Based Routing

Vue Routerはファイルベースルーティングを使用：

- `src/pages/index.vue` → `/`
- `src/pages/option.vue` → `/option`
- `src/pages/menu.vue` → `/menu`
- `src/pages/fullWindowList.vue` → `/fullWindowList`

### Window Ready Protocol

レンダラープロセスが準備完了したことをメインプロセスに通知する重要なプロトコル：

1. レンダラープロセスが起動
2. `window.Electron.send('windowReady')` を送信
3. メインプロセスが初期データを送信：
   - `process` - ウィンドウリスト
   - `iconUpdate` - アイコンデータ
   - `displayInfo` - ディスプレイ情報
   - `updateOptions` - 設定データ

**重要**: このプロトコルを実装しないと、レンダラープロセスは初期データを受信できません。

### Development vs Production

- **開発環境**: `mise run dev` でブラウザからアクセス可能
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
  window.Electron.send('activeWindow', { windowNumber })
}

// ウィンドウを閉じる
function closeWindow(windowNumber: number): void {
  window.Electron.send('closeWindow', { windowNumber })
}

// ウィンドウリストの更新を受信
window.Electron.on('process', (processes: MacWindow[]) => {
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
  window.Electron.on('updateOptions', (options) => {
    layout.value = options.layout
  })

  window.Electron.send('windowReady')
})

// 設定を保存
function saveLayout(): void {
  window.Electron.send('setOptions', { layout: layout.value })
}
</script>
```

### アイコンの表示

```vue
<script setup lang="ts">
import { ref } from 'vue'

const icons = ref<Record<string, string>>({})

window.Electron.on('iconUpdate', (iconData) => {
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
