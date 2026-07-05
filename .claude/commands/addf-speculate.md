---
name: addf-speculate
description: |
  アイドル時（着手可能なタスクがないとき）に、直交概念を git worktree で投機開発する。
  投機は speculative/ ブランチに隔離され、本流には自動マージされない。
  `addf-Behavior.toml` の `[speculation].enable = true` でオプトインした場合のみ動作する。
  /addf-dev がアイドルを検出したときに呼ばれるほか、手動で1サイクル実行してもよい。
user_invocable: true
---

# addf-speculate — アイドル時の worktree 投機開発（1サイクル）

TODO に着手可能なタスクがないとき、黙って止まる代わりに、独立した概念を worktree で投機開発して
オーナーがまとめてレビュー・取捨選択できる状態を作る。

## 手順

### 1. 発動ガード

```bash
uv run --python 3.11 .claude/addfTools/speculate-guard.py
```

uv が無い環境では `python3` で直接実行する（Python 3.11+ が必要。旧い Python では tomllib 欠如の ERROR となり投機は開始できない — フェイルセーフ）。

- `enable=false`（exit 0）→ **何もせず終了**し、「投機は無効（オプトインは addf-Behavior.toml の
  `[speculation].enable`）」と報告する
- exit 1（型不正等の ERROR）→ 投機せず、エラー内容をオーナーに報告する
- exit 2（上限到達 WARNING）→ 新規投機はせず、`.claude/Worktrees.md` に「上限で待機」を記録して終了する
- exit 0 かつ `enable=true` → 次へ（`slots` が今回起こせる worktree の残り枠）

### 1.5. モード確認（interactive のみ）

`CLAUDE.local.md` の `# ADDF モード`（`/addf-mode` が管理）を確認し、responsiveness が
`interactive` の場合は**投機開始前にオーナーへ一言確認する**（オーナーが目の前にいるため）。
`relaxed` / `unattended`（またはモード未設定）は確認なしで開始してよい。

### 2. 投機対象の選定

選定元の優先順位:

1. 既存の計画ファイルに記録済みの軽微な残課題（Low/Info 等。分解済み・独立性が高く・低リスク）
2. `.claude/Questions.md` の未回答質問の最有力解釈による投機
3. オーナー常設リクエスト（TODO 末尾等）から導出できる独立作業

ルール:

- **選定禁止**: オーナー指示待ちと明示された項目は投機対象にしない。**新規概念の発明は最終手段**
- **直交性の基準は「衝突ゼロ」ではなく「衝突してもエージェントが悩まず解決できる粒度か」**。
  触るファイル集合の重なりは目安であり、自明に解決できる衝突（独立セクションへの追記同士など）なら
  ナーバスにならず投機してよい。解決に悩むレベルの衝突が予想される組み合わせだけ避ける

### 3. worktree の起動

対象概念ごとに（`slots` の範囲内で）:

```bash
git worktree add ../<repo名>-spec-<concept> -b speculative/<concept>
cp -r .claude/. ../<repo名>-spec-<concept>/.claude/
```

- **`.claude` の複製は必須**。`.exp.md`（経験ファイル）等の .gitignore 対象ファイルは worktree に
  自動複製されないため、複製を欠くと投機側が経験・設定を失った状態で作業することになる
- **コピー元は必ず `.claude/.`（末尾 `/.`）と書くこと**。worktree 側には git 管理下の `.claude/` が
  既に存在するため、`cp -r .claude <dst>/.claude` と書くと既存ディレクトリの**中に**入れ子
  （`<dst>/.claude/.claude/`）を作るだけでマージされず、複製が成功したように見えて失敗する
- worktree 隔離下は判断閾値を1段下げてよい（失敗を捨てられるため。CLAUDE.md「迷ったときの作法」）

### 4. 実装と Stage 1

各 worktree 内で対象概念を実装し、**Stage 1（ビルド・Lint・テスト）を worktree 内で実行**する。

- テスト通過 → 状態「テスト通過」
- テスト失敗 → 一度は原因分析・修正を試み、それでも失敗するなら状態「テスト失敗」で打ち切る
  （投機は使い捨て。深追いしない）

### 5. Worktrees.md への記録

`.claude/Worktrees.md`（.gitignore 対象の実行時状態ファイル）に全投機を記録する。
**打ち切った投機も silent に消さず記録する**。

書式:

```markdown
# Worktrees（投機の進行状態）

| worktree パス | ブランチ | 対象概念（出典） | 状態 | 最終更新 |
|---|---|---|---|---|
| ../repo-spec-foo | speculative/foo | <出典と一行説明> | テスト通過 | YYYY-MM-DD HH:MM |
```

状態: `開発中` / `テスト通過` / `テスト失敗` / `衝突` / `統合済み` / `放棄` / `昇格済み` / `上限で待機` / `要再検証`

### 6. integration 統合（テスト通過の feature が1件以上あるとき）

テスト通過の feature（今サイクルの新規と、前サイクルから採否判断待ちで繰り越したものの両方）を
1本の integration ブランチに squash 統合し、動作確認を一括する:

```bash
python3 .claude/addfTools/speculate-integrate.py speculative/<concept1> speculative/<concept2> ...
```

スクリプトは `integration/loop-<日付>` ブランチを base（main）から**作り直し**（使い捨て・再生成可能）、
専用 worktree（`../<リポジトリ名>-integration`）の中だけで統合する。メインの作業ツリーには触れない。
なお integration worktree への `.claude` 複製は**不要**（feature worktree と違い実装作業の場ではなく、
Stage 2 の実行主体はメインツリー側のエージェントで、テスト一式も git 管理下にあるため）。

- exit 1（ERROR: base 不在・worktree の置き先が塞がっている・commit フック拒否等）→ 統合を中断し、
  エラー内容をオーナーに報告する（`commit_failed=` は差分の握り潰しを防ぐための ERROR — empty と混同しない）
- exit 0 / 2 → 以下の出力（key=value）を解釈して Worktrees.md へ反映する:

- `integrated=` — 統合成功。状態「統合済み」にして Stage 2 へ
- `conflicted=` — squash 時に衝突した feature（スクリプトが巻き戻し済み）。直交性の基準で判断する:
  - **悩まず解決できる衝突**（独立セクションへの追記同士など）→ `speculative/<concept>` ブランチ側で
    base を取り込んで解消し（昇格対象のブランチが常に自己完結するように、解消は必ず feature 側に置く）、
    スクリプトを再実行する
  - **解決に悩むレベルの衝突** → 状態「衝突」で integration から外し、残りでスクリプトを再実行する
    （integration は作り直しが正道）。silent に捨てず、Dashboard の「気になった点」で報告する
- `missing=` — ブランチが存在しない（Worktrees.md の記載と git 実体のずれ）。記録を突き合わせて訂正する
- `empty=` — base との差分が無い（既に本流へ取り込み済み等）。状態を確認して「昇格済み」等に訂正する

### 7. Stage 2 — integration 一括ゲート

integration worktree の中で一括の動作確認とレビューを行う（コストの大きい Stage 2 を N 回→1回に償却する）:

1. **相互作用テスト**: integration worktree 内でプロジェクトのテスト一式（Stage 1 と同じコマンド）を実行する。
   単体では通過した feature も、組み合わせて壊れることがある
   - 失敗したら原因 feature を特定し（feature を外して再統合すると二分探索できる）、
     該当 feature を状態「衝突」で外して integration を作り直す
2. **一括レビュー**: `addf-code-review-agent` を**ペルソナ並列（視点ずらしレビュー）**で起動する。
   起動前に `.claude/agents/addf-code-review-agent.md` を読み、ペルソナ定義と集約ルールに従うこと。
   レビュー対象は `git diff main...integration/loop-<日付>` の全差分
3. 指摘は **feature 単位に帰属**させて Worktrees.md に記録する。Critical/High は該当 feature の
   worktree で修正して Stage 1 からやり直す（ただし投機は使い捨て — 深追いするより
   状態「テスト失敗」で打ち切ってよい）

レビューまで終えたら integration worktree は削除してよい（`git worktree remove ../<リポジトリ名>-integration`）。
integration **ブランチ**は使い捨てのため origin へ push しない（次サイクルで作り直す）。

### 8. Dashboard への書き分け

unattended 自走（`dashboard_report: true`）では `.claude/Dashboard.md`（書式: `.claude/Dashboard.example.md`）に
結果を書き分ける。基準は「オーナーの採否判断の対象かどうか」:

- **「投機ブランチ（採否判断待ち）」**: integration の動作確認（手順7「Stage 2」）まで通過した feature のみ。
  前サイクルからの判断待ちも繰り越し再掲する
- **「気になった点」**: テスト失敗・衝突・上限待機。採否判断の対象ではないが、知らせる価値のある観察
  （silent に捨てない）

### 9. ブランチの退避（エフェメラル環境対策）

サイクル末に、各 `speculative/<concept>` ブランチを origin へ push する:

```bash
if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin speculative/<concept>
else
  echo "SKIP: remote なし（ローカル環境）"
fi
```

- remote が無い環境では SKIP してよい（欠如 = SKIP）。remote があるのに push が失敗した場合
  （認証・reject・ネットワーク断）は SKIP 扱いにせず、失敗として報告する
- コンテナ実行（Claude Code on the Web 等）ではセッション終了で worktree もローカルブランチも
  失われるため、**push が投機を残す唯一の手段**。省略しないこと

### 10. 完了処理

呼び出し元（/addf-dev）の完了処理に合流し、**Progress.md の日記に「投機サイクルを実行した
（対象概念・結果の一行）」を記録してコミットする**。Worktrees.md は gitignore だが、
サイクルが回った事実はこの日記経由でコミット履歴に残る。

投機の採否はオーナーの判断（Dashboard / PR レビュー等）。**エージェントが speculative/ ブランチを
本流へ自動マージする経路は存在しない**。

## 現バージョンの範囲

このスキルは現在「投機と一括ゲート」（選定→worktree→Stage 1→integration 統合→Stage 2→
Dashboard 書き分け→push）までを提供する。クラッシュ後の git 実体からの再構築・worktree の掃除
（`clean` サブコマンド）・main への昇格手順は将来バージョンで追加予定。
なお昇格（`speculative/<concept>` → main の squash マージ）は**常にオーナー承認必須**であり、
手順が未提供の現在も、エージェントが本流へ自動マージする経路は存在しない。

## 経験の活用

- 実行前に `addf-speculate.exp.md` が存在すれば読み、過去の経験（選定判断・直交性の見積もり精度等）を考慮する
- 実行後、新たな教訓があれば `addf-speculate.exp.md` に追記する
