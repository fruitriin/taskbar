# Phase 3: Electron + Swift → Tauri v2 + ビルドチェーン完全移行

**親ドキュメント**: [リアーキテクチャ計画書](../rearchitecture-plan.md)

**前提**: 一気通貫で実施。途中ではビルドが通らなくてよい。
3.1〜3.5 のサブタスクで進捗を管理する。

---

## 3.1 Tauri プロジェクト初期化

### Tauri セットアップ

- [ ] `@tauri-apps/cli` をインストール
- [ ] `src-tauri/` ディレクトリの作成
- [ ] `Cargo.toml` の設定

```toml
[package]
name = "taskbar-fm"
version = "3.0.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-store = "2"
tauri-plugin-macos-permissions = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
objc2 = "0.6"
objc2-core-graphics = { version = "0.3", features = ["CGWindow", "CGWindowList"] }
objc2-app-kit = { version = "0.3", features = ["NSRunningApplication", "NSWorkspace", "NSImage"] }
objc2-accessibility = "0.3"
```

- [ ] `tauri.conf.json` の設定

```json
{
  "productName": "Taskbar.fm",
  "identifier": "space.riinswork.taskbar",
  "build": {
    "devUrl": "http://localhost:10234",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "label": "taskbar",
        "url": "/?view=taskbar",
        "decorations": false,
        "alwaysOnTop": true,
        "transparent": true,
        "skipTaskbar": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "macOS": {
      "entitlements": "./capabilities/entitlements.plist",
      "signingIdentity": null
    }
  }
}
```

- [ ] `capabilities/default.json` の設定（Tauri v2 権限）

### ビルドチェーン完全切り替え

- [ ] `electron-vite` を package.json から削除
- [ ] `electron.vite.config.ts` を削除
- [ ] `vite.config.ts` を Tauri + UnoCSS + Vue 用に再構成

```typescript
// vite.config.ts
import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  server: {
    port: 10234,
  },
  build: {
    outDir: 'dist',
  },
})
```

- [ ] `@tauri-apps/api`, `@tauri-apps/plugin-store` をインストール

---

## 3.2 Rust バックエンド - 基盤

### main.rs

- [ ] Tauri エントリーポイントの実装

```rust
// src-tauri/src/main.rs
mod commands;
mod window_manager;
mod window_observer;
mod window_actions;
mod icon_manager;
mod permission_manager;
mod filter;
mod store;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::window_ready,
            commands::activate_window,
            commands::close_window,
            commands::grant_permission,
            commands::check_permissions,
            commands::open_option_window,
            commands::open_menu_window,
        ])
        .setup(|app| {
            window_observer::start_observation(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### window_manager.rs

CGWindowListCopyWindowInfo のラッパー。現行 Swift (main.swift:798-871) を Rust に移植。

- [ ] `get_window_list()` — 全ウィンドウ情報の取得（タイムアウト 5秒）
- [ ] `parse_window_info()` — CFDictionary → MacWindow 構造体への変換
- [ ] UE 対策: `tokio::time::timeout` + `spawn_blocking`

```rust
use std::time::Duration;
use tokio::time::timeout;

pub async fn get_window_list() -> Result<Vec<MacWindow>, String> {
    timeout(Duration::from_secs(5), tokio::task::spawn_blocking(|| {
        unsafe {
            let info = CGWindowListCopyWindowInfo(
                kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
                kCGNullWindowID,
            );
            parse_window_info(info)
        }
    }))
    .await
    .map_err(|_| "CGWindowListCopyWindowInfo timed out (5s)".to_string())?
    .map_err(|e| format!("Thread error: {}", e))?
}
```

### filter.rs

ウィンドウフィルタリングロジック。現行 Swift (main.swift:123-459) を Rust に移植。

- [ ] `FilterRule` 構造体の定義
- [ ] `filter_windows()` — フィルターの適用
- [ ] tauri-plugin-store からフィルター設定を読み込み

### commands.rs

Tauri Commands（IPC ハンドラー）の実装。

- [ ] `window_ready` — 初期データ（ウィンドウリスト + アイコン + 設定 + ディスプレイ情報）を返す
- [ ] `activate_window` — ウィンドウのアクティブ化
- [ ] `close_window` — ウィンドウのクローズ
- [ ] `grant_permission` — スクリーン収録権限リクエスト
- [ ] `check_permissions` — 権限状態の確認
- [ ] `open_option_window` — 設定ウィンドウを開く
- [ ] `open_menu_window` — メニューウィンドウを開く

### window_observer.rs

NSWorkspace 通知の監視。現行 Swift (main.swift:873-964) を Rust に移植。

- [ ] `start_observation()` — NSWorkspace 通知の登録
- [ ] `didActivateApplicationNotification` の監視
- [ ] `didLaunchApplicationNotification` の監視
- [ ] `didTerminateApplicationNotification` の監視
- [ ] 変更検知時にフロントエンドへ `windows-updated` イベントを emit
- [ ] 500ms のデバウンス

---

## 3.3 Rust バックエンド - 機能

### icon_manager.rs

アイコン取得・キャッシュ。現行 Swift (main.swift:461-796) を Rust に移植。
現行の JSON 1ファイル方式から、ファイルシステムベース（1アプリ1ファイル）に簡素化。

- [ ] `get_icon()` — キャッシュヒット → 返却、ミス → NSRunningApplication.icon から取得
- [ ] `fetch_icon_from_process()` — NSRunningApplication API 経由のアイコン取得（タイムアウト 50ms）
- [ ] `invalidate_icon()` — キャッシュファイル削除
- [ ] アイコンキャッシュディレクトリ: `~/Library/Application Support/taskbar.fm/icons/`
- [ ] 段階的アイコンロード: 先にウィンドウリストを送信、後からアイコンを段階的に送信

### window_actions.rs

AXUIElement によるウィンドウ操作。現行の AppleScript (shell exec) を置換。

- [ ] `activate()` — AXUIElementCreateApplication → kAXFocusedAttribute 設定
- [ ] `close()` — kAXCloseButtonAttribute → AXUIElementPerformAction
- [ ] NSRunningApplication.activate でアプリ自体をフォアグラウンドに

### permission_manager.rs

権限チェック・リクエスト。現行 Swift (main.swift:532-621) を Rust に移植。

- [ ] `check_accessibility()` — AXIsProcessTrusted()
- [ ] `check_screen_recording()` — SCShareableContent API（タイムアウト 100ms）
- [ ] `request_screen_recording()` — 権限ダイアログの表示
- [ ] tauri-plugin-macos-permissions の活用を検討

### store.rs

Rust 側から設定を読む場合のヘルパー。設定の主管はフロントエンドの useReactiveStore。

- [ ] `get_options()` — tauri-plugin-store 経由で Options を読み取り
- [ ] `get_labeled_filters()` — フィルター設定の読み取り
- [ ] Rust 側で設定変更が必要な場合の write ヘルパー

### マルチディスプレイ対応

- [ ] Tauri の `Monitor` API でディスプレイ情報を取得
- [ ] 各ディスプレイに WebviewWindow を動的生成
- [ ] ディスプレイ追加/削除/メトリクス変更時にウィンドウを再作成
- [ ] レイアウト設定（bottom/left/right）に応じた位置計算

---

## 3.4 フロントエンド接続

### IPC ラッパー差し替え

Phase 1 で作成した `ipc.ts` の内部実装を Tauri に切り替え。

- [ ] `ipc.ts` の実装を Tauri API に差し替え

```typescript
// src/composables/ipc.ts
// Phase 3: Tauri 実装
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export async function ipcInvoke<T>(command: string, args?: any): Promise<T> {
  return invoke<T>(command, args)
}

export function ipcListen<T>(event: string, handler: (payload: T) => void): () => void {
  let unlisten: (() => void) | undefined
  listen<T>(event, (e) => handler(e.payload)).then((fn) => { unlisten = fn })
  return () => unlisten?.()
}
```

### useReactiveStore 差し替え

Phase 1 で作成した composable の内部実装を tauri-plugin-store に差し替え。
**composable のインターフェースは変更しない。**

- [ ] `useReactiveStore.ts` を tauri-plugin-store ベースに書き換え

```typescript
// src/composables/useReactiveStore.ts
// Phase 3: tauri-plugin-store 実装
import { ref, watch, type Ref } from 'vue'
import { Store } from '@tauri-apps/plugin-store'

export function useReactiveStore<T>(key: string, defaultValue: T): Ref<T> {
  const data = ref<T>(defaultValue) as Ref<T>
  let store: Store
  let externalUpdate = false

  async function init() {
    store = await Store.load('config.json')

    const saved = await store.get<T>(key)
    if (saved !== null) {
      externalUpdate = true
      data.value = saved
      externalUpdate = false
    }

    // 他ウィンドウからの変更を自動受信
    await store.onKeyChange<T>(key, (newValue) => {
      if (newValue !== null) {
        externalUpdate = true
        data.value = newValue
        externalUpdate = false
      }
    })
  }

  watch(data, async (newValue) => {
    if (externalUpdate) return
    await store.set(key, newValue)
    await store.save()
  }, { deep: true })

  init()
  return data
}
```

### ブラウザテスト用モック更新

- [ ] `tauri-mocks.ts` を作成（Electron モックを Tauri API モックに置換）
- [ ] `@tauri-apps/api/core` の `invoke` をモック
- [ ] `@tauri-apps/api/event` の `listen` / `emit` をモック
- [ ] `@tauri-apps/plugin-store` の `Store` をモック
- [ ] `window.__mockHelpers` を維持（ブラウザコンソールからの操作用）
- [ ] `sample-fixture.ts` はそのまま維持

### マルチウィンドウ結合

- [ ] App.vue の URLパラメータベースのビュー切り替えが Tauri ウィンドウと正しく動作することを確認
- [ ] 設定画面のウィンドウ生成（Rust 側 `open_option_window` → Vue 側 `/?view=option`）
- [ ] メニューウィンドウの生成（カーソル位置に表示）

---

## 3.5 統合・テスト・クリーンアップ

### 動作確認

- [ ] `cargo tauri dev` でアプリが起動
- [ ] メインタスクバーにウィンドウが表示される
- [ ] ウィンドウクリックでアクティブ化される
- [ ] 右クリックメニューが動作する
- [ ] 設定画面が開き、設定変更が全ウィンドウに即反映される
- [ ] マルチディスプレイで各ディスプレイにタスクバーが表示される
- [ ] `vp dev` でブラウザテスト用サーバーが起動し、モックで UI が動作する

### コード署名・ノータリゼーション

- [ ] `tauri.conf.json` の署名設定
- [ ] Apple Developer 証明書の設定
- [ ] `cargo tauri build` で署名済みバイナリが生成されることを確認
- [ ] ノータリゼーションが完了することを確認

### テスト

- [ ] 既存の Vue テストを移植（Electron モック → Tauri モック）
- [ ] `vp test` で全テストがパス
- [ ] `vp check` が通る
- [ ] `cargo test` で Rust 側テストがパス

### Electron / Swift 削除

- [ ] 以下のパッケージを削除:
  - `@electron-toolkit/preload`
  - `@electron-toolkit/utils`
  - `@electron-toolkit/tsconfig`
  - `@electron/notarize`
  - `electron`
  - `electron-builder`
  - `electron-store`
  - `electron-vite`
  - `electron-updater`
- [ ] `src/main/` ディレクトリを削除
- [ ] `src/preload.ts` を削除
- [ ] `build/` ディレクトリを削除（notarize.js, afterPack.js, entitlements.mac.plist）
- [ ] `electron-builder.yml` を削除
- [ ] Swift ヘルパーコードのアーカイブ（`git tag v2-electron-final` でスナップショットを残す）
- [ ] `nativeSrc/` ディレクトリを削除（またはアーカイブ用に残す）

### ドキュメント更新

- [ ] `CLAUDE.md`（ルート）を新アーキテクチャに合わせて更新
- [ ] `src/main/CLAUDE.md` を削除
- [ ] `src/renderer/CLAUDE.md` を `src/CLAUDE.md` にリネーム・更新
- [ ] `nativeSrc/taskbar.helper/CLAUDE.md` を削除
- [ ] `reference/electron-store-*.md` をアーカイブまたは削除
- [ ] README.md の更新

### 設定ファイル削除

- [ ] `.mise.toml`（Phase 2 で削除済みのはず）
- [ ] `electron.vite.config.ts`
- [ ] `electron-builder.yml`
- [ ] `build/` ディレクトリ

---

## 完了条件

- [ ] `cargo tauri dev` でアプリが起動し、全機能が動作する
- [ ] `vp dev` でブラウザテスト用サーバーが起動し、モックで UI が動作する
- [ ] `vp check` が通る
- [ ] `vp test` で全テストがパスする
- [ ] `cargo tauri build` で署名済みバイナリが生成される
- [ ] Electron, Swift, electron-vite, mise の痕跡がコードベースにゼロ
- [ ] 設定変更が全ウィンドウにリアクティブに同期される（useReactiveStore 経由）
- [ ] CLAUDE.md が新アーキテクチャを正確に反映している
