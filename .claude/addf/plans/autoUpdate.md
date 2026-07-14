# オートアップデート機能の検討

## 概要

Taskbar.fm にオートアップデート機能を実装するための技術的考察。electron-updater を使用し、アップデート配信サーバーでリクエスト回数を計測する機能も含める。

## 現在の状態

### 既存の構成
- **electron-updater**: v6.1.4 が既にインストール済み（package.json:98）
- **electron-builder**: v24.6.4 でビルド設定済み
- **Notarization**: macOS 向けに公証設定済み（afterSign: build/notarize.js）
- **アプリID**: space.riinswork.taskbar
- **現在のバージョン**: 2.1.0

### 未実装の項目
- アップデートチェック機能
- アップデートUI
- 配信設定（publish設定）
- リクエスト計測機能

## 実装方針

### ハイブリッド方式（GitHub Releases + Supabase Functions）

**採用アーキテクチャ:**

1. **配信**: GitHub Releases を使用（無料、信頼性高い）
   - electron-updater が標準対応
   - バージョン管理と配信が一元化
   - 無料で使用可能（パブリックリポジトリ）

2. **計測**: Supabase Functions でリクエスト回数を記録
   - サーバーレスで運用コストが低い
   - PostgreSQL データベースが標準装備
   - REST API が自動生成される
   - 無料枠が充実（月間 500,000 リクエスト）
   - アプリがアップデートチェック時に Supabase にもリクエスト送信
   - リクエストをカウントして DB に保存
   - GitHub API を使ってダウンロード数も取得可能

**メリット:**
- GitHub Releases は無料で信頼性が高い
- Supabase は無料枠が充実しており、VPS不要
- サーバーレスなのでメンテナンス負荷が低い
- PostgreSQL が使えるので複雑な集計も可能
- HTTPS が標準で提供される

**デメリット:**
- Supabase の初期設定が必要（ただし簡単）
- 無料枠を超えた場合は課金が発生（通常は超えない）

**必要な作業:**
- electron-builder.yml に GitHub publish 設定を追加
- Supabase プロジェクトのセットアップ
- Supabase Functions での計測 API 実装
- Supabase データベーステーブルの作成

## ファイル変更の詳細

### 1. electron-builder.yml

```yaml
# 追加する設定
publish:
  provider: github
  owner: [GitHubユーザー名]
  repo: [リポジトリ名]
  releaseType: release  # または draft
  private: false  # プライベートリポジトリの場合は true

# macOS用の設定を更新
mac:
  # 既存の設定...
  target:
    - target: dmg
      arch:
        - universal  # または x64, arm64
```

**変更理由**: GitHub Releases にビルド成果物を自動アップロードするため

### 2. src/main/funcs/update.ts（新規作成）

```typescript
import { autoUpdater } from 'electron-updater'
import { app, dialog } from 'electron'
import { store } from './store'

// アップデートチェックのロジック
// - 起動時のチェック
// - 定期的なチェック（設定可能）
// - 手動チェック（設定画面から）
// - ダウンロード進捗管理
// - インストール処理

// 計測サーバーへのPing送信
// - アップデートチェック時に計測サーバーにリクエスト
// - アプリバージョン、OS情報などを送信
```

**役割**:
- アップデート関連のロジックを一元管理
- autoUpdater の設定とイベントハンドラー
- 計測サーバーとの通信

### 3. src/main/main.ts

```typescript
// 追加するインポート
import { initAutoUpdater, checkForUpdates } from '@/funcs/update'

App.whenReady().then(() => {
  // 既存の初期化処理...

  // アップデート機能を初期化
  if (!is.dev) {
    initAutoUpdater()

    // 起動後少し待ってからチェック（5秒後など）
    setTimeout(() => {
      checkForUpdates()
    }, 5000)
  }
})
```

**変更理由**: アプリ起動時にアップデート機能を初期化

### 4. src/main/funcs/events.ts

```typescript
// 追加するIPCイベントハンドラー
ipcMain.handle('check-for-updates', async () => {
  // 手動でアップデートをチェック
})

ipcMain.handle('download-update', async () => {
  // アップデートをダウンロード
})

ipcMain.handle('install-update', async () => {
  // アップデートをインストール（再起動）
})

ipcMain.handle('get-update-info', async () => {
  // 現在のアップデート状態を取得
})
```

**変更理由**: レンダラープロセスからアップデート操作を可能にする

### 5. src/main/funcs/store.ts

```typescript
// defaults オブジェクトに追加
export const store = new ElectronStore({
  defaults: {
    options: {
      // 既存の設定...

      // アップデート設定
      autoCheckForUpdates: true,  // 自動チェックの有効/無効
      checkInterval: 3600000,  // チェック間隔（ミリ秒、デフォルト1時間）
      autoDownload: true,  // 自動ダウンロードの有効/無効
      notifyOnUpdate: true,  // アップデート通知の表示
    }
  }
})
```

**変更理由**: アップデート機能の設定を永続化

### 6. src/renderer/src/pages/settings.vue（新規または既存ファイルを編集）

```vue
<template>
  <div class="update-settings">
    <h3>アップデート設定</h3>

    <div class="field">
      <label class="checkbox">
        <input type="checkbox" v-model="autoCheck">
        自動的にアップデートを確認する
      </label>
    </div>

    <div class="field">
      <button @click="checkNow" class="button is-primary">
        今すぐアップデートを確認
      </button>
    </div>

    <div v-if="updateAvailable" class="notification is-info">
      新しいバージョン {{ updateInfo.version }} が利用可能です
      <button @click="downloadUpdate" class="button is-small">
        ダウンロード
      </button>
    </div>

    <div v-if="downloadProgress > 0" class="progress-container">
      <progress class="progress is-primary" :value="downloadProgress" max="100">
        {{ downloadProgress }}%
      </progress>
    </div>

    <div class="current-version">
      現在のバージョン: {{ currentVersion }}
    </div>
  </div>
</template>

<script setup lang="ts">
// アップデート関連のUI実装
</script>
```

**変更理由**: ユーザーがアップデート設定を管理できるUI

### 7. src/preload/index.ts（または該当するpreloadファイル）

```typescript
// アップデート関連のAPIを公開
contextBridge.exposeInMainWorld('update', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
})
```

**変更理由**: レンダラープロセスからアップデートAPIを安全に使用

## リクエスト計測機能の実装

### Supabase のセットアップ

#### 1. Supabase プロジェクトの作成
1. https://supabase.com でアカウント作成
2. 新しいプロジェクトを作成
3. プロジェクト URL と API キーを取得

#### 2. データベーステーブルの作成

Supabase Dashboard > SQL Editor で以下を実行：

```sql
-- アップデート確認リクエストを記録するテーブル
CREATE TABLE update_requests (
  id BIGSERIAL PRIMARY KEY,
  app_id VARCHAR(255) NOT NULL,
  app_version VARCHAR(50) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  arch VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  -- プライバシー考慮: IPアドレスは保存しない
  user_agent TEXT
);

-- インデックス作成（検索を高速化）
CREATE INDEX idx_created_at ON update_requests(created_at);
CREATE INDEX idx_app_version ON update_requests(app_version);
CREATE INDEX idx_app_id_created_at ON update_requests(app_id, created_at);

-- Row Level Security (RLS) の設定
ALTER TABLE update_requests ENABLE ROW LEVEL SECURITY;

-- 挿入は誰でも可能（匿名ユーザーからのリクエスト計測のため）
CREATE POLICY "Allow anonymous insert" ON update_requests
  FOR INSERT TO anon
  WITH CHECK (true);

-- 読み取りは認証済みユーザーのみ（統計確認用）
CREATE POLICY "Allow authenticated read" ON update_requests
  FOR SELECT TO authenticated
  USING (true);
```

#### 3. 統計用のビューを作成（オプション）

```sql
-- 日別の集計ビュー
CREATE VIEW daily_update_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as request_count,
  COUNT(DISTINCT app_version) as unique_versions
FROM update_requests
WHERE app_id = 'space.riinswork.taskbar'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- バージョン別の集計ビュー
CREATE VIEW version_stats AS
SELECT
  app_version,
  platform,
  COUNT(*) as count,
  MAX(created_at) as last_seen
FROM update_requests
WHERE app_id = 'space.riinswork.taskbar'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY app_version, platform
ORDER BY count DESC;
```

### Supabase Functions（Edge Functions）の実装

#### supabase/functions/track-update/index.ts

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS プリフライトリクエスト対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { appId, version, platform, arch } = await req.json()

    // Supabase クライアントの作成
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // リクエストを記録
    const { error } = await supabase
      .from('update_requests')
      .insert([
        {
          app_id: appId,
          app_version: version,
          platform: platform,
          arch: arch,
          user_agent: req.headers.get('user-agent')
        }
      ])

    if (error) {
      throw error
    }

    // GitHub API から最新バージョン情報を取得（オプション）
    const githubResponse = await fetch(
      'https://api.github.com/repos/[OWNER]/[REPO]/releases/latest'
    )
    const latestRelease = await githubResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        currentVersion: version,
        latestVersion: latestRelease.tag_name,
        downloadUrl: latestRelease.assets[0]?.browser_download_url
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
```

#### Supabase Functions のデプロイ

```bash
# Supabase CLI のインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトにリンク
supabase link --project-ref [YOUR_PROJECT_REF]

# Functions をデプロイ
supabase functions deploy track-update
```

### クライアント側（src/main/funcs/update.ts）

```typescript
const SUPABASE_FUNCTION_URL = 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/track-update'

async function trackUpdateCheck(): Promise<void> {
  try {
    const response = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appId: 'space.riinswork.taskbar',
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('Update check tracked:', data)

    // 必要に応じて、サーバーからの最新バージョン情報を使用
    // この情報は autoUpdater の結果と併用できる
  } catch (error) {
    // 計測失敗はアップデート機能に影響させない
    // ネットワークエラーやサーバーダウンでもアプリは正常動作
    console.error('Failed to track update check:', error)
  }
}
```

### 統計データの取得方法

#### Supabase Dashboard で確認
1. Supabase Dashboard > Table Editor > update_requests
2. SQL Editor で集計クエリを実行

#### REST API で取得（認証済み）

```typescript
// 統計確認用のスクリプト例
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://[YOUR_PROJECT_REF].supabase.co',
  '[YOUR_SERVICE_ROLE_KEY]' // Service Role Key（管理用）
)

// 日別の統計を取得
const { data: dailyStats } = await supabase
  .from('daily_update_stats')
  .select('*')
  .limit(30)

// バージョン別の統計を取得
const { data: versionStats } = await supabase
  .from('version_stats')
  .select('*')

console.log('Daily stats:', dailyStats)
console.log('Version stats:', versionStats)
```

#### カスタム集計クエリ例

```sql
-- 過去7日間のリクエスト数
SELECT
  DATE(created_at) as date,
  COUNT(*) as requests
FROM update_requests
WHERE
  app_id = 'space.riinswork.taskbar'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- プラットフォーム別の分布
SELECT
  platform,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM update_requests
WHERE app_id = 'space.riinswork.taskbar'
GROUP BY platform
ORDER BY count DESC;

-- アクティブなバージョンの状況
SELECT
  app_version,
  COUNT(*) as users,
  MAX(created_at) as last_check
FROM update_requests
WHERE
  app_id = 'space.riinswork.taskbar'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY app_version
ORDER BY users DESC;
```

## 実装の段階的アプローチ

### フェーズ 1: 基本的なアップデート機能（優先度: 高）
1. electron-builder.yml に GitHub publish 設定を追加
2. src/main/funcs/update.ts を作成
3. src/main/main.ts にアップデートチェック処理を統合
4. 基本的なダイアログでアップデート通知を表示

**所要時間の見積もり**: このフェーズだけで基本的なアップデート機能は動作

### フェーズ 2: UI の改善（優先度: 中）
1. src/main/funcs/store.ts にアップデート設定を追加
2. src/main/funcs/events.ts にIPCハンドラー追加
3. src/renderer/ に設定UIを追加
4. preload でAPIを公開

### フェーズ 3: リクエスト計測機能（優先度: 中〜低）
1. Supabase プロジェクトのセットアップ
   - アカウント作成とプロジェクト作成
   - データベーステーブルの作成
   - Edge Functions の実装とデプロイ
2. src/main/funcs/update.ts に計測ロジック追加
   - Supabase Functions への POST リクエスト
   - エラーハンドリング
3. 統計ダッシュボードの作成（オプション）
   - Supabase Dashboard で確認
   - またはカスタム管理画面を構築

## セキュリティとプライバシーの考慮事項

### コード署名
- macOS: 既に公証設定済み（notarize.js）
- アップデートファイルも同様に署名・公証が必要
- electron-builder が自動的に処理

### HTTPS
- GitHub Releases は HTTPS で配信
- カスタム計測サーバーも HTTPS 必須

### プライバシー
- 計測データは最小限に（バージョン、OS、アーキテクチャ程度）
- IPアドレスは匿名化するか保存しない
- プライバシーポリシーに明記

### アップデートの検証
- electron-updater は自動的に署名を検証
- GitHub Releases の整合性チェック

## 技術的な注意事項

### macOS Gatekeeper
- アップデート後の初回起動時に Gatekeeper チェックあり
- 公証済みアプリであれば問題なし
- 現在の設定で対応済み（hardenedRuntime: true）

### 差分アップデート
- electron-updater は macOS で BlockMap による差分更新をサポート
- 大きなアップデートでも帯域幅を節約可能
- electron-builder が自動的に .blockmap ファイルを生成

### 開発時の動作
- 開発モードではアップデート機能を無効化
- `is.dev` チェックで本番環境のみ有効化
- テスト用に dev-app-update.yml を使用可能

### ロールバック
- electron-updater は自動ロールバック機能なし
- 必要に応じて手動でバージョン管理
- GitHub Releases で古いバージョンも保持

## テスト戦略

### ローカルテスト
1. `dev-app-update.yml` を作成してローカルサーバーでテスト
2. ビルドしたアプリで実際のアップデートフローを確認

### ベータテスト
1. GitHub Releases の pre-release 機能を使用
2. 少数のユーザーでテスト
3. 段階的ロールアウト

## 推奨実装計画

### 最小構成（すぐに実装可能）
1. **electron-builder.yml**: GitHub publish 設定追加
2. **src/main/funcs/update.ts**: 基本的なアップデートロジック
3. **src/main/main.ts**: 起動時チェックの統合
4. **ネイティブダイアログ**: 最小限のUI

この構成で、ユーザーはアップデート通知を受け取り、アップデートをインストールできる。

### フル機能構成
上記に加えて：
1. **設定UI**: ユーザーが自動アップデートを制御
2. **進捗表示**: ダウンロード進捗をリアルタイム表示
3. **計測サーバー**: リクエスト数の追跡と分析

## コスト見積もり

### GitHub Releases（配信）
- **コスト**: 無料（パブリックリポジトリ）
- **帯域幅**: 制限なし
- **ストレージ**: 制限なし（現実的な範囲で）

### Supabase（計測）

#### 無料プラン（Free Tier）
- **データベース**: PostgreSQL 500MB
- **API リクエスト**: 月間 500,000 リクエスト
- **Edge Functions**: 月間 500,000 実行
- **帯域幅**: 月間 5GB
- **ストレージ**: 1GB

**想定されるリクエスト数の試算:**
- 1,000 ユーザー × 1日1回チェック × 30日 = 月間 30,000 リクエスト
- 10,000 ユーザーでも月間 300,000 リクエスト
- **結論**: 無料枠で十分に収まる

#### Pro プラン（必要な場合のみ）
- **月額**: $25
- **データベース**: 8GB
- **API リクエスト**: 無制限
- **Edge Functions**: 月間 2,000,000 実行
- **帯域幅**: 月間 50GB
- **優先サポート**: あり

**月額総コスト**: 無料〜$25（ほとんどの場合無料で十分）

### まとめ
- **最小構成**: 完全無料（GitHub Releases + Supabase 無料枠）
- **スケールした場合**: $25/月（Supabase Pro）
- **運用負荷**: ほぼゼロ（サーバーレス）
- **メンテナンス**: 不要（マネージドサービス）

## まとめ

### 実装の容易さ
1. **基本的なアップデート機能**: 簡単（electron-updater の設定のみ）
2. **UI の改善**: 中程度（Vue.js での実装）
3. **計測機能（Supabase）**: 中程度（サーバーレスで比較的簡単）

### 推奨実装順序
1. **フェーズ1**: 基本的なアップデート機能（GitHub Releases + electron-updater）
   - すぐに実装可能で、即座に効果が得られる
   - ユーザーはアップデート通知を受け取れる

2. **フェーズ2**: UI の改善
   - ユーザーフィードバックを得ながら実装
   - 設定画面でアップデートを管理可能に

3. **フェーズ3**: リクエスト計測機能（Supabase）
   - 使用状況を把握したい場合に追加
   - 完全無料で実装可能

### 技術スタック（確定）
- **配信**: GitHub Releases（無料、信頼性高い）
- **アップデート**: electron-updater（既にインストール済み）
- **計測**: Supabase Functions + PostgreSQL（無料枠で十分）
- **統計**: Supabase Dashboard または SQL クエリ

### 最初の一歩
1. **electron-builder.yml** に GitHub publish 設定を追加
2. **src/main/funcs/update.ts** を作成して基本的なロジックを実装
3. **src/main/main.ts** にアップデートチェックを統合

これだけで基本的なアップデート機能が動作します。
