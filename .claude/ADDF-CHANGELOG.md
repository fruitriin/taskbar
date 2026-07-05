# ADDF Changelog

ADDF フレームワークの変更履歴。`/addf-migrate` 実行時に該当バージョン間のエントリを表示する。

## [0.4.0] - 2026-07-03

### 追加
- worktree 投機開発（`/addf-speculate`）— アイドル時に直交概念を `speculative/` ブランチで投機し、integration ブランチで一括動作確認する2層モデル（Plan 0028 フェーズ1・2）
  - `speculate-guard.py` — `[speculation]` enable・上限の発動ガード（オプトイン式・デフォルト無効）
  - `speculate-integrate.py` — integration ブランチへの squash 統合。衝突 feature のスキップ報告・commit フック拒否の検出（`commit_failed`）・メイン作業ツリー不可侵
  - Stage 2 一括ゲート（integration 上の相互作用テスト＋ペルソナ並列レビュー）と Dashboard 書き分け
- オプショナルスキルのオプトイン機構 — GUI スキル一式を `.claude/optional/` に退避し、`[gui-test] enable` + `sync-optional-skills.py apply` で有効化コピーを配置（Plan 0029 フェーズ1）
- チェックリスト裏付け lint（`lint-checklist.py`）— 手順書の「確認」項目に実行チェックか human-judgment マーカーの裏付けを要求（Plan 0027）
- 旧 Python 環境ガード — tomllib（Python 3.11+）・PEP 723 依存（pyyaml）を使うスクリプトに責務別 import ガード（lint = SKIP / 実行前ゲート = フェイルセーフ ERROR / 変更系 = ERROR）
- 再現テスト群 — `test-lint-toml` / `test-lint-frontmatter` / `test-speculate-guard` / `test-speculate-integrate` / `test-optional-skills`（PYTHONPATH シム・commit フック注入によるドリフト注入 TDD）

### 変更
- Python スクリプトの呼び出しを `uv run --python 3.11` に統一し、uv 不在環境向けの `python3` 直接実行フォールバック注記を手順書（addf-lint / addf-migrate / addf-speculate / docs/guides）に併記
- GUI テストシナリオ（test-addf-clip-image / test-addf-annotate-grid）にオプトイン前提の注記を追加
- 非 macOS 環境ではバイナリ実行テストを SKIP（Plan 0029）

### 修正
- macOS システム python3（3.9）で tomllib 依存スクリプトが未捕捉の Traceback で落ちる罠を修正
- `lint-frontmatter.py` の pyyaml 欠如時の未捕捉クラッシュを SKIP ガード化（ペルソナ並列レビューの3者独立指摘による検出）

## [0.3.0] - 2026-06-29

### 追加
- 「迷ったときの作法（7割共有原則）」— 3軸（信頼性・応答性・完成イメージ確度）でエージェントの進む/止まる/問うを制御（Plan 0016）
- 代替わり日記（Progress 日記）— compaction・resume・loop 継続での「小さな代替わり」に備える引き継ぎ書式（Plan 0017）
- knowhow ライフサイクル管理 — 鮮度タグ・`/addf-knowhow-revise`・`/addf-knowhow-network` による知見の経年管理（Plan 0018）
- 分かれ道の目印（`.exp.md` 🔀セクション）— 差し戻し・やり直しの経験を道標として記録（Plan 0019）
- 視点ずらしレビュー（ペルソナ並列）— `addf-code-review-agent` に5つのペルソナを追加し、マイルストーン時に並列起動（Plan 0020）
- テンプレート同期 lint（`lint-template-sync.py`）— 6ペアの同期チェックを自動化（Plan 0021, 0022, 0024）
- turn-reminder の関心事分離 — ターンカウンターとコンテキスト量リマインダーを独立スクリプトに分割（Plan 0023）
- 実測ベース能動コンパクション促し — `context-reminder.py` でトークン量を実測し、閾値超過時に促す（Plan 0023）
- `/addf-overview` スキル — エコシステム概要の提供
- コンパクション復帰フック — コンパクション後のブートシーケンス再開を自動化
- プロジェクト初回の骨格プランニングフロー — ブートシーケンス Step 4 でヒアリング→計画生成を自動化
- `CLAUDE.repo.md` 自動生成 — 骨格プランニング時にプロジェクト固有設定を生成
- ノウハウ記録の3観点（コーディング・品質ゲート・タスク総括）を ProgressTemplate に明文化
- `.claude/Questions.md` — 非同期質問箱（relaxed/unattended モード用）
- `.claude/Dashboard.md` — unattended 自走時の差分まとめ

### 変更
- リポジトリ URL を `fruitriin/ADDF` に変更（Plan 0025）
- README にロゴバナーを追加
- 代替わり日記の「同僚」表現を「同僚でもあり、寝て起きたあとの自分でもある」に改善

### 修正
- `addf-init` コピーリストの鮮度回復と同期 lint ペア5の追加（Plan 0022）
- Questions.md の運用フロー整備

## [0.2.0] - 2026-03-21

### 追加
- `/addf-init` スキル — プロジェクト初期セットアップ・構造検証・既存プロジェクトへの導入
- `/addf-release` スキル — リリース自動化（upstream/downstream 自動判定）
- `/addf-migrate` にスキルリネーム時の `.exp.md` 手動リネーム案内を追加
- `ADDF-Release.addf.md` — ADDF 本体のリリース手順定義
- `AGENTS.md` — Codex 向けブートシーケンス
- `docs/guides/codex-setup.md` — Codex ユーザー向けセットアップガイド
- 経験ファイルテンプレート（`ExperienceTemplate.md`）と主要3スキルの初期経験
- スキル使用計測フック（`skill-usage-log.sh` / PreToolUse）
- `docs/guides/` にドキュメント分離（setup, skills, agents, development-process, migration）
- 既存プロジェクトへの ADDF 導入（WebFetch → tmp クローン → 干渉チェック → 導入前レビュー）
- `.gitignore` マーカーブロック形式（`addf-migrate` での自動更新対応）

### 変更
- `/addf-dev-loop` → `/addf-dev` にリネーム（1タスク実施が基本、`/loop` で繰り返し）
- 全スキルの description にトリガー条件（「〜のとき使う」）を追加
- README をリポジトリ構成フレームワークとして再構成（対応エージェント表、既存プロジェクト導入手順）
- `addf-lint` の frontmatter チェックで `.exp.md` を除外

### 修正
- `addf-migrate` の対象リストに `settings.json`, `AGENTS.md`, `ADDF-Release.addf.md`, `docs/guides/` を追加
- `skill-usage-log.sh` の JSONL インジェクション対策（jq でエントリ全体を生成）
- `addf-init` / `addf-migrate` に URL 検証ステップを追加（`https://` のみ許可）

## [0.1.0] - 2026-03-20

### 追加
- `addf-lock.json` — バージョン追跡用ロックファイル
- `/addf-migrate` スキル — ADDF のアップグレードを安全に実行する6フェーズのマイグレーション
- `ADDF-CHANGELOG.md` — フレームワーク変更履歴（本ファイル）
- `settings.json` に `git clone`, `git -C`, `mktemp` 権限を追加

### 初期リリース内容
- ブートシーケンス（CLAUDE.md）による自動コンテキスト読み込み
- ノウハウ管理（`/addf-knowhow`, `/addf-knowhow-index`, `/addf-knowhow-filter`）
- 自律開発（`/addf-dev`、旧 `/addf-dev-loop`）
- 品質ゲート（`addf-code-review-agent`, `addf-security-review-agent`, `addf-contribution-agent`）
- GUI テスト（`/addf-gui-test`, `/addf-annotate-grid`, `/addf-clip-image`）— macOS オプション
- 経験ファイル検証（`/addf-experience`）
- フレームワーク整合性チェック（`/addf-lint`）
- 権限監査（`/addf-permission-audit`）
- ターンカウンターフック（SessionStart / UserPromptSubmit）
