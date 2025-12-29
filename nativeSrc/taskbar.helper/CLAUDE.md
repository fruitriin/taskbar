# CLAUDE.md - TaskbarHelper (Swift)

This file provides guidance to Claude Code (claude.ai/code) when working with the TaskbarHelper Swift application.

## Project Overview

TaskbarHelper は macOS のネイティブウィンドウ情報取得とシステム統合を担当する Swift アプリケーションです。Electron のメインプロセスと連携し、タスクバーに必要なウィンドウ情報、アイコン、権限管理などを提供します。

### 主要な役割

- **ウィンドウ情報の取得**: CGWindowListCopyWindowInfo API を使用してシステム全体のウィンドウ情報を取得
- **アイコン管理**: プロセスごとのアプリケーションアイコンをキャッシュ付きで取得
- **フィルタリング**: ユーザー設定に基づいてウィンドウをフィルタリング（Dock、システムウィンドウなどを除外）
- **リアルタイム監視**: ウィンドウの変更（起動、終了、アクティブ化）をリアルタイムで監視
- **権限管理**: スクリーンレコーディングとアクセシビリティの権限チェック

## Architecture

### main.swift の構造

main.swift（約1,300行）は以下のセクションで構成されています：

#### 1. Debug Logging & Watchdog (行 32-84)
- `logBefore()`: 処理前のログ出力（ハング時の診断用）
- `WatchdogTimer`: タイムアウト監視とスレッドダンプ取得
- 環境変数 `TASKBAR_VERBOSE` でverboseログを有効化

#### 2. Data Type Extensions (行 86-121)
- `NSBitmapImageRep.png()`: PNG データへの変換
- `NSImage.resized(to:)`: アイコンのリサイズ処理

#### 3. Filter Management (行 123-459)
- `FilterRule`: フィルター設定の構造体
- `FilterManager`: フィルター設定ファイルの監視とキャッシュ管理
  - `~/Library/Application Support/taskbar.fm/filter.json` を監視
  - ファイル変更時に自動リロード
- `filterWindows()`: ウィンドウリストのフィルタリング処理

#### 4. Icon Management (行 461-526)
- `iconCache`: プロセスごとのアイコンキャッシュ（メモリ内）
- `getIconBase64()`: タイムアウト付きアイコン取得（50ms）
- NSRunningApplication API 使用

#### 5. Permission Management (行 532-621)
- `checkAccessibilityPermission()`: AXIsProcessTrusted() による確認
- `checkScreenRecordingPermission()`: SCShareableContent API 使用
- `getPermissionStatus()`: JSON 形式で権限状態を返却

#### 6. Progressive Icon Loading (行 623-796)
- `ProgressiveIconLoader`: アイコンを並列取得して段階的に送信
  1. 即座にアイコンなしでウィンドウリスト送信
  2. 並列でアイコン取得（100ms 間隔で更新通知）
  3. `~/Library/Application Support/taskbar.fm/icons.json` にキャッシュ

#### 7. Window Information (行 798-871)
- `windowListProvider()`: CGWindowListCopyWindowInfo のラッパー（テスト用に差し替え可能）
- `getWindowInfoListData()`: フィルタリング済みウィンドウ情報を JSON で返却

#### 8. Window Observer (行 873-964)
- `WindowObserver`: ウィンドウ変更イベントの監視
  - `NSWorkspace.didActivateApplicationNotification`
  - `NSWorkspace.didLaunchApplicationNotification`
  - `NSWorkspace.didTerminateApplicationNotification`
  - カスタム通知 `FiltersChanged`
- 500ms の遅延後にウィンドウ情報を更新（非同期処理）

#### 9. Process Management (行 966-1024)
- `ProcessManager`: プロセスライフサイクル管理
  - ハートビート（1秒間隔）
  - 最大実行時間の監視（デフォルト5分、watchモードでは無制限）
  - グレースフルシャットダウン

#### 10. Signal Handling (行 1026-1046)
- SIGTERM, SIGINT, SIGUSR1 のハンドリング
- グレースフルシャットダウンのトリガー

#### 11. Main Entry Point (行 1048-1324)
- コマンドライン引数の処理
- 各コマンドの実装（grant, debug, list, exclude, watch, check-permissions, get-config, completion）

## Build and Development

### ビルド方法

プロジェクトルートから以下のコマンドを実行：

```bash
# Xcode でプロジェクトを開く
mise run helper

# コマンドラインでビルド
mise run swiftbuild
```

ビルド成果物は以下に配置されます：
```
nativeSrc/DerivedData/taskbar.helper/Build/Products/Release/TaskbarHelper
```

Electron アプリで使用するために、ビルド後に `resources/TaskbarHelper` へコピーされます。

### 開発環境

- **言語**: Swift 5+
- **最小 macOS**: macOS 12.3+（SCShareableContent API 使用のため）
- **依存関係**: SwiftyJSON（.build/checkouts 内）
- **IDE**: Xcode

### テスト

```bash
# Xcode でテストを実行（推奨）
mise run helper
# Product → Test

# コマンドラインでテスト
cd nativeSrc
swift test
```

テストファイル：
- `taskbar.helper/FilterWindowsTests.swift`: filterWindows() のユニットテスト

## Commands

TaskbarHelper は以下のコマンドをサポートしています：

| コマンド | 説明 | 使用場面 |
|---------|------|----------|
| `grant` | スクリーンレコーディング権限を要求 | 初回セットアップ時 |
| `debug` | 全ウィンドウ情報をJSON出力（フィルタリングなし） | デバッグ時 |
| `list` | フィルター済みウィンドウ一覧をワンショット出力 | ウィンドウリスト取得 |
| `exclude` | 除外されたウィンドウ一覧をワンショット出力 | フィルター設定の確認 |
| `watch` | ウィンドウ変更を監視してリアルタイム出力 | タスクバー常駐モード |
| `check-permissions` | 権限状態をJSON形式で出力 | 権限確認 |
| `get-config` | 設定ファイル（config.json）の内容を出力 | 設定確認 |
| `completion [fish\|zsh]` | シェル補完スクリプトを出力 | シェル統合 |

### 実行例

```bash
# ワンショットでウィンドウリスト取得
./TaskbarHelper list

# リアルタイム監視（無制限）
./TaskbarHelper watch

# 権限確認
./TaskbarHelper check-permissions
```

## UE Troubleshooting (Unresponsive Execution)

### UE（応答なし状態）とは

TaskbarHelper が応答しなくなる状態を UE（Unresponsive Execution / Unexpected Error）と呼びます。main.swift には UE リスクのある箇所に詳細なコメントが記載されています。

### 最も一般的な原因：コード署名の問題

**最初に確認すべき項目**：

1. Xcode でプロジェクトを開く：`mise run helper`
2. **taskbar.helper target** → **Signing & Capabilities** タブを開く
3. **Signing Certificate** が有効かどうか確認
   - ❌ 期限切れの証明書
   - ❌ 間違った証明書（配布用証明書など）
   - ✅ "Sign to Run Locally" または有効な開発者証明書
4. 証明書を修正後、再ビルド：`mise run swiftbuild`

### UE リスクの高い API（main.swift に記載）

#### CRITICAL リスク

| API | 場所 | リスク内容 | 対策 |
|-----|------|-----------|------|
| `CGWindowListCopyWindowInfo` | main.swift:809-841 | WindowServer との同期通信でカーネルレベルブロック | ウォッチドッグタイマー（5秒） |
| `FileHandle.standardOutput.write` | main.swift:723-752 | stdout パイプバッファフル時にブロック | ウォッチドッグタイマー（3秒） |

#### MEDIUM リスク

| API | 場所 | リスク内容 | 対策 |
|-----|------|-----------|------|
| `NSRunningApplication.icon` | main.swift:476-526 | ゾンビ状態プロセスでブロック | タイムアウト（50ms）、バックグラウンドキュー |
| `SCShareableContent.getExcludingDesktopWindows` | main.swift:544-600 | 権限ダイアログ表示中にブロック | タイムアウト（100ms） |
| `Data(contentsOf:)` | main.swift:238-262 | 大きなファイル、ネットワークドライブでブロック | try-catch、エラー時はデフォルト値 |

#### LOW リスク

| API | 場所 | リスク内容 | 対策 |
|-----|------|-----------|------|
| `FileManager.attributesOfItem` | main.swift:220-236 | ネットワークファイルシステムでブロック | try-catch |
| `open()` | main.swift:267-281 | ネットワークドライブでブロック | エラーハンドリング |
| `Data.write(to:options:)` | main.swift:776-794 | ディスク容量不足、I/O障害でブロック | try?、失敗しても再取得可能 |

### 実験結果（2025-12-29）

以下の操作では UE にならないことを確認済み：

- ✅ 10-20個のlistコマンドを並列実行（100個以上のウィンドウ）
- ✅ Mission Control 表示中に並列実行
- ✅ watchモード3秒間実行（アイコン更新含む）
- ✅ 権限削除 → check-permissions 実行
- ✅ 権限ダイアログ表示中に並列実行

### デバッグ用 Verbose ログ

UE の原因調査には環境変数 `TASKBAR_VERBOSE` を設定：

```bash
export TASKBAR_VERBOSE=1
./TaskbarHelper watch
```

これにより以下が stderr に出力されます：
- 各操作の開始ログ（タイムスタンプ、スレッドID付き）
- ウォッチドッグタイムアウト警告
- スレッドダンプ（ハング時）

## Configuration Files

### filter.json

フィルター設定ファイル：

**場所**: `~/Library/Application Support/taskbar.fm/filter.json`

**形式**:
```json
{
  "labeledFilters": [
    {
      "label": "オフスクリーンウィンドウを除外",
      "filters": [
        {
          "property": "kCGWindowIsOnscreen",
          "is": false
        }
      ]
    }
  ]
}
```

**監視**: FilterManager が自動的にファイル変更を監視（DispatchSource.makeFileSystemObjectSource）

### icons.json

アイコンキャッシュファイル：

**場所**: `~/Library/Application Support/taskbar.fm/icons.json`

**形式**:
```json
{
  "AppName": "data:image/png;base64,iVBOR..."
}
```

**更新**: ProgressiveIconLoader が100ms間隔で更新（atomic write）

## Entitlements

`taskbar.helper.entitlements` には以下の権限が必要：

```xml
<key>com.apple.security.device.screen-recording</key>
<true/>
<key>com.apple.security.get-task-allow</key>
<true/>
```

### 権限の確認

```bash
# アクセシビリティ権限
# システム設定 → プライバシーとセキュリティ → アクセシビリティ

# スクリーンレコーディング権限
# システム設定 → プライバシーとセキュリティ → 画面収録
```

## Development Guidelines

### コードの追加・修正時の注意事項

1. **UE リスクの評価**
   - ブロッキング I/O（ファイル、ネットワーク、プロセス間通信）を追加する場合、UE リスクをコメントで記載
   - タイムアウトまたはバックグラウンドキュー実行を検討

2. **ログの追加**
   - 新しい処理を追加する場合、`logBefore()` でログを追加
   - `verboseLogging` フラグでログ出力を制御

3. **テストの作成**
   - フィルター関連の変更は FilterWindowsTests.swift に追加
   - テスト用に `windowListProvider` をモックに差し替え可能

4. **エラーハンドリング**
   - macOS API のエラーは適切にハンドリング
   - エラー時はデフォルト値または安全なフォールバック処理

### 既知の制限事項

- **macOS 12.3 未満**: SCShareableContent API が利用不可（権限チェックが簡易化）
- **アイコン取得タイムアウト**: 50ms 以内に取得できない場合はスキップ
- **最大実行時間**: watchモード以外は5分（デフォルト）

### 今後の計画（main.swift:407-412 参照）

- 設定画面でフィルタを追加した際に filter.json に書き込むように変更
- ウィンドウ除外用 API の動作確認
- ウィンドウ一覧画面で動作中と除外中のウィンドウを分けて表示
- アプリ再起動ボタンの追加検討

## Related Files

- **メインプロセス連携**: `src/main/funcs/helper.ts`（Electron側）
- **設定管理**: `src/main/funcs/store.ts`（Electron側）
- **プロジェクトルート**: `CLAUDE.md`（全体ドキュメント）

## Testing Tips

### ウィンドウ情報のモック

テスト時に `windowListProvider` をモックに差し替えることができます：

```swift
// FilterWindowsTests.swift の例
windowListProvider = {
    return [
        createTestWindow(name: "Test", owner: "TestApp", width: 800, height: 600)
    ]
}
```

### アイコンキャッシュのクリア

デバッグ時にアイコンキャッシュをクリア：

```bash
rm ~/Library/Application\ Support/taskbar.fm/icons.json
```

### フィルター設定のリセット

フィルター設定を削除してデフォルトに戻す：

```bash
rm ~/Library/Application\ Support/taskbar.fm/filter.json
# TaskbarHelperを再起動すると getDefaultFilters() が使用される
```