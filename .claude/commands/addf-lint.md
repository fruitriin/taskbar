---
name: addf-lint
description: |
  ADDF フレームワークの整合性をチェックする。settings.json 構文・hooks 実行権限・
  スキル frontmatter・Behavior.toml・knowhow INDEX 整合・テンプレート同期を検証する。
  品質ゲート前、CI、設定変更後に使う。
context: fork
user_invocable: true
---

# ADDF Lint — フレームワーク整合性チェック

以下のチェックを順番に実行し、結果をまとめて報告する。
全チェック通過時は `✓ All checks passed` を表示する。
問題がある場合は項目ごとに `✗` と詳細を表示する。

> **注**: 本スキルの lint コマンドは `uv run --python 3.11` を前提とする
> （PEP 723 のサードパーティ依存も自動解決される）。
> uv が無い環境では `python3` で直接実行できるが、tomllib を使う lint（セクション4・10）は
> Python 3.11+ が必要（旧い Python では SKIP 案内を出す）、Frontmatter チェック（セクション3）は
> `pip install pyyaml` が必要（無ければ SKIP 案内を出す）。
> SKIP は環境起因で検査できなかったことを示す（✗ = 問題検出ではない）。

## 1. JSON 構文チェック

```bash
uv run --python 3.11 .claude/addfTools/lint-json.py
```

## 2. Hooks 実行権限チェック

`.claude/hooks/` 内の `*.sh` ファイルが実行権限を持っているか確認する:

```bash
uv run --python 3.11 .claude/addfTools/lint-hooks-exec.py
```

exit code: 0 = 全て実行可能 / 2 = WARNING（実行権限なし。`chmod +x` で付与する）。
`.claude/hooks/` が無い場合は SKIP される。

## 3. スキル Frontmatter チェック

`.claude/commands/addf-*.md` の全ファイルについて frontmatter の存在と必須フィールド（name, description）を検証する。

```bash
uv run --python 3.11 .claude/addfTools/lint-frontmatter.py
```

## 4. addf-Behavior.toml 構文チェック

```bash
uv run --python 3.11 .claude/addfTools/lint-toml.py
```

## 5. Knowhow INDEX 整合性チェック

`docs/knowhow/INDEX.addf.md`（ADDF 本体の場合）または `docs/knowhow/INDEX.md`（ダウンストリームの場合）を対象に:
- INDEX に記載されているがファイルが存在しないエントリを検出
- `docs/knowhow/` 配下に存在するが INDEX に記載されていない `.md` ファイルを検出
- INDEX ファイル自身（INDEX.md, INDEX.addf.md）と `CLAUDE.md`（読み方の作法）は除外する

INDEX ファイルからリンクを抽出するには、テーブル行の `[パス](パス)` パターンをパースする。

## 6. テンプレート同期チェック

同期が必要な6つのファイルペアのドリフトを検出する:

| ペア | 検証内容 | 重要度 |
|---|---|---|
| 1. `.claude/templates/ProgressTemplate.addf.md` ⇔ `.claude/Progress.md` | 運用ルールのテキスト包含 | ERROR |
| 2. `.claude/templates/ProgressTemplate.addf.md` ⇔ `.claude/templates/ProgressTemplate.md` | 運用ルールの正規化比較（意図的差分はホワイトリスト済み） | WARNING |
| 3. `CLAUDE.md` ⇔ `AGENTS.md` | ブートシーケンス手順番号の対応 | WARNING |
| 4. `CLAUDE.md` ⇔ `docs/guides/development-process.md` | ブートシーケンス概要の手順番号の対応 | WARNING |
| 5. `CLAUDE.md` ⇔ `.claude/commands/addf-init.md` コピーリスト | 参照ファイルのカバレッジ（.gitignore ADDF ブロック含む） | WARNING |
| 6. TODO（`TODO.md` / `docs/plans-add/TODO.addf.md`）⇔ Plan の `## 実装状況:` ヘッダ | 状態の矛盾・参照切れ・登録漏れ・表記ゆれヘッダ（`## 状態:` 等）。ヘッダ無し Plan は対象外 | WARNING |

※ lint にペアを追加・変更したら、この表とスクリプト docstring も同時に更新する。

```bash
uv run --python 3.11 .claude/addfTools/lint-template-sync.py
```

exit code: 0 = 全一致 / 1 = ERROR / 2 = WARNING のみ。
ダウンストリームプロジェクトでは ADDF 本体固有ファイル（`.addf.md` 版・`AGENTS.md` 等）が存在しないペアは SKIP され、ペア1は `ProgressTemplate.md` を正として比較する。
WARNING には git log による最終更新日ヒントが併記される。**どちらを正として同期するかはエージェントが文脈で判断する**（通常は新しい側が正だが、誤編集の巻き戻しもありうる）。修正後は再実行して確認する。

## 7. Knowhow 鮮度チェック

`docs/knowhow/` 配下の各 `.md` ファイル（INDEX と CLAUDE.md を除く）について:
- フロントマター（`last_verified`・`status`）の有無を確認。なければ WARNING
- 🔴 stale のファイル（しきい値・判定基準は `addf-knowhow-index.md` の定義に従う）を列挙し、`/addf-knowhow-revise` を案内する
- `depends_on` に存在しないファイル・スキルが含まれていれば WARNING

鮮度低下は WARNING 止まり（エラーにしない）。再検証の判断はエージェント・オーナーに委ねる。

## 8. Knowhow 双方向リンクチェック

`docs/knowhow/` 配下の各 knowhow の「## 関連ノウハウ」セクションのリンクについて:
- リンク先ファイルが存在するか確認。なければ WARNING
- A→B のリンクに対し B→A が存在するか確認。欠落していれば INFO として列挙し、`/addf-knowhow-network` を案内する
- 「## 関連ノウハウ」セクション自体がないファイルはチェック対象外（ネットワーク化は任意）

## 9. チェックリスト裏付け検査

手順書（`ADDF-Release.addf.md` / `addf-init.md` / `addf-migrate.md` / `ProgressTemplate` 系）の
「確認/検証」ステップに裏付け（実行可能チェックまたは `<!-- human-judgment -->` マーカー）が
あるかを点検する:

```bash
uv run --python 3.11 .claude/addfTools/lint-checklist.py
```

exit code: 0 = 裏付けあり / 2 = WARNING（ERROR 級はこの lint には無い）。
WARNING はエージェントの確認漏れではなく**手順書側の点検**: A型（機械検証可能）なら
実行コマンドを添え、B型（人間判断）ならマーカーを付け、アサーションが書けない項目は
構造上通らない可能性があるので手順書の設計を見直す。
チェックの実装そのもの・解説文のセクションは `<!-- checklist-lint: skip-section -->` で除外できる。
対象ファイルが無い場合（ダウンストリーム）は SKIP される。

## 10. オプショナルスキル同期チェック

`.claude/optional/`（オプトイン式スキル・エージェントの原本）と発見パスの有効化コピーが
`addf-Behavior.toml` の `[gui-test] enable` と整合しているかを検査する:

```bash
uv run --python 3.11 .claude/addfTools/sync-optional-skills.py
```

exit code: 0 = 整合 / 1 = ERROR（`enable` が真偽値でない等の設定不正） /
2 = WARNING（未配置・撤去漏れ・原本との差分・gitignore 列挙漏れ・原本を失った孤児コピー）。
解消は `sync-optional-skills.py apply`（原本と異なる有効化コピーは apply でも削除・上書きされない —
直接編集は原本に対して行う）。`.claude/optional/` または Behavior.toml が無い場合、
Behavior.toml が構文エラーの場合（セクション4の責務）は SKIP される。

## 結果報告

全チェックの結果を以下の形式でまとめる:

```
╔══════════════════════════════════════╗
║  ADDF Lint Results                   ║
╚══════════════════════════════════════╝

1. JSON 構文          ✓ / ✗
2. Hooks 実行権限     ✓ / ✗
3. Frontmatter        ✓ / ✗
4. Behavior.toml      ✓ / ✗
5. INDEX 整合性       ✓ / ✗
6. テンプレート同期   ✓ / ⚠ / ✗
7. Knowhow 鮮度       ✓ / ⚠
8. Knowhow リンク     ✓ / ⚠
9. チェックリスト裏付け ✓ / ⚠
10. オプショナルスキル同期 ✓ / ⚠
```
