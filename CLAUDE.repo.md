# CLAUDE.repo.md

Taskbar.fm — macOS に Windows ライクなタスクバー機能を提供する Tauri v2 アプリケーション。
ユーザーへの返事は日本語でお願いします。

# プロジェクト種別

このリポジトリは **ADDF 利用プロジェクト** です。

---

## コミットログ規約

日本語で書く。形式:

```
[領域] 変更内容の要約

詳細説明（何を・なぜ・影響範囲。LLM がコミットするので情報を惜しまず詰める）
```

- 領域の例: `[tauri]` `[renderer]` `[build]` `[docs]` `[addf]`
- 要約は1行で完結させ、背景・判断理由・副作用はボディに書く

例:

```
[renderer] オプション画面から既存のフィルターを編集できるようにする

フィルター一覧に編集ボタンを追加し、作成フォームを編集モードでも共用。
編集時は既存値をフォームに読み込み、保存で該当インデックスを置換する。
```

---

## Documentation Structure

- **このファイル** (`CLAUDE.repo.md`) - プロジェクト全体の概要と開発コマンド
- **`src/renderer/CLAUDE.md`** - Vue.js レンダラー（フロントエンド）の詳細実装
- **`src-tauri/`** - Rust バックエンド。各モジュール冒頭のドキュメントコメントが一次情報

## Project Overview

Taskbar.fm is a Tauri v2 application that brings Windows-like taskbar functionality to macOS.

- **Rust Backend** (src-tauri/): ウィンドウ列挙（CGWindowList）、AX 操作、権限、アイコン、
  マルチディスプレイ、設定ストア（tauri-plugin-store）
- **Frontend** (src/renderer/): Vue 3 + Pinia + UnoCSS。`?view=` パラメータでビュー切替

v2 系までの Electron + Swift Helper 構成は Phase 3（2026-07）で全廃した。
旧構成のスナップショットは git tag `v2-electron-final` に残っている。

### Development Tools

- **Task Runner**: package.json scripts（`bun run <task>`）
- **Package Manager**: bun
- **Rust**: cargo（src-tauri/ 配下）

## Development Commands

### Essential Commands（`bun run <task>`）

- `bun run dev` - Tauri 開発起動（実機。Rust ビルド＋vite dev サーバー）
- `bun run dev:web` - ブラウザテスト用 vite dev サーバーのみ起動（モック注入、下記参照）
- `bun run build:mac` - Tauri リリースビルド（未署名）
- `bun run release:mac` - 署名＋notarize 付きリリースビルド（要 `.env`）
- `bun run test` - レンダラーテスト（bun test）
- `cd src-tauri && cargo test` - Rust テスト

### Code Quality

- `bun run format` - oxfmt
- `bun run lint` - oxlint
- `bun run typecheck` - vue-tsc
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` - Rust lint

### 品質ゲート（タスク完了時に全て通すこと）

```
bun run lint && bun run typecheck && bun run test && bun run build
cd src-tauri && cargo check && cargo clippy --all-targets -- -D warnings && cargo test && cargo fmt --check
```

### Installation

- `bun run install-app` - ビルド済みアプリを /Applications へインストール

## Browser-Based UI Testing

### Overview

`bun run dev:web` でブラウザから直接 UI にアクセスしてテストできます。
Tauri 環境でない場合のみ IPC のモックが自動注入されます（`src/renderer/src/mocks/electron-mocks.ts`）。

### アクセス方法

- **メインタスクバー**: http://localhost:10234/
- **設定画面**: http://localhost:10234/?view=option
- **メニュー**: http://localhost:10234/?view=menu
- **全ウィンドウリスト**: http://localhost:10234/?view=fullWindowList

### モック機能

- `windowReady` 送信で `process` / `iconUpdate` / `displayInfo` / `updateOptions` のサンプルデータが自動送信される
- ブラウザコンソールの `window.__mockHelpers` で手動発火可能
- フィクスチャーは `src/renderer/src/mocks/sample-fixture.ts`

### Playwright MCP による自動テスト

Playwright MCP でブラウザ上の UI 動作を自動テストできます。
一時ファイル（スクリーンショット等）は `.playwright-mcp/` に保存すること（gitignore 済み）。

## Architecture

### Rust Backend (src-tauri/src/)

- `commands.rs` - Tauri コマンド22本（フロントの旧 IPC チャンネルとの対応表コメント付き）
- `window_manager.rs` - CGWindowList によるウィンドウ列挙
- `filter.rs` - ウィンドウフィルタ判定
- `window_observer.rs` - NSWorkspace 通知 → 500ms デバウンス → `process` emit
- `window_actions.rs` - AXUIElement によるアクティブ化・クローズ
- `permission_manager.rs` - アクセシビリティ・画面収録権限
- `icon_manager.rs` - アプリアイコン取得（base64）＋ FS キャッシュ
- `display_manager.rs` - マルチディスプレイのタスクバーウィンドウ生成・配置
- `store.rs` - tauri-plugin-store の設定管理（electron-store からの冪等移行込み）

### Frontend (src/renderer/)

- 単一エントリー `index.html` / `src/main.ts`、`?view=` で App.vue が動的 import
- IPC は `src/composables/ipc.ts` に集約（Tauri invoke/listen とモックのランタイム切替）
- State management with Pinia、Styling with UnoCSS

**詳細は `src/renderer/CLAUDE.md` を参照。**

### Configuration Management

- tauri-plugin-store（`~/Library/Application Support/space.riinswork.taskbar/`）
- 設定スキーマは `src-tauri/src/store.rs` と `src/renderer/src/types.ts` で一致させる
- 初回起動時に旧 electron-store（taskbar.fm/config.json）から冪等に移行する

## Key Technical Notes

- **署名**: `tauri.conf.json` の `bundle.macOS.signingIdentity`（Developer ID Application）。
  notarize は `scripts/build-release.sh` が `.env`（APPLE_ID / APPLE_ID_PASS / TEAM_ID）を
  Tauri の環境変数名にマッピングして実行する。`.env` はコミット禁止
- **座標系**: Tauri の Monitor / outer_position は物理 px。論理 px への変換
  （scale_factor / to_logical）を忘れない
- **コマンド呼び出し**: フロントは camelCase チャンネル名 → snake_case コマンド名に変換
  （`ipc.ts` の toCommand）。引数は ARG_KEYS で名前付き引数化
