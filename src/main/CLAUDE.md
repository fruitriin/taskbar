# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Directory Overview

このディレクトリ（`src/main`）は、Taskbar.fmアプリケーションのElectronメインプロセスを含んでいます。Node.js環境で動作し、ネイティブのSwift Helperプロセスと通信してmacOSのウィンドウ情報を取得します。

## Development Commands

すべてのコマンドはリポジトリルートから実行してください：

### テスト関連

```bash
# メインプロセスの全テストを実行
mise run test

# 特定のテストファイルを実行
cd src/main && bun test tests/funcs/store.test.ts --preload ./tests/setup.ts

# プロジェクトルートからの実行例
bun test src/main/tests/funcs/helper.test.ts --preload src/main/tests/setup.ts
```

### 型チェック

```bash
# メインプロセスの型チェック
mise run typecheck:node
```

## Architecture

### Entry Point

- **main.ts** - アプリケーションのエントリーポイント
  - アプリライフサイクルの管理
  - ディスプレイイベントの初期化
  - グローバルショートカットの登録（開発時のみ）
  - Helper プロセスのクリーンアップ

### Core Modules (funcs/)

モジュール間の主な依存関係：

```
main.ts
  ├─> events.ts (イベントハンドラーの登録)
  ├─> windows.ts (タスクバーウィンドウの管理)
  ├─> optionWindows.ts (設定・メニューウィンドウの管理)
  └─> helper.ts (ネイティブHelperプロセスとの通信)
        ├─> icon-cache.ts (アプリアイコンのキャッシュ)
        └─> store.ts (electron-store設定管理)
```

#### helper.ts

Swift製のTaskbarHelperバイナリとの通信を管理する最重要モジュール：

- **プロセス管理**: Helper バイナリの起動・再起動・クリーンアップ
- **データ受信**: Swift側からのJSON行を受信・パース
  - `process`: ウィンドウ情報の更新
  - `iconUpdate`: アイコンデータの更新（Base64形式）
  - `excludedProcess`: 除外プロセスの情報
- **権限管理**: 画面収録・アクセシビリティ権限のチェックと要求
- **ウィンドウ操作**: ウィンドウのアクティベーション・クローズ
- **エラーハンドリング**: 自動再起動ロジック（パース失敗時）

**重要**: Helper プロセスがハングした場合、main.tsの`before-quit`イベントで自動的にクリーンアップされます。

#### events.ts

メインプロセスとレンダラープロセス間のIPC通信を一元管理：

- **ディスプレイイベント**: display-added/removed/metrics-changed で全ウィンドウを再作成
- **ウィンドウ操作**: activeWindow, closeWindow
- **設定管理**: setOptions, getOptions, resetOptions
- **フィルター管理**: フィルターの追加・削除・適用
- **開発用**: dumpTaskbarInfo - タスクバーの状態をダンプ（開発時のみ）

#### windows.ts

タスクバーウィンドウのライフサイクル管理：

- **マルチディスプレイ対応**: 各ディスプレイにタスクバーウィンドウを作成
- **ウィンドウ配置**: レイアウト設定（top/bottom/left/right）に応じた位置計算
- **taskbars オブジェクト**: ディスプレイIDをキーとしたBrowserWindowの管理

#### optionWindows.ts

設定画面・メニューウィンドウ・全ウィンドウリストの管理：

- **設定ウィンドウ**: createOptionWindow() - 単一インスタンス
- **メニューウィンドウ**: createMenuWindow() - カーソル位置に表示
- **全ウィンドウリスト**: createFullWindowListWindow() - デバッグ用（開発時Cmd+Shift+Wで起動）

#### store.ts

electron-storeを使用した永続化設定の管理：

- **マイグレーション**: バージョン間での設定互換性を管理
  - `>=1.6.2`: headers/footers の追加
  - `>=2.0.0`: ストアの完全リセット
- **設定項目**:
  - `options.layout`: タスクバーの位置（'right' | 'left' | 'bottom'）
  - `options.windowSortByPositionInApp`: アプリ内でのウィンドウ位置によるソート
  - `labeledFilters`: ウィンドウフィルター設定（Dock、通知センターなどを除外）

**参考**: electron-store の詳細なAPIリファレンスは `reference/electron-store-api-reference.md` を参照してください。

#### icon-cache.ts

アプリケーションアイコンのキャッシュシステム：

- Helper から受信したBase64エンコードされたアイコンを永続化
- 開発環境: `logs/icons.json`
- 本番環境: `app.getPath('userData')/icons.json`

#### filter-migration.ts

レガシーフィルター形式から新形式への移行ロジック：

- 旧形式（`LegacyFilters`）→ 新形式（`LabeledFilters`）への変換
- マイグレーションのテストケース: `tests/funcs/filter-migration.test.ts`

## Type Definitions

### MacWindow (type.d.ts)

Swift Helper から受信するウィンドウ情報の型定義：

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
  appIcon: string // Base64エンコードされたPNGデータ
}
```

## Testing

### Test Setup

- **テストランナー**: Bun Test (Vitest互換)
- **セットアップファイル**: `tests/setup.ts`
  - Electronモジュールのモック（BrowserWindow, ipcMain, screen, app）
  - child_processのモック（Helper プロセス通信用）
  - electron-storeのモック
  - fsのモック

### Test Structure

```
tests/
├── setup.ts                           # 共通モック設定
└── funcs/
    ├── store.test.ts                  # electron-store の設定管理
    ├── helper.test.ts                 # Helper プロセス通信
    ├── windows.test.ts                # ウィンドウ管理
    ├── filter-migration.test.ts       # フィルター移行ロジック
    └── store-migration.test.ts        # ストアマイグレーション
```

### Running Tests

```bash
# すべてのテストを実行（リポジトリルートから）
mise run test

# 特定のテストファイルを実行
cd src/main
bun test tests/funcs/helper.test.ts --preload ./tests/setup.ts

# または、リポジトリルートから
bun test src/main/tests/funcs/helper.test.ts --preload src/main/tests/setup.ts
```

## ESLint Rules

このプロジェクトでは厳格な型チェックが有効です（package.json参照）：

- `@typescript-eslint/explicit-function-return-type: error` - **すべての関数に戻り値の型を明示する必要があります**
- `@typescript-eslint/no-unused-vars: error` - 未使用変数は`_`プレフィックスで無視可能

**重要**: 新しい関数を追加する際は、必ず戻り値の型を明示してください。

```typescript
// ✅ Good
function getWindows(): MacWindow[] {
  return macWindowProcesses
}

// ❌ Bad - エラーになる
function getWindows() {
  return macWindowProcesses
}
```

## Key Technical Notes

### Helper Process Communication

- Helper はバイナリパスから起動され、stdout経由でJSON行を送信
- 各行は `type` フィールドを持つ：`process`, `iconUpdate`, `excludedProcess`
- パースエラー時は自動的に再起動ロジックが作動（debounce 3秒）

### Multi-Display Support

- `Screen.getAllDisplays()` で取得した各ディスプレイに対して個別のタスクバーウィンドウを作成
- ディスプレイ変更イベント（追加・削除・メトリクス変更）で全ウィンドウを再作成
- `taskbars` オブジェクトはディスプレイIDをキーとしてBrowserWindowを保持

### Icon Caching Strategy

1. Helper が定期的にアイコン情報を送信（`iconUpdate`イベント）
2. Base64エンコードされたPNGデータを受信
3. `icon-cache.ts` がJSONファイルに永続化
4. 既存のプロセスリスト（`macWindowProcesses`）にアイコンを適用
5. レンダラープロセスに変更を通知

### Development vs Production

- 開発環境: `is.dev === true`

  - Helper バイナリパス: `__dirname/../../resources/TaskbarHelper`
  - アイコンキャッシュ: `logs/icons.json`
  - エラーログ: `logs/helper-errors.log`
  - 全ウィンドウリスト: Cmd+Shift+W で起動可能

- 本番環境: `app.isPackaged === true`
  - Helper バイナリパス: `process.resourcesPath/TaskbarHelper`
  - アイコンキャッシュ: `userData/icons.json`

## API References

メインプロセスで使用する主要ライブラリの詳細なAPIリファレンスが `reference/` ディレクトリにあります：

### electron-store

設定管理（`store.ts`）で使用する electron-store ライブラリのリファレンス：

- **`reference/electron-store-api-reference.md`** - API リファレンス
  - コンストラクタオプション（schema, migrations, defaults 等）
  - メソッド一覧（get, set, delete, clear, onDidChange 等）
  - 型定義とスキーマ検証

- **`reference/electron-store-examples.md`** - 実用例
  - アプリケーション設定ストアの実装例
  - スキーマ定義のベストプラクティス
  - マイグレーション戦略

### just-diff

オブジェクトの差分検出で使用する just-diff ライブラリのリファレンス：

- **`reference/JUST-DIFF-REFERENCE.md`** - ライブラリリファレンス
  - 基本的な使用方法
  - 操作タイプ（add, remove, replace）
  - パス形式とJSON Patch

- **`reference/just-diff-reference.js`** - 実装例
  - 実際のコード例とテストケース

**使用場面**: これらのリファレンスは、設定管理の実装変更やデバッグ時に参照してください。
