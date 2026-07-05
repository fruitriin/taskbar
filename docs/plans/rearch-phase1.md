# Phase 1: Vue 整理 + Composition 統一 + UnoCSS + 状態管理

**親ドキュメント**: [リアーキテクチャ計画書](rearchitecture-plan.md)

**前提**: Electron 上で動作を維持したまま実施。このフェーズ完了後にリリース可能。

---

## 鮮度更新（2026-07-06。計画本文は 2026-03-18 時点の記述）

v2.1.1 リリースまでの変更で、計画の前提がいくつか変わっている:

- **index.vue は Options API のまま大きく成長した**: アプリグルーピング computed
  （`groupWindowsByApp`）、Pointer Events D&D の配線、TransitionGroup(FLIP)、ゴースト描画、
  process 更新保留ガードが追加済み。Composition API 化（1.2）のコストは計画時より大きい
- **ドラッグ状態機械は `drag-session.ts` に DI 抽出済み**（DOM/Vue 非依存）。
  Composition 化ではコンポーネント側の配線（createDragSession の deps とコールバック）だけを
  移せばよい。回帰の安全網は utils.ts の純関数テスト26件（window-sort.test.ts）＋
  drag-session テスト21件（drag-session.test.ts）
- **Options 型に `appOrder: string[]` が追加済み**。本計画中の useOptions 例示コードには
  appOrder が無いので、実装時に含めること（`?? []` フォールバックの慣習も維持）
- **Pinia はコード上未使用**（import ゼロ）。「Pinia 削除」は package.json の依存削除のみで完了する
- **`$forceUpdate()` は index.vue の `updateWindowIcons` 内に1箇所現存**（アイコン更新後の強制再描画）
- **ブラウザモック（`mocks/electron-mocks.ts`）は `window.electron` を注入する設計**。
  1.2 の ipc.ts ラッパーが `window.electron` 経由を維持すれば、モック・ブラウザテスト・
  既存ユニットテストがそのまま生きる
- **削除対象依存の現存確認済み**: bulma 1.0.4 / less / dart-sass / pinia / vue-router / unplugin-vue-router

## スライス分割（1スライス = /addf-dev 1〜2サイクル、各完了時点でリリース可能）

| スライス | 内容 | 依存 | 備考 |
|---|---|---|---|
| 1-0 | pinia を package.json から削除（コード上未使用のため依存削除のみ） | なし | 即時可能な最小スライス |
| 1-A | ipc.ts ラッパー導入＋useOptions/useWindows 等の composables 新設（既存コンポーネントは未移行のまま併存可） | なし | |
| 1-B | エントリーポイント統合（4 HTML → 1 + `?view=` 切替）＋ vue-router / unplugin-vue-router 削除。**メインプロセス側の loadURL/loadFile 4箇所も同時変更必須**: windows.ts（index）と optionWindows.ts（option / fullWindowList / menu）の dev/prod 分岐を `?view=` 形式に（prod は loadFile の query オプション） | なし（1-A と独立） | 完了条件: `mise run dev` で4画面すべて起動 |
| 1-C | 小物コンポーネントの Composition API 化＋composables 接続（Menu / FullWindowList / Debug / PermissionStatus 系） | 1-A | |
| 1-D | option.vue の Composition API 化 | 1-A | |
| 1-E | index.vue の Composition API 化＋$forceUpdate 排除（最難関。drag-session の配線移行含む） | 1-A | 1-C / 1-D 完了後を推奨（パターン確立のため） |
| 1-F | UnoCSS 導入＋Bulma/less/dart-sass 撤去 | 技術的には独立 | 運用判断で最後に回す（同じテンプレートを二度触らない・視覚回帰の目視確認を一度にまとめる）。オーナーの目視確認を完了条件に含める |

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
- [ ] ~~Pinia 関連の import / createPinia() を削除~~ →（2026-07-06 鮮度更新: コード上未使用と確認済み。
  依存削除のみで完了する。「composables で置換完了後に実施」の順序制約も不要 → スライス 1-0）

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
