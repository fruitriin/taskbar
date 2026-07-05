# Phase 1: Vue 整理 + Composition 統一 + UnoCSS + 状態管理

**親ドキュメント**: [リアーキテクチャ計画書](../rearchitecture-plan.md)

**前提**: Electron 上で動作を維持したまま実施。このフェーズ完了後にリリース可能。

---

## 1.1 Vue 依存整理

### エントリーポイント統合

現行の4つの独立 Vue アプリを1つに統合する。

```
現行: 4つのエントリー、各々が createApp + createRouter
  index.html       → renderer-main.ts       → App.vue → pages/index.vue
  option.html      → renderer-option.ts     → App.vue → pages/option.vue
  menu.html        → renderer-menu.ts       → App.vue → pages/menu.vue
  fullWindowList.html → renderer-fullWindowList.ts → App.vue → pages/fullWindowList.vue

新: 1エントリー + URLパラメータでビュー切り替え
  index.html → main.ts → App.vue → <component :is="viewComponent" />
```

#### タスク

- [ ] `src/renderer/src/main.ts` を作成（唯一のエントリーポイント）
- [ ] `App.vue` を URLパラメータベースのビュー切り替えに書き換え
- [ ] `pages/` を `views/` にリネーム（TaskbarView, OptionView, MenuView, FullWindowListView）
- [ ] 旧エントリーファイル（renderer-main.ts, renderer-option.ts 等）を削除
- [ ] `electron.vite.config.ts` を単一エントリーに変更
- [ ] メインプロセス側のウィンドウ生成を `loadURL('index.html?view=option')` 形式に変更

#### vue-router / unplugin-vue-router 削除

- [ ] `vue-router` を package.json から削除
- [ ] `unplugin-vue-router` を package.json から削除
- [ ] `electron.vite.config.ts` から VueRouter プラグインを削除
- [ ] `typed-router.d.ts` を削除
- [ ] 各エントリーファイルの `createRouter` / `createMemoryHistory` を削除

#### Pinia 削除

- [ ] `pinia` を package.json から削除
- [ ] Pinia 関連の import / createPinia() を削除
- [ ] （composables で置換完了後に実施）

#### $forceUpdate() 排除

- [ ] `pages/index.vue` の `$forceUpdate()` を特定し、リアクティブな代替に書き換え
- [ ] リアクティビティの問題を根本修正（ref/reactive の使い方を見直す）

---

## 1.2 Composition API 統一 + 状態管理

### Options API → Composition API

- [ ] 全コンポーネントを `<script setup lang="ts">` に統一
- [ ] `export default { data(), methods: {} }` 形式を排除
- [ ] `this.$refs` → `ref()` / `useTemplateRef()` に置き換え

### IPC ラッパーの抽象化

Phase 1 では Electron IPC を維持しつつ、Phase 3 で Tauri に差し替え可能な薄いレイヤーを作る。

```typescript
// src/composables/ipc.ts
// Phase 1: Electron 実装
export async function ipcInvoke<T>(command: string, args?: any): Promise<T> {
  return window.electron.ipcRenderer.invoke(command, args)
}

export function ipcListen<T>(event: string, handler: (payload: T) => void): () => void {
  const listener = (_event: any, ...args: any[]) => handler(args[0])
  window.electron.ipcRenderer.on(event, listener)
  return () => window.electron.ipcRenderer.removeListener(event, listener)
}

export async function ipcSend(channel: string, ...args: any[]): Promise<void> {
  window.electron.ipcRenderer.send(channel, ...args)
}
```

### composables の作成

composable のインターフェースは最終形（useReactiveStore 準拠）で設計する。
Phase 1 時点の内部実装は Electron IPC 経由。Phase 3 で tauri-plugin-store に差し替え。

#### useOptions（永続化データ）

```typescript
// src/composables/useOptions.ts
// Phase 1: Electron IPC 経由で electron-store と通信
import { ref } from 'vue'
import { ipcListen, ipcSend } from './ipc'

const options = ref<Options>({
  layout: 'bottom',
  headers: [],
  footers: [],
  windowSortByPositionInApp: false,
})

let initialized = false

export function useOptions() {
  if (!initialized) {
    // メインプロセスからの設定更新を受信
    ipcListen<Options>('updateOptions', (payload) => {
      options.value = payload
    })
    initialized = true
  }

  function updateOptions(newOptions: Partial<Options>): void {
    const merged = { ...options.value, ...newOptions }
    options.value = merged
    ipcSend('setOptions', merged)
  }

  return { options, updateOptions }
}
```

#### useWindows（非永続化データ）

```typescript
// src/composables/useWindows.ts
import { ref, onMounted, onUnmounted } from 'vue'
import { ipcListen, ipcSend } from './ipc'

export function useWindows() {
  const windows = ref<MacWindow[]>([])
  let unlisten: (() => void) | undefined

  onMounted(() => {
    unlisten = ipcListen<MacWindow[]>('process', (payload) => {
      windows.value = payload
    })
    ipcSend('windowReady')
  })

  onUnmounted(() => unlisten?.())

  return { windows }
}
```

#### その他

- [ ] `useIcons.ts` — アイコンデータの管理
- [ ] `usePermissions.ts` — 権限状態の管理
- [ ] `useLabeledFilters.ts` — フィルター設定の管理
- [ ] `useDisplayInfo.ts` — ディスプレイ情報の管理

---

## 1.3 UnoCSS 導入

### セットアップ

- [ ] `unocss`, `@unocss/preset-uno`, `@unocss/preset-attributify` をインストール
- [ ] `uno.config.ts` を作成

```typescript
// uno.config.ts
import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify({
      ignoreAttributes: ['fill', 'stroke'],  // SVG 属性の競合回避
    }),
  ],
})
```

- [ ] `electron.vite.config.ts` に UnoCSS プラグインを追加
- [ ] Vue 型定義ファイルを作成

```typescript
// src/renderer/src/html.d.ts
declare module '@vue/runtime-dom' {
  interface HTMLAttributes {
    [key: string]: any
  }
}
declare module '@vue/runtime-core' {
  interface AllowedComponentProps {
    [key: string]: any
  }
}
export {}
```

### Bulma → UnoCSS 移行

段階的に書き換える。込み入ったレイアウトは `<style scoped>` に残す。

#### 書き換えパターン例

```vue
<!-- Before: Bulma -->
<div class="columns is-mobile is-vcentered">
  <div class="column is-narrow">
    <figure class="image is-32x32">
      <img :src="icon" />
    </figure>
  </div>
  <div class="column">
    <p class="is-size-7 has-text-white">{{ name }}</p>
  </div>
</div>

<!-- After: UnoCSS Attributify -->
<div flex items-center gap-2>
  <div shrink-0>
    <img w-8 h-8 :src="icon" />
  </div>
  <div flex-1>
    <p text="xs white">{{ name }}</p>
  </div>
</div>
```

#### タスク

- [ ] 各コンポーネントの Bulma クラスをユーティリティクラスに書き換え
- [ ] `bulma` を package.json から削除
- [ ] `less` を package.json から削除
- [ ] `dart-sass` を package.json から削除
- [ ] `<style lang="less">` → `<style scoped>` に変更（必要な箇所のみ残す）
- [ ] Bulma の CSS import を全エントリーから削除

---

## 完了条件

- [ ] `mise run dev` で Electron アプリが起動し、全画面（タスクバー、設定、メニュー、ウィンドウリスト）が正常動作
- [ ] vue-router, unplugin-vue-router, pinia, bulma, less, dart-sass が package.json から消えている
- [ ] 全コンポーネントが `<script setup lang="ts">` 形式
- [ ] `$forceUpdate()` がコードベースに存在しない
- [ ] 全画面で composables 経由のデータアクセスに統一されている
- [ ] UnoCSS Attributify でスタイリングされている
- [ ] 既存テストがパスする
