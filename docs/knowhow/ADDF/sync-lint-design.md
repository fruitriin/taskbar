---
title: 同期 lint の設計 — 検出はツール、解釈と修復はエージェント
created: 2026-06-10
last_verified: 2026-07-03
depends_on:
  - .claude/addfTools/lint-template-sync.py
  - .claude/tests/tools/test-template-sync.sh
  - .claude/commands/addf-init.md
  - .claude/addfTools/sync-optional-skills.py
  - .claude/addfTools/speculate-guard.py
  - .claude/addfTools/lint-toml.py
status: active
---

# 同期 lint の設計 — 検出はツール、解釈と修復はエージェント

> 出典: Plan 0021（addf-lint テンプレート同期チェック）。同期忘れが3度再発した教訓の自動化

## 発見した知見

### 「意思で覚える」が3度敗北したら機械化する

同期が必要なファイルペア（CLAUDE.md ⇔ AGENTS.md 等）の手動同期は、Feedback.md に改善アクションとして記録しても3度再発した。チェック自体をエージェントの注意力（意思）に委ねると「忘れる・読み飛ばす・今回は大丈夫と判断する」という同じ失敗モードを lint の中に持ち込む。役割分担の原則:

- **検出 = 決定的スクリプト**: 忘れない・揺らがない・CI に乗る
- **解釈と修復 = エージェント**: どちらを正として同期するかは文脈判断（通常は新しい側が正だが、誤編集の巻き戻しもありうる）

スクリプトは WARNING に `git log -1 --format=%cs` の最終更新日ヒントを併記し、エージェントの判断材料を渡す。

### 構造比較より「正規化テキスト比較」— 実際のドリフトは内容差分

計画段階では「ステップ番号・見出しの構造対応」の検証を想定していたが、過去3度のドリフト（Plan 0016/0017/0019）は全て**既存ステップ内のサブ項目・文言の差分**であり、番号比較では捕捉できない。採用した方式:

1. 比較対象セクションを抽出（`## 見出し` から次の `## ` または水平線 `---` まで。コードブロック内は除外）
2. 意図的差分を吸収: ホワイトリスト行の除去 + パス正規化（`.addf.md` → `.md` 置換）
3. strip 済み非空行を `Counter` で相互比較（リスト線形検索は重複行を過小報告する）

言語が異なるペア（CLAUDE.md 日本語 ⇔ AGENTS.md 英語）はテキスト比較が不可能なため、そこだけ手順番号列（`1, 1.5, 1.6, 2..5`）の構造比較にフォールバックする。

### addfTools はダウンストリーム配布を前提に「欠如 = SKIP」で設計する

`.claude/addfTools/` はダウンストリームに配布される。ADDF 本体固有ファイル（`ProgressTemplate.addf.md`・`AGENTS.md` 等）をハードコード参照すると、ダウンストリームで必ず ERROR になる。設計ルール:

- ADDF 本体固有ファイルの欠如は **SKIP（exit 0 相当）** として扱う。欠如はドリフトではない
- 両環境に存在するファイルはフォールバックで対応する（例: テンプレートは `.addf.md` 版がなければ無印版を正とする）
- exit code は 3値: `0 = OK / 1 = ERROR / 2 = WARNING のみ`。テストとエージェントが重要度を区別できる

### 「欠如 = SKIP」は実行環境にも適用する — tomllib（3.11+）ガードの3類型

macOS システム python3 は 3.9.6 で `tomllib`（Python 3.11+ stdlib）が無く、素の `import tomllib` は Traceback で落ちる（2026-07-03、pull 後の整合確認で発見）。import ガードで受け、**スクリプトの責務ごとに exit code を選ぶ**:

| 責務 | 例 | tomllib 欠如時 |
|---|---|---|
| 受動的 lint / check | `lint-toml.py`・`sync-optional-skills.py`（check） | SKIP / exit 0（配布先で誤 ERROR を出さない） |
| 実行前ゲート | `speculate-guard.py` | ERROR / exit 1（検証できなければ許可しない — フェイルセーフ） |
| 変更系コマンド | `sync-optional-skills.py apply` | ERROR / exit 1（実行できていないのに成功を装わない） |

- 呼び出し側フォールバック（uv があれば `uv run --python 3.11`、なければ `python3` 直接実行）は**テストと手順書の両方に対称に**置く。テストだけに入れると、手順書を読む人間・エージェントが罠に落ちる非対称が生まれる（`test-optional-skills.sh` には有ったが後発の `test-speculate-guard.sh` に無かったドリフトが実例。パターンをコピーする側のファイルにこそドリフトが宿る）
- 手順書を `uv run --python 3.11` に統一するだけでは不十分 — **uv 自体が無い環境**では案内がシェルレベルの `command not found` になりガードに到達しない。手順書側に「uv が無ければ python3 直接実行」の注記をセットで置く（レビュー指摘で発見）
- 再現テストは PYTHONPATH シム（`raise ModuleNotFoundError("No module named 'tomllib'")` する偽 `tomllib.py`）で環境非依存に注入できる。sys.path で PYTHONPATH が stdlib より優先されることを利用した、ドリフト注入 TDD の変種
- **tomllib（標準ライブラリの世代差）だけでなく PEP 723 のサードパーティ依存（pyyaml 等）も同じ類型で扱う**。`uv run` は PEP 723 の `dependencies` を自動解決するが、`python3` 直接実行では解決されない — つまり uv と python3 は「Python バージョン」と「依存解決」の**2軸で非対称**。依存を宣言するスクリプトには同型の import ガード（lint なら SKIP）を置き、手順書のフォールバック注記には依存の入手方法（`pip install pyyaml`）まで書く（lint-frontmatter.py で投機サイクルのペルソナ並列レビュー3者が独立指摘した実例。「注記の根拠にした実例（tomllib 系）以外は検証していない」一般化が原因）

### 「ファイル⇔ファイル」だけでなく「参照⇔カバレッジ」もペア化できる（ペア5）

Plan 0022 で追加したペア5は、テキスト一致ではなく**参照の被覆**を検査する変種:

1. CLAUDE.md から `.claude/` 配下のファイル参照を抽出する（`@メンション` と バッククオート内パス。コードブロック内は例示の可能性があるため除外）
2. 各参照が addf-init のコピーリストでカバーされるか判定する。判定は4段:
   完全一致 → グロブ（`fnmatch`）→ ディレクトリ前方一致（末尾 `/` エントリ）→ .gitignore ADDF マーカーブロック（実行時生成ファイルはコピー対象外として正当）
3. 漏れ = 外部起動導入したダウンストリームでの参照切れ。WARNING（オーナー独自参照の可能性があるため ERROR にしない）

**正規表現の罠**: 本文に `.claude/`（ルート単体）というバッククオート表記があると、`[^\s`]*`（0文字許容）の抽出ではこれがエントリ化し、ディレクトリ前方一致で**全参照がカバー扱い**になる。`+` で1文字以上を強制して解決した。カバレッジ検査は「広すぎるエントリ1つで全検査が無効化する」失敗モードを持つ — 疑わしいときはドリフトを注入して RED になることを先に確認する（TDD）。

### 列挙の陳腐化は「列挙を持たない」設計で構造的に排除できる

addf-init の .gitignore マージ手順は、当初ブロック内容をハードコード列挙しており、本体 .gitignore の変更（`.claude/Dashboard.md` 追加等）に追従できず腐っていた。リストの鮮度を lint で守る前に、**そもそも列挙を持たず「クローン元（`<tmp>/addf-source/.gitignore`）の同ブロックをそのままコピーする」と指示する**ことでドリフトの発生源自体を消せた。同期ペアを増やす（機械化）より、単一ソース化（構造的排除）が上策。lint は単一ソース化できない箇所にだけ張る。

### lint のテストは mktemp サンドボックスにドリフトを注入する

実リポジトリを汚さずに異常系を検証するパターン:

```bash
box="$(mktemp -d)"
# 対象ファイルを相対レイアウトを保ってコピー
mkdir -p "$box/.claude/templates" "$box/docs/guides"
cp ... # 必要ファイル
# ドリフトを注入（行削除・番号書き換え・ファイル削除）
grep -v '^15\. コミットする' ... / sed 's/^4\. /44. /' ... / rm -f "$box/AGENTS.md"
(cd "$box" && python3 "$LINT")  # 相対パス前提のスクリプトは cwd を切り替えて実行
```

サンドボックスは git リポジトリ外になるため、git 呼び出しは `returncode != 0 → '不明'` のフォールバックが必要（`git log` はリポジトリ外でも例外を投げず exit 128 + 空出力になる）。副産物として、このテストがダウンストリーム環境（ADDF 固有ファイルなし）のシミュレーションにもなる。

## 関連ノウハウ

- [アップストリーム / ダウンストリーム分離パターン](upstream-downstream-separation.md) — `.addf.md` サフィックス等、本知見の SKIP 設計が前提とする分離規約
- [スキル設計パターン（Anthropic 社内知見ベース）](skill-design-patterns.md) — スクリプトを `.claude/addfTools/` に同梱する Progressive Disclosure 構成
- [Plan 着手前の実態突合](plan-status-drift-check.md) — ペア5（Plan 0022）の発端となった残差分切り出しの経緯
- [チェックリスト裏付け lint](checklist-backing-lint.md) — 本設計の直系。手順書の「確認」項目に実行チェック/human-judgment マーカーの裏付けを要求する
- [オプトイン式スキルの退避＋有効化コピー設計](optional-skill-optin.md) — SKIP 設計・列挙の陳腐化検査の応用先。gitignore 列挙との突き合わせで孤児コピーを検出する
