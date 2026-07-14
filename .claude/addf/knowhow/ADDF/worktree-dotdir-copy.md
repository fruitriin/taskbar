---
title: worktree への .claude 複製 — cp -r の「既存ディレクトリへの入れ子」罠
created: 2026-07-03
last_verified: 2026-07-03
depends_on:
  - .claude/commands/addf-speculate.md
status: active
---

# worktree への .claude 複製 — cp -r の「既存ディレクトリへの入れ子」罠

> 出典: 投機開発スキル（addf-speculate）フェーズ1 のコードレビュー（Critical 指摘）

## 発見した知見

### `cp -r src dst` は dst が既存ディレクトリだと「中に」コピーする

`.claude/` は git 管理下のファイルを含むため、`git worktree add` の時点で新 worktree 側に
`.claude/` が**既に存在する**。この状態で

```bash
cp -r .claude ../wt/.claude     # ❌ ../wt/.claude/.claude/ という入れ子ができるだけ
```

とすると、cp は「既存ディレクトリの中に同名ディレクトリを作る」動作をし、マージされない。
**エラーが出ず成功して見える**のが悪質で、複製したつもりのエージェントは `.exp.md` 等の
gitignore 対象ファイルを失った状態で作業を始めてしまう。正しくは:

```bash
cp -r .claude/. ../wt/.claude/  # ✅ 送り元末尾の /. で「中身をマージ」の意味になる
```

### worktree 複製の目的は「gitignore 対象ファイルの補完」

git 管理下のファイルは worktree add が持っていくので、複製で運ぶ必要があるのは
`.exp.md`（経験）・状態ファイル等の gitignore 対象だけ。「複製済みか」の確認は
git 管理下ファイルの存在では判定できない（worktree add 由来と区別がつかない）。
gitignore 対象の代表ファイル（例: `*.exp.md`）の有無で確認する。

### 検証は「成功して見える失敗」を再現してから直す

この罠は fake リポジトリで両形式を実行し、`<dst>/.claude/.claude` の有無と
`.exp.md` の到達を確認して確定した。手順書のシェルコマンドも、レビュー・修正時に
サンドボックスで実地再現するとすり抜けを防げる。

## 関連ノウハウ

- [オプトイン式スキルの退避＋有効化コピー設計](optional-skill-optin.md) — 「成功して見える失敗」を型検証で殺す同系の設計
- [同期 lint の設計](sync-lint-design.md) — サンドボックス再現テストの作法
