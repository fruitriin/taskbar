---
name: addf-init
description: |
  ADDF プロジェクトの初期セットアップまたは構造検証を行う。
  新規プロジェクトで ADDF を導入するとき、またはプロジェクト構造の整合性を確認したいときに使う。
  引数なしで初期化、`check` で構造検証。
user_invocable: true
---

# ADDF Init — プロジェクト初期化 & 構造検証

## 外部からの起動（既存プロジェクトへの導入）

このスキルが WebFetch 経由で取得された場合、または tmp ディレクトリ内のクローンから読まれている場合:

1. **URL の検証とクローン**:
   - ユーザーが提供した URL、またはデフォルト `https://github.com/fruitriin/ADDF.git`
   - `https://` スキームのみ許可。`file://`, `ssh://`, `git://` は拒否して案内する
   - URL をユーザーに表示して確認: 「以下の URL からクローンします: <url>。続行しますか？」
   ```bash
   mktemp -d
   git clone --depth 1 <url> <tmp>/addf-source
   ```
2. 現在のワーキングディレクトリ（ユーザーのプロジェクト）を **導入先** とする
3. プロジェクト種別は **「ADDF 利用プロジェクト」（ダウンストリーム）に固定** する
4. **既存ファイルからプロジェクト情報を自動取得する**（対話ステップの省略）:
   - `README.md` からプロジェクト名・目的を読み取る
   - 既存の `CLAUDE.md` があればその内容を読み取り、後で `CLAUDE.repo.md` に退避する
   - `package.json`, `Cargo.toml`, `pyproject.toml` 等があればビルド・テストコマンドを推定する
   - 推定結果をユーザーに確認する（対話ではなく確認のみ） <!-- human-judgment -->
5. 以下の init モードの Phase 1 から続行する。Phase 3 のファイルコピー元は `<tmp>/addf-source`

---

## 引数

- **引数なし**: 初期セットアップ（init モード）
- `check`: 構造検証（check モード）

---

## init モード（引数なし）

### Phase 1: 状態確認

1. 既に ADDF 導入済みか判定する:
   - `.claude/addf-lock.json` が存在する → 「ADDF は導入済みです。`/addf-init check` で構造を検証できます」と案内して終了
   - `.claude/commands/addf-*.md` が存在するが `addf-lock.json` がない → **Template 経由の新規プロジェクト**（ADDF ファイルは同梱済み、ロックファイルのみ未生成）。Phase 2 に進む
   - `CLAUDE.md` または `.claude/` が存在するが ADDF ファイルがない → **既存プロジェクト導入モード**。「既存プロジェクトに ADDF を導入します。続行しますか？」と確認を求める <!-- human-judgment -->
   - どちらも存在しない → 初期セットアップを開始

### Phase 2: セットアップ情報の収集

**外部起動（既存プロジェクト）の場合:**

2. 既存ファイルからプロジェクト情報を自動取得する（対話を最小化）:
   - `README.md` からプロジェクト名・目的を読み取る
   - 既存の `CLAUDE.md` からプロジェクト固有の指示を読み取る（後で `CLAUDE.repo.md` に退避）
   - `package.json`, `Cargo.toml`, `pyproject.toml` 等からビルド・テストコマンドを推定する
   - git の既存コミットログからコミット規約を推定する
   - 推定結果をユーザーに確認する（対話ではなく確認のみ） <!-- human-judgment -->
   - プロジェクト種別は「ADDF 利用プロジェクト」に固定

**Template 経由（新規プロジェクト）の場合:**

2. ユーザーに以下を質問する（未回答はデフォルト値を使用）:

   **必須:**
   - プロジェクト名（デフォルト: リポジトリ名）
   - プロジェクト種別: `ADDF 利用プロジェクト`（デフォルト） / `ADDF 開発プロジェクト`

   **任意:**
   - ビルドコマンド（例: `npm run build`）
   - Lint コマンド（例: `npm run lint`）
   - テストコマンド（例: `npm test`）
   - コミットログ規約（デフォルト: 日本語 `[領域] 変更内容の要約`）
   - ターゲットエージェント: `Claude Code`（デフォルト） / `Codex` / `両方`

### Phase 2.5: 干渉チェック（既存プロジェクトの場合）

3. 既存プロジェクトのファイル・ディレクトリ構造を検査し、ADDF ファイルとの干渉を報告する:

   ```
   ╔══════════════════════════════════════════════╗
   ║  ADDF 干渉チェック                            ║
   ╚══════════════════════════════════════════════╝

   ■ 競合なし（そのままコピー）
     .claude/commands/     — 存在しない（新規作成）
     .claude/agents/       — 存在しない（新規作成）

   ■ マージが必要
     .gitignore            — 既存あり → ADDF エントリを追加
     .claude/settings.json — 既存あり → hooks/permissions をマージ

   ■ 要確認
     CLAUDE.md             — 既存あり → ADDF ブートシーケンスを先頭に挿入
     CONTRIBUTING.md       — 既存あり → 上書き or スキップを選択

   ■ 新規作成
     TODO.md, CLAUDE.repo.md, .claude/Progress.md, ...
   ```

   Template 経由の場合（ADDF ファイルが既に揃っている場合）はこの Phase をスキップ。

### Phase 2.7: 導入前レビュー（既存プロジェクトの場合）

4. ADDF が追加する hooks、権限変更、CLAUDE.md への影響を明示表示する:

   ```
   ADDF はプロジェクトの開発プロセス全体を規定するフレームワークです。
   以下の変更が行われます:

   ■ Hooks（セッション中に自動実行されるコマンド）
     + SessionStart: reset-turn-count.sh → ターンカウンターリセット
     + UserPromptSubmit: turn-reminder.sh → ターンリマインダー
     + PreToolUse (Skill): skill-usage-log.sh → スキル使用ログ

   ■ 権限変更（settings.json）
     allow に追加: Read, Edit, Write, Agent, Skill, Bash(git *), ...
     ask に追加: Bash(git push *), Bash(git reset --hard *), ...

   ■ CLAUDE.md
     + ブートシーケンス（Feedback → TODO → Progress 自動読み込み）
     + 開発プロセス定義（計画駆動、品質ゲート）

   続行しますか？
   ```

   ユーザーが拒否した場合は中断し、一時ディレクトリを削除。

### Phase 3: ファイルコピー & マージ

ADDF ファイルの配置元を決定する:
- **外部起動**: `<tmp>/addf-source` からコピー
- **Template 経由**: ADDF ファイルは既にプロジェクト内に存在（コピー不要）
- **既存ファイルは上書きしない**（存在する場合はスキップして通知）

#### カテゴリ1: 無条件コピー（外部起動の場合のみ）

衝突リスクなし（`addf-` プレフィックスで識別可能）:
- `.claude/commands/addf-*.md` — スキル定義
- `.claude/agents/addf-*.md` — エージェント定義
- `.claude/optional/` — オプトイン式スキル・エージェントの原本（GUI テスト等。有効化は `.claude/addfTools/sync-optional-skills.py apply`）
- `.claude/hooks/*.sh` — フック
- `.claude/templates/` — テンプレート
- `.claude/addfTools/` — ツール群
- `.claude/tests/` — テストスイート
- `.claude/addf-Behavior.toml`
- `.claude/ADDF-CHANGELOG.md`, `.claude/ADDF-Release.addf.md`
- `.claude/Questions.example.md`, `.claude/Dashboard.example.md` — CLAUDE.md が書式参照するため必須
- `CLAUDE.repo.example.md`, `CLAUDE.local.example.md`
- `AGENTS.md`
- `.claudeignore`
- `docs/knowhow/ADDF/`, `docs/knowhow/INDEX.addf.md`
- `docs/guides/`

#### カテゴリ2: インテリジェントマージ

- **`.claude/settings.json`**: 既存あり → ADDF の hooks と permissions をユニオン追加（既存を削除しない）。結果をユーザーに表示して確認 <!-- human-judgment -->。既存なし → ADDF テンプレートをコピー
- **`.gitignore`**: ADDF エントリをマーカーブロック付きで追加する。
  ブロックの内容は **ADDF リポジトリ（クローン元）の `.gitignore` マーカーブロックをそのままコピーする**（ここに列挙を持たない — リスト陳腐化の防止）。外部起動の場合のコピー元は `<tmp>/addf-source/.gitignore`:
  ```
  # --- ADDF Framework (do not remove) ---
  （クローン元 .gitignore の同ブロック内容）
  # --- /ADDF Framework ---
  ```
- **`CLAUDE.md`**: 既存なし → ADDF テンプレートをコピー。既存あり → 以下の手順で退避・補完する:
  1. 既存の `CLAUDE.md` と `AGENTS.md`（存在すれば）の両方を読み、プロジェクト固有の指示を把握する。重複する内容は統合し、最適な形で `CLAUDE.repo.md` に退避する（どちらのファイルに何が書かれているかは現場判断で整理）
  2. ADDF の `CLAUDE.md` テンプレートで置き換える（`@CLAUDE.repo.md` で退避先を自動参照）
  3. 退避した `CLAUDE.repo.md` を `CLAUDE.repo.example.md` と比較し、構造的不足をチェック:
     - プロジェクト種別セクション（「ADDF 利用プロジェクト」宣言）があるか
     - テストセクション（ビルド・Lint・テストコマンド）があるか
     - コミットログ規約があるか
  4. 不足があればユーザーに対話的に補完を求め、`CLAUDE.repo.md` に追記する
- **`CONTRIBUTING.md`**: 既存があればユーザーに確認（上書き / スキップ） <!-- human-judgment -->

#### カテゴリ3: プロジェクト固有ファイル（ダウンストリーム体裁で生成）

- **`CLAUDE.repo.md`** — `CLAUDE.repo.example.md` をベースに「ADDF 利用プロジェクト」として生成
  - プロジェクト名、ビルド・Lint・テストコマンド、コミットログ規約を反映
- **`CLAUDE.local.md`** — テンプレートからコピー
- **`.claude/addf-lock.json`** — ADDF クローン元の `ref` で生成
  - `ref` にはクローン元の lock の `ref`（`vX.Y.Z` タグ名）をそのまま記録する。クローン元の lock が旧形式（`commit` フィールド）の場合は `v<version>` タグ名に読み替える
  - `git remote get-url origin` でリポジトリ URL を取得（取得できない場合はユーザーに入力を求める）
  - このファイルは `/addf-migrate` がバージョン差分を算出する際のアンカーとして使用される
- **`TODO.md`** — 初期テンプレート
- **`docs/plans/`** — ディレクトリ作成
- **`docs/knowhow/INDEX.md`** — インデックス初期化
- **`.claude/Progress.md`** — `.claude/templates/ProgressTemplate.md` から生成（`ProgressTemplate.addf.md` は ADDF 本体用のため使わない）
- **`.claude/Feedback.md`** — 初期テンプレート
- **`.claude/Questions.md`** — `Questions.example.md` の書式説明を残して未回答・回答済みを空で生成（非同期質問箱。ブートシーケンス 1.5 が参照）

**Codex 対応**（ターゲットが Codex または両方の場合）:
- `AGENTS.md` がリポジトリに存在することを確認する（ADDF 同梱済み）: `test -f AGENTS.md`
- Codex 設定案内を表示

### Phase 4: 完了

5. 生成結果をレポートする:
    ```
    ╔══════════════════════════════════════╗
    ║  ADDF Setup Complete                 ║
    ╚══════════════════════════════════════╝

    コピー: 35 ファイル
    マージ: .gitignore, .claude/settings.json, CLAUDE.md
    生成:   CLAUDE.repo.md, TODO.md, Progress.md, ...
    スキップ: CONTRIBUTING.md（既存保持）

    次のステップ:
    1. CLAUDE.repo.md を確認・カスタマイズしてください
    2. docs/plans/ に計画ファイルを作成してください
    3. `/addf-dev` で開発を開始できます
    ```

6. 一時ディレクトリを削除する（外部起動の場合）

---

## check モード（`/addf-init check`）

<!-- checklist-lint: skip-section（このセクションはチェックの実装そのもの。手作業チェックのスクリプト化は残課題バックログ参照） -->

読み取り専用で副作用なし。プロジェクト構造の整合性を検証する。

### チェック項目

1. **必須ファイルの存在確認**:
   - `CLAUDE.md` — ブートシーケンス定義
   - `CLAUDE.repo.md` — プロジェクト固有設定
   - `TODO.md` — タスクバックログ
   - `.claude/Progress.md` — 進捗管理
   - `.claude/Feedback.md` — フィードバック記録
   - `.claude/Questions.md` — 非同期質問箱（無ければ WARNING、`Questions.example.md` から生成を案内）
   - `.claude/addf-lock.json` — バージョンロック
   - `.claude/settings.json` — 権限設定

2. **`CLAUDE.md` の `@` メンション解決**:
   - `CLAUDE.md` 内の `@ファイル名` パターンを抽出
   - 各参照先ファイルが実在するか確認
   - 解決できない参照があれば WARNING

3. **`TODO.md` と `docs/plans/` の整合性**:
   - TODO に記載された計画ファイルが `docs/plans/` に存在するか
   - `docs/plans/` にあるが TODO に未記載のファイルがないか

4. **`.claude/addf-lock.json` の妥当性**:
   - JSON として valid か
   - `version`, `ref`, `repository` フィールドが存在するか
   - `ref` が `v<version>` 形式のタグ名か（形式チェックのみ、リモート確認は行わない）
   - 旧形式（`ref` の代わりに `commit`）は WARNING とし、`/addf-migrate` 実行時に新形式へ移行される旨を案内する

5. **AGENTS.md の存在**（情報レベル）:
   - 存在すれば OK、なければ INFO（Codex 非対応として通知）

### レポート形式

```
╔══════════════════════════════════════╗
║  ADDF Structure Check                ║
╚══════════════════════════════════════╝

1. 必須ファイル        ✓ 7/7 存在
2. @ メンション解決    ✓ 全て解決可能
3. TODO ↔ plans 整合   ✓ 一致
4. addf-lock.json      ✓ 有効
5. AGENTS.md           ✓ 存在（Codex 対応）

結果: ✓ All checks passed
```

問題がある場合は `✗` と詳細・修正提案を表示する。

---

## 再生性（Idempotency）

- init モード: 既存ファイルは上書きしない（スキップして通知）
- check モード: 読み取り専用、副作用なし
- 何度実行しても安全

## 経験の活用
- 実行前に `addf-init.exp.md` が存在すれば読み、過去の経験を考慮する
- 実行後、新たな教訓があれば `addf-init.exp.md` に追記する
