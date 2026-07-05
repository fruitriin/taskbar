---
title: 既存プロジェクトへの ADDF 導入パターン
created: 2026-03-21
last_verified: 2026-03-21
depends_on: []
status: active
---

# 既存プロジェクトへの ADDF 導入パターン

## 発見した知見

### 鶏と卵問題の解決

ADDF のスキル（`addf-init.md`）は `.claude/commands/` に配置されるが、既存プロジェクトにはこのファイルが存在しない。スキルがないのにスキルを実行できない。

**解決策: ブートストラッププロンプト + raw URL**

1. README にコピペ用プロンプトを記載
2. Claude が `raw.githubusercontent.com` 経由で `addf-init.md` を WebFetch
3. スキルの「外部起動セクション」を読み、ADDF リポジトリを tmp にクローン
4. tmp のファイル群を参照しながらプロジェクトにセットアップ

**重要**: GitHub の通常の Markdown プレビューは WebFetch で取得できない。raw URL（`raw.githubusercontent.com`）に誘導する必要がある。

### CLAUDE.md 退避戦略

既存プロジェクトに CLAUDE.md がある場合、ADDF の CLAUDE.md に置き換える必要がある。既存の指示は `CLAUDE.repo.md` に退避する。

1. 既存の `CLAUDE.md` と `AGENTS.md`（あれば）の両方を読む
2. 重複を統合し、プロジェクト固有の指示として `CLAUDE.repo.md` に退避
3. ADDF の `CLAUDE.md` テンプレートで置き換え（`@CLAUDE.repo.md` で退避先を自動参照）
4. 退避した `CLAUDE.repo.md` を `CLAUDE.repo.example.md` と比較して構造的不足をチェック
5. 不足があれば対話的に補完

### フレームワーク導入時の信頼モデル

ADDF はプラグインマーケットプレイスの「1スキルをインストール」とは根本的に異なる。CLAUDE.md でエージェントの振る舞い全体を支配し、hooks で任意コマンドを実行し、settings.json で権限を変更する。

導入前に以下を明示表示してユーザーの承認を得る必要がある:
- **hooks**: どのイベントで何が実行されるか
- **権限変更**: allow/ask に何が追加されるか
- **CLAUDE.md**: ブートシーケンスがどう変わるか

### 干渉チェックの3カテゴリ

| カテゴリ | 処理 | 例 |
|---|---|---|
| 無条件コピー | `addf-` プレフィックスで衝突リスクなし | commands/, agents/, hooks/ |
| インテリジェントマージ | 既存を保持しつつ ADDF エントリを追加 | settings.json, .gitignore, CLAUDE.md |
| プロジェクト固有生成 | ダウンストリーム体裁で新規作成 | CLAUDE.repo.md, TODO.md, Progress.md |

### .gitignore マーカーブロック

ADDF エントリを `# --- ADDF Framework ---` で囲むことで:
- `/addf-migrate` が ADDF エントリを自動更新できる
- ユーザーが ADDF エントリを識別しやすい
- プロジェクト固有のエントリと衝突しない

## プロジェクトへの適用

### 外部起動の判定

`addf-init.md` の Phase 1 で以下の4分岐を行う:
1. `addf-lock.json` あり → 導入済み
2. `addf-*.md` あり but lock なし → Template 経由の新規プロジェクト
3. `CLAUDE.md` or `.claude/` あり → 既存プロジェクト導入モード
4. 何もなし → 新規セットアップ

外部起動（WebFetch 経由）の場合は必ず「ADDF 利用プロジェクト」（ダウンストリーム）として扱う。

### 既存ファイルからの情報自動取得

既存プロジェクトの場合、対話ステップを最小化できる:
- `README.md` からプロジェクト名・目的
- `package.json` / `Cargo.toml` 等からビルド・テストコマンド
- git コミットログからコミット規約
- 推定結果を確認するだけで対話完了

## 注意点・制約

- WebFetch は GitHub の Markdown プレビュー（`github.com/.../blob/...`）を取得できない。`raw.githubusercontent.com` を使うこと
- 外部起動時の URL は `https://` のみ許可。`file://`, `ssh://`, `git://` は悪意あるリポジトリのリスクがある
- `CLAUDE.md` → `CLAUDE.repo.md` の退避時、既存の `@` メンション構文は ADDF の展開ルールと互換性があるか確認が必要
- ADDF はリポジトリ構成フレームワークであり、アプリケーションフレームワークを含まない。ただし、アプリケーションフレームワークが独自の CLAUDE.md / AGENTS.md を提供し始めた場合は干渉する可能性がある

## 参照

- `.claude/commands/addf-init.md` — 外部起動セクション、Phase 2.5 干渉チェック、Phase 2.7 導入前レビュー
- `docs/plans-add/0015-existing-project-install.md` — 設計計画
- `docs/knowhow/ADDF/upstream-downstream-separation.md` — 分離パターンの全体像
