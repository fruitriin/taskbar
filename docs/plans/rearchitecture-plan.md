# Taskbar.fm リアーキテクチャ計画書

## Vue + UnoCSS + Vite+ (vp) + Tauri v2 への移行

**作成日**: 2026-03-18
**現行バージョン**: 2.1.0 (Electron + Vue 3 + Bulma + Swift Helper)

---

## 1. 目的と動機

### 1.1 解決したい問題

| 問題 | 現状 | 影響 |
|------|------|------|
| **二重プロセス構造** | Electron Main + Swift Helper が別プロセスで動作 | helper.ts (20KB) の複雑な通信・監視・再起動ロジック |
| **フラジャイルな IPC** | stdout JSON ストリームでプロセス間通信 | パイプバッファフル時の UE リスク、JSON パースエラーのエッジケース |
| **過大なリソース消費** | Chromium 同梱で ~200MB、メモリ ~150-300MB | 常駐アプリとしてはオーバーヘッドが大きい |
| **ビルドツールの分散** | ESLint + Prettier + Vitest + electron-vite + mise が個別設定 | 設定ファイルの肥大化、依存関係の管理コスト |
| **不要なルーティング** | 4つの独立 Vue アプリが各々 vue-router を起動 | 1ページしか表示しないのに Router のフルスタックを読み込み |
| **状態管理の不統一** | Pinia 宣言済みだが未使用、electron-store を直接参照 | Options API 混在、`$forceUpdate()` の使用 |
| **CSS フレームワーク** | Bulma のセマンティッククラスが LLM にとって不透明 | スタイル変更時に暗黙知が必要 |

### 1.2 移行で得られるもの

- **Swift Helper の廃止**: Rust バックエンドに統合し、プロセス間通信を排除
- **バイナリサイズ**: ~200MB → ~15MB
- **メモリ使用量**: ~150-300MB → ~30-50MB
- **ビルドツールの統一**: Vite+ (vp) で 1 コマンド化。mise も廃止
- **CSS の LLM 最適化**: UnoCSS (Attributify Mode) でテンプレート内完結
- **Vue の良さはそのまま**: コンポーネントツリーの差分レンダリング、TransitionGroup を維持

---

## 2. 技術スタック

### 2.1 新スタック

| レイヤー | 現行 | 新 | 備考 |
|---------|------|---|------|
| **デスクトップフレームワーク** | Electron 27 | Tauri v2 | WKWebView ベース |
| **バックエンド** | Node.js + Swift (別プロセス) | Rust (Tauri 本体に統合) | objc2 クレートで macOS API 直接呼び出し |
| **フロントエンド** | Vue 3 | Vue 3 (Composition API に統一) | そのまま維持 |
| **CSS** | Bulma + Less | UnoCSS (Attributify Mode) | ユーティリティファースト、LLM 最適 |
| **ビルドツール** | electron-vite + ESLint + Prettier + mise | Vite+ (vp) | ゼロコンフィグ、mise 廃止 |
| **テスト** | Vitest (Bun) | Vitest (vp test) | Vite+ に統合 |
| **リンター** | ESLint + Prettier | Oxlint + Oxfmt (vp lint / vp fmt) | 100倍高速 |
| **状態管理** | electron-store + 手動 IPC 同期 | tauri-plugin-store + useReactiveStore composable | 永続化・ウィンドウ間同期・リアクティブを1つに統合 |
| **パッケージマネージャー** | bun | bun (そのまま) | |
| **タスクランナー** | mise | vp run (Vite Task) | mise 完全廃止 |

### 2.2 Rust 側の主要クレート

| クレート | 用途 |
|---------|------|
| `objc2-core-graphics` | CGWindowListCopyWindowInfo（ウィンドウ情報取得） |
| `objc2-app-kit` | NSRunningApplication（アイコン取得）、NSWorkspace（イベント監視） |
| `objc2-accessibility` | AXUIElement（ウィンドウ操作: アクティブ化・クローズ） |
| `tauri-plugin-store` | 設定の永続化 + ウィンドウ間同期 |
| `tauri-plugin-macos-permissions` | スクリーン収録・アクセシビリティ権限管理 |
| `serde` / `serde_json` | JSON シリアライズ |

### 2.3 Vite+ (vp) について

Evan You の VoidZero が開発した統合ツールチェーン。現在 **Alpha 段階**。

**リスク軽減策**: Vite のスーパーセットなので、問題があれば `vp` → `vite` にコマンドを戻すだけでフォールバック可能。Vite プラグイン（`@vitejs/plugin-vue` 等）はそのまま動作する。

---

## 3. フェーズ概要

| Phase | 内容 | ビルド | 詳細 |
|-------|------|:------:|------|
| **1** | Vue 整理 + Composition 統一 + UnoCSS + 状態管理 composable | ✅ Electron 上で動作 | [Phase 1 詳細](./rearch-phase1.md) |
| **2** | フロントエンドビルドチェーン整理 (vp) | ✅ Electron 上で動作 | [Phase 2 詳細](./rearch-phase2.md) |
| **3** | Electron+Swift → Tauri v2+Rust + ビルドチェーン完全移行 | 途中不通、完了時 ✅ | [Phase 3 詳細](./rearch-phase3.md) |

Phase 1, 2 完了後はそれぞれリリース可能。Phase 3 は一気通貫で実施。

---

## 4. アーキテクチャ設計

### 4.1 全体構成（最終形）

```
┌─────────────────────────────────────────────────┐
│  Tauri v2 Application                           │
│                                                 │
│  ┌──────────────────────┐  Tauri Commands/Events│
│  │  Rust Backend        │◄─────────────────────►│
│  │                      │                       │
│  │  ┌────────────────┐  │  ┌─────────────────┐  │
│  │  │ window_manager │  │  │ Vue Frontend    │  │
│  │  │ (CGWindowList) │  │  │ (WKWebView)     │  │
│  │  ├────────────────┤  │  │                 │  │
│  │  │ icon_manager   │  │  │ ┌─────────────┐ │  │
│  │  │ (NSRunApp.icon)│  │  │ │ TaskbarView │ │  │
│  │  ├────────────────┤  │  │ ├─────────────┤ │  │
│  │  │ window_actions │  │  │ │ OptionView  │ │  │
│  │  │ (AXUIElement)  │  │  │ ├─────────────┤ │  │
│  │  ├────────────────┤  │  │ │ MenuView    │ │  │
│  │  │ permission_mgr │  │  │ └─────────────┘ │  │
│  │  ├────────────────┤  │  │                 │  │
│  │  │ store          │  │  │ 1バンドル        │  │
│  │  │ (tauri-plugin) │◄─┼──│ useReactiveStore│  │
│  │  └────────────────┘  │  └─────────────────┘  │
│  └──────────────────────┘                       │
└─────────────────────────────────────────────────┘
```

### 4.2 現行 → 新の対応表

```
消えるもの                              置き換え先
─────────────────────────              ─────────────────────────
nativeSrc/taskbar.helper/main.swift   → src-tauri/src/window_manager.rs
  (1323行)                               icon_manager.rs
                                         permission_manager.rs

src/main/main.ts                      → src-tauri/src/main.rs (Tauri エントリー)
src/main/funcs/helper.ts (20KB)       → 削除 (プロセス間通信が不要に)
src/main/funcs/events.ts              → src-tauri/src/commands.rs (Tauri Commands)
src/main/funcs/windows.ts             → tauri.conf.json + Rust 側ウィンドウ管理
src/main/funcs/optionWindows.ts       → Rust 側 WebviewWindow 生成
src/main/funcs/store.ts               → tauri-plugin-store + useReactiveStore
src/main/funcs/icon-cache.ts          → src-tauri/src/icon_manager.rs
src/main/funcs/filter-migration.ts    → src-tauri/src/filter.rs

src/preload.ts                        → 削除 (Tauri は preload 不要)

electron.vite.config.ts               → vite.config.ts (Vite+ 用)
electron-builder.yml                  → tauri.conf.json
build/notarize.js                     → Tauri 組み込みノータリゼーション
build/afterPack.js                    → 削除
.mise.toml                            → 削除 (vp run に統合)

4つの renderer-*.ts エントリー         → 1つのエントリー + URLパラメータ切り替え
vue-router                            → 削除
unplugin-vue-router                   → 削除
pinia                                 → 削除 (useReactiveStore composable に置換)
bulma + less                          → UnoCSS (Attributify Mode)
```

### 4.3 ディレクトリ構成（最終形）

```
taskbar/
├── src/                              # Vue フロントエンド
│   ├── App.vue                       # ルートコンポーネント（ビュー切り替え）
│   ├── main.ts                       # 唯一のエントリーポイント
│   ├── views/
│   │   ├── TaskbarView.vue           # メインタスクバー（旧 pages/index.vue）
│   │   ├── OptionView.vue            # 設定画面（旧 pages/option.vue）
│   │   ├── MenuView.vue              # メニュー（旧 pages/menu.vue）
│   │   └── FullWindowListView.vue    # デバッグ用（旧 pages/fullWindowList.vue）
│   ├── components/
│   │   ├── AddFilter.vue
│   │   ├── Debug.vue
│   │   ├── MainPermissionStatus.vue
│   │   ├── PermissionStatus.vue
│   │   └── Versions.vue
│   ├── composables/                  # Composition API ベースの状態管理
│   │   ├── useReactiveStore.ts       # 汎用: 永続化+同期+リアクティブ
│   │   ├── useWindows.ts             # ウィンドウリスト（非永続化、Events経由）
│   │   ├── useIcons.ts               # アイコン（非永続化、Events経由）
│   │   ├── useOptions.ts             # 設定（useReactiveStore ベース）
│   │   ├── useLabeledFilters.ts      # フィルター（useReactiveStore ベース）
│   │   └── usePermissions.ts         # 権限状態
│   ├── types/
│   │   └── index.ts                  # MacWindow, Filter 等の型定義
│   ├── mocks/                        # ブラウザテスト用モック（維持）
│   │   ├── tauri-mocks.ts            # Tauri API のモック (旧 electron-mocks.ts)
│   │   └── sample-fixture.ts         # サンプルデータ
│   └── assets/
│       └── styles/
├── src-tauri/                        # Rust バックエンド (Tauri)
│   ├── Cargo.toml
│   ├── tauri.conf.json               # ウィンドウ定義、権限、ビルド設定
│   ├── capabilities/                 # Tauri v2 権限設定
│   │   └── default.json
│   └── src/
│       ├── main.rs                   # Tauri エントリーポイント
│       ├── commands.rs               # Tauri Commands (IPC ハンドラー)
│       ├── window_manager.rs         # CGWindowListCopyWindowInfo ラッパー
│       ├── icon_manager.rs           # アイコン取得・キャッシュ
│       ├── window_actions.rs         # AXUIElement によるウィンドウ操作
│       ├── window_observer.rs        # NSWorkspace イベント監視
│       ├── permission_manager.rs     # 権限チェック・リクエスト
│       ├── filter.rs                 # ウィンドウフィルタリング
│       └── store.rs                  # 設定管理 (tauri-plugin-store)
├── vite.config.ts                    # Vite+ 設定（Vue + UnoCSS）
├── package.json
└── bun.lock
```

---

## 5. 開発コマンド（最終形）

```bash
# 開発サーバー起動（Rust + Vue 同時ビルド）
cargo tauri dev

# フロントエンドのみ（ブラウザテスト用）
vp dev

# ビルド
cargo tauri build                 # 署名・ノータリゼーション込み

# コード品質（一括）
vp check                          # lint + fmt + typecheck

# 個別実行
vp lint                           # Oxlint
vp fmt                            # Oxfmt
vp test                           # Vitest

# Rust 側テスト
cargo test --manifest-path src-tauri/Cargo.toml
```

### 現行コマンドとの対応表

| 現行 (mise run) | 新 | 備考 |
|-----------------|-----|------|
| `mise run dev` | `cargo tauri dev` | Rust + フロントエンド同時起動 |
| `mise run build` | `cargo tauri build` | 署名・ノータリゼーション込み |
| `mise run build:mac` | `cargo tauri build --target universal-apple-darwin` | ユニバーサルバイナリ |
| `mise run test` | `vp test` | Vitest |
| `mise run test:renderer` | `vp test` | テスト設定が統合されるため同一 |
| `mise run lint` | `vp lint` | Oxlint |
| `mise run format` | `vp fmt` | Oxfmt |
| `mise run typecheck` | `vp check` | lint + fmt + typecheck 一括 |
| `mise run helper` | 不要 | Swift Helper 廃止 |
| `mise run swiftbuild` | 不要 | Swift Helper 廃止 |

---

## 6. 依存関係の変更

### 削除

```
# Electron 関連
@electron-toolkit/preload, @electron-toolkit/utils, @electron-toolkit/tsconfig
@electron/notarize, electron, electron-builder, electron-store, electron-vite, electron-updater

# Lint/Format（vp に統合）
@rushstack/eslint-patch, @vue/eslint-config-prettier, @vue/eslint-config-typescript
eslint, eslint-plugin-vue, prettier

# Vue 不要依存
pinia, vue-router, unplugin-vue-router

# CSS（UnoCSS に置換）
bulma, less, dart-sass
```

### 追加

```
@tauri-apps/api, @tauri-apps/cli, @tauri-apps/plugin-store
vite-plus
unocss, @unocss/preset-attributify, @unocss/preset-uno
```

### 維持

```
vue, @vitejs/plugin-vue, @vueuse/core
fast-sort, just-diff, just-diff-apply, vuedraggable
typescript, vue-tsc, html-escaper
```

---

## 7. リスクと軽減策

| リスク | 確率 | 影響 | 軽減策 |
|-------|------|------|--------|
| **Vite+ Alpha の不安定性** | 中 | 低 | Vite 互換のため即座にフォールバック可能 |
| **objc2 クレートの API 変更** | 低 | 中 | `paneru` クレートを参考実装として活用 |
| **WKWebView の CSS 制限** | 低 | 低 | macOS 専用のため WebKit 最新。透過背景のワークアラウンドのみ要確認 |
| **Rust macOS API 経験不足** | 中 | 高 | Phase 3 序盤で最小限の PoC を先に実装して検証 |
| **マルチディスプレイの Tauri 対応** | 低 | 中 | Tauri v2 はマルチウィンドウ対応済み。位置計算は現行ロジックを移植 |
| **設定データの移行** | 低 | 低 | 初回起動時に electron-store → tauri-plugin-store へ移行スクリプト実行 |
| **UnoCSS Attributify の HTML 属性競合** | 低 | 低 | `ignoreAttributes` で SVG 属性等を除外。必要なら `un-` プレフィックス使用 |
| **Phase 3 の作業量** | - | 高 | 一気通貫だが 3.1〜3.5 のサブタスクで進捗を管理。途中ビルド不通は許容 |

---

## 8. 成果指標

| 指標 | 現行 | 目標 |
|------|------|------|
| バイナリサイズ | ~200MB | ~15MB |
| メモリ使用量 (常駐時) | ~150-300MB | ~30-50MB |
| 起動時間 | 1-2秒 | 0.5秒未満 |
| バックエンドコード量 | main.ts + helper.ts + events.ts + ... (~2000行) + Swift (~1300行) = ~3300行 | Rust ~1000行 |
| ビルド設定ファイル数 | 7+ (electron-vite, builder, eslint, prettier, mise, ...) | 2 (vite.config.ts, tauri.conf.json) |
| npm 依存パッケージ数 | 30+ | ~12 |
| IPC の段数 | 3段 (Swift → Node → Vue) | 1段 (Rust → Vue) |
| 開発コマンド体系 | mise run + bun + electron-vite の混在 | vp + cargo tauri の2系統のみ |
| 状態管理の仕組み数 | 3つ (electron-store + IPC手動送信 + ref) | 1つ (useReactiveStore) |
