# TaskbarHelperのデバッグ出力を使用したテスト

このドキュメントでは、TaskbarHelperのデバッグ出力を使用してリアルなテストデータを作成し、フィルタリング機能をテストする方法について説明します。

## 概要

TaskbarHelperは`debug`コマンドを提供しており、現在システムで開いているすべてのウィンドウ情報をJSON形式で出力します。この出力をテストフィクスチャーとして使用することで、実際の環境に近いテストを行うことができます。

## ファイル構成

```
src/main/tests/fixtures/
├── taskbar-helper-fixtures.ts    # テストデータとヘルパー関数
└── filter-fixtures.ts            # フィルター関連のテストデータ

src/main/tests/funcs/
├── helper-filtering.test.ts      # filterProcesses関数のテスト
├── filter-migration.test.ts      # フィルター移行のテスト
└── store-migration.test.ts       # ストアマイグレーションのテスト

scripts/
└── capture-helper-debug.sh       # デバッグ出力キャプチャスクリプト

docs/
└── testing-with-taskbar-helper.md # このドキュメント
```

## 使用方法

### 1. TaskbarHelperのビルド

```bash
# Swift helperをビルド
mise run swiftbuild

# または、Xcodeで開く
mise run helper
```

### 2. デバッグ出力のキャプチャ

#### 方法A: スクリプトを使用（推奨）

```bash
# デバッグ出力をキャプチャしてフィクスチャーを更新
./scripts/capture-helper-debug.sh
```

このスクリプトは以下を行います：
- TaskbarHelperのデバッグ出力をキャプチャ
- JSON形式で保存
- フィクスチャーファイルの更新を提案

#### 方法B: 手動実行

```bash
# デバッグ出力を直接実行
./resources/TaskbarHelper debug

# または、開発環境から
mise run swiftbuild && ./resources/TaskbarHelper debug
```

### 3. フィクスチャーの更新

キャプチャしたデータは`taskbar-helper-fixtures.ts`の`realWorldSample`配列に配置します：

```typescript
export const realWorldSample: MacWindow[] = [
  // TaskbarHelper debugの出力をここにペースト
  {
    "kCGWindowAlpha": 1,
    "kCGWindowBounds": {
      "Height": 874,
      "Width": 1512,
      "X": 204,
      "Y": 25
    },
    "kCGWindowIsOnscreen": true,
    "kCGWindowLayer": 0,
    "kCGWindowMemoryUsage": 8929280,
    "kCGWindowName": "Claude Code - Visual Studio Code",
    "kCGWindowNumber": 51234,
    "kCGWindowOwnerName": "Code",
    "kCGWindowOwnerPID": 12345,
    "kCGWindowSharingState": 1,
    "kCGWindowStoreType": 2
  }
  // ... 他のウィンドウデータ
]
```

### 4. テストの実行

```bash
# 全テストを実行
mise run test

# フィルタリング関連のテストのみ実行
npx vitest tests/funcs/helper-filtering.test.ts

# 特定のテストケースを実行
npx vitest tests/funcs/helper-filtering.test.ts -t "Size filtering"
```

## テストデータの種類

### 事前定義されたテストデータ

1. **sampleAppWindows**: 一般的なアプリケーションウィンドウ
2. **systemWindows**: システムウィンドウ（Dock、通知センターなど）
3. **finderWindows**: Finderウィンドウ（空のウィンドウを含む）
4. **tinyWindows**: 小さすぎるウィンドウ（フィルタリング対象）
5. **taskbarWindows**: Taskbar.fm自体のウィンドウ
6. **developerWindows**: 開発ツール関連のウィンドウ

### 複合テストシナリオ

- **mixedWindowScenario**: すべてのタイプを含む複合シナリオ
- **expectedFilteredWindows**: フィルタリング後に残るべきウィンドウ
- **emptyWindowScenario**: ウィンドウが存在しない場合

### リアルデータ

- **realWorldSample**: 実際のTaskbarHelper debugの出力

## テストヘルパー関数

```typescript
// PIDでフィルタリング
const chromeWindows = testHelpers.filterByPID(windows, 12345)

// アプリ名でフィルタリング
const codeWindows = testHelpers.filterByAppName(windows, 'Code')

// オンスクリーンウィンドウのみ取得
const visibleWindows = testHelpers.getOnscreenWindows(windows)

// 最小サイズ以上のウィンドウのみ取得
const validSizeWindows = testHelpers.filterByMinSize(windows, 40, 40)

// ランダムなテストウィンドウ生成
const randomWindow = testHelpers.generateRandomWindow({
  kCGWindowOwnerName: 'TestApp',
  kCGWindowName: 'Custom Window'
})
```

## フィルタリングテストの例

### 基本的なテスト

```typescript
it('Dockウィンドウを除外する', () => {
  const dockWindow = systemWindows.find(w => w.kCGWindowOwnerName === 'Dock')!
  const result = filterProcesses([dockWindow])
  
  expect(result).toHaveLength(0)
})
```

### 複合条件のテスト

```typescript
it('空のFinderウィンドウを除外する（複合条件）', () => {
  const emptyFinderWindow = finderWindows.find(w => w.kCGWindowName === '')!
  const namedFinderWindow = finderWindows.find(w => w.kCGWindowName !== '')!
  
  const result = filterProcesses([emptyFinderWindow, namedFinderWindow])
  
  // 空のFinderウィンドウは除外、名前のあるFinderウィンドウは残る
  expect(result).toHaveLength(1)
  expect(result[0].kCGWindowNumber).toBe(namedFinderWindow.kCGWindowNumber)
})
```

### リアルデータを使用したテスト

```typescript
it('実際のデータでフィルタリングをテストする', () => {
  const result = filterProcesses(realWorldSample)
  
  // 実際の環境での動作を検証
  result.forEach(window => {
    expect(window.kCGWindowBounds.Height).toBeGreaterThanOrEqual(40)
    expect(window.kCGWindowBounds.Width).toBeGreaterThanOrEqual(40)
  })
  
  // システムウィンドウが除外されていることを確認
  const systemApps = ['Dock', 'Spotlight', 'taskbar.fm']
  const resultApps = result.map(w => w.kCGWindowOwnerName)
  
  systemApps.forEach(app => {
    expect(resultApps).not.toContain(app)
  })
})
```

## ベストプラクティス

### 1. データの更新頻度

- 新しい機能を追加した際
- フィルタリングルールを変更した際  
- macOSのアップデート後
- 定期的な品質チェック時

### 2. テストデータの管理

- **多様性**: 様々なアプリケーションとウィンドウ状態をカバー
- **現実性**: 実際の使用環境に近いデータを使用
- **更新性**: 定期的にフレッシュなデータで更新

### 3. テストの書き方

- **独立性**: 各テストは他のテストに依存しない
- **明確性**: テストの意図が明確に分かる命名とコメント
- **包括性**: 正常ケースとエラーケースの両方をカバー

### 4. パフォーマンステスト

```typescript
it('大量のウィンドウを効率的に処理する', () => {
  const largeWindowSet = Array.from({ length: 1000 }, () =>
    testHelpers.generateRandomWindow()
  )
  
  const startTime = performance.now()
  const result = filterProcesses(largeWindowSet)
  const endTime = performance.now()
  
  expect(endTime - startTime).toBeLessThan(1000) // 1秒以内
})
```

## トラブルシューティング

### TaskbarHelperが見つからない

```bash
# Swiftヘルパーをビルド
mise run swiftbuild

# パスを確認
ls -la resources/TaskbarHelper
```

### 権限エラー

```bash
# 実行権限を付与
chmod +x resources/TaskbarHelper

# システム権限を確認
./resources/TaskbarHelper check-permissions
```

### JSONパースエラー

```bash
# 出力を確認
./resources/TaskbarHelper debug | jq '.'

# エラーがある場合は、Swiftコードを再ビルド
mise run swiftbuild
```

## 継続的インテグレーション

GitHub Actionsでのテスト実行例：

```yaml
- name: Build Swift Helper
  run: mise run swiftbuild

- name: Run Tests with Real Data
  run: |
    if [ -f "resources/TaskbarHelper" ]; then
      ./resources/TaskbarHelper debug > debug-output.json
      # フィクスチャーを更新してテスト実行
      mise run test
    else
      echo "TaskbarHelper not available in CI, skipping real data tests"
      mise run test --exclude=*real-data*
    fi
```

## まとめ

TaskbarHelperのデバッグ出力を活用することで、実際の環境に即したテストが可能になります。定期的にテストデータを更新し、フィルタリング機能の品質を維持していきましょう。