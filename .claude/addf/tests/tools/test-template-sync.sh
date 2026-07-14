#!/bin/bash
# test-template-sync.sh
# lint-template-sync.py の同期チェックテスト。
# 実リポジトリでの正常系と、サンドボックスでの意図的ドリフト検出を検証する。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
LINT="$PROJECT_DIR/.claude/addf/addfTools/lint-template-sync.py"
PASS=0
FAIL=0

if command -v uv >/dev/null 2>&1; then
  run_lint() { (cd "$1" && uv run --python 3.11 "$LINT" 2>&1); }
else
  run_lint() { (cd "$1" && python3 "$LINT" 2>&1); }
fi

assert_exit() {
  local test_name="$1" expected_exit="$2" actual_exit="$3"
  if [ "$actual_exit" -eq "$expected_exit" ]; then
    echo "  PASS: $test_name (exit=$actual_exit)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $test_name (expected exit=$expected_exit, got=$actual_exit)"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local test_name="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  PASS: $test_name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $test_name (output missing: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local test_name="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  FAIL: $test_name (output unexpectedly contains: $needle)"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS: $test_name"
    PASS=$((PASS + 1))
  fi
}

make_sandbox() {
  local box
  box="$(mktemp -d)"
  mkdir -p "$box/.claude/addf/templates" "$box/.claude/commands" "$box/.claude/addf/guides"
  cp "$PROJECT_DIR/CLAUDE.md" "$PROJECT_DIR/AGENTS.md" "$PROJECT_DIR/.gitignore" "$box/"
  cp "$PROJECT_DIR/README.md" "$PROJECT_DIR/README.en.md" "$box/"
  cp "$PROJECT_DIR/.claude/addf/Progress.md" "$box/.claude/addf/"
  cp "$PROJECT_DIR/.claude/addf/templates/ProgressTemplate.addf.md" \
     "$PROJECT_DIR/.claude/addf/templates/ProgressTemplate.md" "$box/.claude/addf/templates/"
  cp "$PROJECT_DIR/.claude/commands/addf-init.md" "$box/.claude/commands/"
  cp "$PROJECT_DIR"/.claude/commands/addf-*.md "$box/.claude/commands/"
  cp "$PROJECT_DIR/.claude/addf/guides/development-process.md" "$box/.claude/addf/guides/"
  echo "$box"
}

echo "=== test-template-sync.sh ==="

# テスト 1: 実リポジトリで全ペア同期済み（意図的差分が誤検出されないことの確認を兼ねる）
# 前提: ADDF 本体リポジトリでの実行を想定（ダウンストリームでは AGENTS.md 等が SKIP され
# 結果が環境の状態に依存する）。リポジトリがクリーンに同期された状態であること。
# ここが FAIL したらテストではなく実ファイルのドリフトを疑い、lint の出力に従って同期する
echo "Test 1: 実リポジトリで OK"
output=$(run_lint "$PROJECT_DIR")
assert_exit "実リポジトリ" 0 $?
assert_contains "OK メッセージ" "OK: 同期チェック通過" "$output"
# 本体（upstream 宣言あり）で pair1〜3 が SKIP されないこと（宣言優先の設計を固定。
# 誤って downstream 判定に裏返ると SKIP 表示が出るため、ここで検出できる）
assert_not_contains "ペア1が SKIP されない" "[1] SKIP" "$output"
assert_not_contains "ペア2が SKIP されない" "[2] SKIP" "$output"
assert_not_contains "ペア3が SKIP されない" "[3] SKIP" "$output"

# テスト 2: ProgressTemplate.md のステップ欠落 → WARNING (exit=2)
echo "Test 2: ダウンストリーム版テンプレートのステップ欠落"
box="$(make_sandbox)"
grep -v '^15\. コミットする' "$box/.claude/addf/templates/ProgressTemplate.md" > "$box/tmp" \
  && mv "$box/tmp" "$box/.claude/addf/templates/ProgressTemplate.md"
output=$(run_lint "$box")
assert_exit "ステップ欠落で WARNING" 2 $?
assert_contains "ペア2の WARNING" "[2] WARNING" "$output"
assert_contains "欠落行の特定" "ADDF版のみ: 15. コミットする" "$output"
assert_contains "git ヒント" "ヒント(最終更新)" "$output"
rm -rf "$box"

# テスト 3: AGENTS.md のブートシーケンス手順欠落 → WARNING (exit=2)
echo "Test 3: AGENTS.md の手順欠落"
box="$(make_sandbox)"
sed -i.bak 's/^5\. /- /' "$box/AGENTS.md" && rm -f "$box/AGENTS.md.bak"
output=$(run_lint "$box")
assert_exit "手順欠落で WARNING" 2 $?
assert_contains "ペア3の WARNING" "[3] WARNING" "$output"
rm -rf "$box"

# テスト 4: Progress.md の運用ルール乖離 → ERROR (exit=1)
# 判定不能（シグナル無し）だと WARNING に格下げされるため、upstream 宣言を明示して
# ADDF 本体相当の環境をシミュレートする（格下げ側の検証はテスト 19）
echo "Test 4: Progress.md の運用ルール乖離"
box="$(make_sandbox)"
printf '# CLAUDE.repo.md\n\nこのリポジトリは **ADDF 開発プロジェクト**（フレームワーク本体）です。\n' \
  > "$box/CLAUDE.repo.md"
grep -v '^15\. コミットする' "$box/.claude/addf/Progress.md" > "$box/tmp" \
  && mv "$box/tmp" "$box/.claude/addf/Progress.md"
output=$(run_lint "$box")
assert_exit "運用ルール乖離で ERROR" 1 $?
assert_contains "ペア1の ERROR" "[1] ERROR" "$output"
rm -rf "$box"

# テスト 4b: Progress.md の `## タスク` 以降だけ変更しても ペア1 は誤検知しない
#         （Plan 0046 で明文化した境界: タスク欄は同期対象外・運用ルール節のみ検査）
echo "Test 4b: `## タスク` 以降の変更でペア1が誤検知しない"
box="$(make_sandbox)"
printf '# CLAUDE.repo.md\n\nこのリポジトリは **ADDF 開発プロジェクト**（フレームワーク本体）です。\n' \
  > "$box/CLAUDE.repo.md"
# タスク欄に日記・チェックリストを追記（運用ルール節は無変更）
cat >> "$box/.claude/addf/Progress.md" <<'PATCH'

### 現在のタスク: サンドボックスタスク

#### サブタスクチェックリスト
- [x] 何かを実装した
- [ ] まだやってないこと

#### 日記

##### 2026-07-07 — 委譲境界テスト
**やったこと**: タスク欄だけ追加してペア1 が誤検知しないことを確かめる
**今の見立て**: 誤検知しないはず
**次の自分へ**: なし
**気になっていること**: なし
PATCH
output=$(run_lint "$box")
assert_exit "タスク欄の変更でペア1 は OK" 0 $?
assert_not_contains "ペア1 の ERROR は出ない" "[1] ERROR" "$output"
assert_not_contains "ペア1 の WARNING も出ない" "[1] WARNING" "$output"
rm -rf "$box"

# テスト 5: development-process.md の手順追加ドリフト → WARNING (exit=2)
echo "Test 5: development-process.md の手順ドリフト"
box="$(make_sandbox)"
sed -i.bak 's/^4\. TODO に未完了タスクがない場合/44. TODO に未完了タスクがない場合/' \
  "$box/.claude/addf/guides/development-process.md" && rm -f "$box/.claude/addf/guides/development-process.md.bak"
output=$(run_lint "$box")
assert_exit "手順ドリフトで WARNING" 2 $?
assert_contains "ペア4の WARNING" "[4] WARNING" "$output"
rm -rf "$box"

# テスト 6: ダウンストリーム環境（ADDF 本体固有ファイルなし）→ ペア2〜4 SKIP で exit=0
# addf-init.md と .gitignore は配布対象のため存在する想定（ペア5は SKIP せず実行され OK になる）
echo "Test 6: ダウンストリーム環境シミュレーション"
box="$(make_sandbox)"
rm -f "$box/.claude/addf/templates/ProgressTemplate.addf.md" "$box/AGENTS.md"
rm -rf "$box/.claude/addf/guides"
# Progress.md をダウンストリーム版テンプレート由来の内容に変換する
sed -i.bak -e 's/ProgressTemplate\.addf\.md/ProgressTemplate.md/g' \
  -e '/ADD フレームワークテスト/d' "$box/.claude/addf/Progress.md" && rm -f "$box/.claude/addf/Progress.md.bak"
output=$(run_lint "$box")
assert_exit "ダウンストリームで OK" 0 $?
assert_contains "ペア2の SKIP" "[2] SKIP" "$output"
assert_contains "ペア3の SKIP" "[3] SKIP" "$output"
assert_contains "ペア4の SKIP" "[4] SKIP" "$output"
rm -rf "$box"

# テスト 7: CLAUDE.md に未カバーの .claude/ 参照を注入 → ペア5 WARNING (exit=2)
echo "Test 7: addf-init コピーリストのカバー漏れ検出"
box="$(make_sandbox)"
printf '\n通知の書式は `.claude/NewFeature.example.md` を参照\n' >> "$box/CLAUDE.md"
output=$(run_lint "$box")
assert_exit "カバー漏れで WARNING" 2 $?
assert_contains "ペア5の WARNING" "[5] WARNING" "$output"
assert_contains "漏れファイルの特定" "UNCOVERED: .claude/NewFeature.example.md" "$output"
rm -rf "$box"

# テスト 8: addf-init.md 欠如 → ペア5 SKIP で exit=0
# （欠如時はカバー漏れがあっても検査されない。テスト7の検出はaddf-init.md の存在が前提）
echo "Test 8: addf-init.md 欠如時の SKIP"
box="$(make_sandbox)"
rm -f "$box/.claude/commands/addf-init.md"
output=$(run_lint "$box")
assert_exit "addf-init 欠如で OK" 0 $?
assert_contains "ペア5の SKIP" "[5] SKIP" "$output"
rm -rf "$box"

# テスト 9: .gitignore 欠如 → 実行時生成ファイル（.claude/addf/Dashboard.md）がカバー不能で WARNING
# addf-init 実行後の環境では .gitignore ADDF ブロックが必ず存在するため定常運用では発生しない。
# 発生時は「未整備」を伝える早期警告として妥当 — その仕様をここで固定化する
echo "Test 9: .gitignore 欠如時のカバー漏れ検出"
box="$(make_sandbox)"
rm -f "$box/.gitignore"
output=$(run_lint "$box")
assert_exit ".gitignore 欠如で WARNING" 2 $?
assert_contains "Dashboard.md の UNCOVERED" "UNCOVERED: .claude/addf/Dashboard.md" "$output"
rm -rf "$box"

# ペア6用サンドボックス: TODO.addf.md と Plan ファイルの最小セットを作る
make_plans_sandbox() {
  local box
  box="$(make_sandbox)"
  mkdir -p "$box/.claude/addf/plans-add"
  cat > "$box/.claude/addf/plans-add/0001-sample.md" <<'EOF'
# Plan: サンプル

## 実装状況: 完了（2026-06-11）

本文
EOF
  cat > "$box/.claude/addf/plans-add/TODO.addf.md" <<'EOF'
# TODO (ADDF)

| 優先度 | Phase | 計画ファイル | 状態 |
|---|---|---|---|
| 1 | 1 | `.claude/addf/plans-add/0001-sample.md` | 完了 |
EOF
  echo "$box"
}

# テスト 10: TODO「未着手」⇔ Plan ヘッダ「完了」の矛盾 → ペア6 WARNING (exit=2)
echo "Test 10: TODO⇔Plan 状態の矛盾検出"
box="$(make_plans_sandbox)"
sed -i.bak 's/| 完了 |/| 未着手 |/' "$box/.claude/addf/plans-add/TODO.addf.md" \
  && rm -f "$box/.claude/addf/plans-add/TODO.addf.md.bak"
output=$(run_lint "$box")
assert_exit "状態矛盾で WARNING" 2 $?
assert_contains "ペア6の WARNING" "[6] WARNING" "$output"
assert_contains "矛盾の特定" "矛盾: .claude/addf/plans-add/0001-sample.md" "$output"
rm -rf "$box"

# テスト 11: TODO 登録漏れと参照切れ → ペア6 WARNING (exit=2)
echo "Test 11: TODO 登録漏れ・参照切れの検出"
box="$(make_plans_sandbox)"
cat > "$box/.claude/addf/plans-add/0002-unlisted.md" <<'EOF'
# Plan: 登録漏れサンプル

## 実装状況: 未着手
EOF
printf '| 2 | 2 | `.claude/addf/plans-add/0003-ghost.md` | 未着手 |\n' >> "$box/.claude/addf/plans-add/TODO.addf.md"
output=$(run_lint "$box")
assert_exit "登録漏れで WARNING" 2 $?
assert_contains "登録漏れの特定" "登録漏れ: .claude/addf/plans-add/0002-unlisted.md" "$output"
assert_contains "参照切れの特定" "不在: .claude/addf/plans-add/TODO.addf.md が参照する .claude/addf/plans-add/0003-ghost.md" "$output"
rm -rf "$box"

# テスト 12: 実装状況ヘッダの無い Plan は検査対象外（信用ベース・旧 Plan 互換）→ exit=0
# あわせて TODO が無い環境（make_sandbox のまま）で SKIP になることも確認する
# 注: テスト1と同じく実リポジトリのコピーが前提。exit≠0 ならペア6ではなく実ファイルのドリフトを疑う
echo "Test 12: ヘッダ無し Plan のスキップと TODO 不在の SKIP"
box="$(make_plans_sandbox)"
printf '# Plan: ヘッダ無し旧式\n\n本文のみ\n' > "$box/.claude/addf/plans-add/0001-sample.md"
output=$(run_lint "$box")
assert_exit "ヘッダ無しで OK" 0 $?
rm -rf "$box"
box="$(make_sandbox)"
output=$(run_lint "$box")
assert_contains "TODO 不在で SKIP" "[6] SKIP" "$output"
rm -rf "$box"

# テスト 13: `## 状態:` 等の表記ゆれヘッダ → WARNING (exit=2)
# 実装状況ヘッダの表記ゆれは「状態を書いているのに検査から漏れる」穴になる（Plan 0025 で顕在化）
echo "Test 13: 表記ゆれヘッダの検出"
box="$(make_plans_sandbox)"
printf '# Plan: 表記ゆれ\n\n## 状態: 未着手\n\n本文\n' > "$box/.claude/addf/plans-add/0001-sample.md"
output=$(run_lint "$box")
assert_exit "表記ゆれで WARNING" 2 $?
assert_contains "表記ゆれの特定" "表記ゆれ: .claude/addf/plans-add/0001-sample.md" "$output"
rm -rf "$box"

# テスト 14: addf-lock.json ありのダウンストリーム構成（Plan 0033 回帰）
# 配布・持ち込みで `.addf.md` が物理存在し、独自 AGENTS.md（ADDF ブートシーケンス
# 見出しなし）を持つケース。存在ベース判定なら「ADDF 本体」と誤認してペア1 ERROR・
# ペア3 ERROR になるが、lock を所有シグナルとして扱えば誤検知せず exit=0 になる
echo "Test 14: addf-lock.json ありダウンストリームで .addf.md / 独自 AGENTS.md が存在しても誤検知しない"
box="$(make_sandbox)"
cat > "$box/.claude/addf/lock.json" <<'EOF'
{
  "version": "0.4.0",
  "ref": "v0.4.0",
  "repository": "https://github.com/fruitriin/ADDF.git"
}
EOF
printf '# AGENTS.md\n\nダウンストリーム独自のエージェント規約。ADDF のブートシーケンス見出しは持たない。\n' > "$box/AGENTS.md"
# Progress.md はダウンストリーム版テンプレート（ProgressTemplate.md）由来の内容にする
sed -i.bak -e 's/ProgressTemplate\.addf\.md/ProgressTemplate.md/g' \
  -e '/ADD フレームワークテスト/d' "$box/.claude/addf/Progress.md" && rm -f "$box/.claude/addf/Progress.md.bak"
output=$(run_lint "$box")
assert_exit "ダウンストリーム構成で誤検知しない" 0 $?
assert_contains "ペア2の SKIP（.addf.md 物理存在でも比較しない）" "[2] SKIP" "$output"
assert_contains "ペア3の SKIP（独自 AGENTS.md を検査しない）" "[3] SKIP" "$output"
rm -rf "$box"

# テスト 15: CLAUDE.repo.md の種別宣言（一次根拠）だけでもダウンストリームと判定される
# lock なし・宣言のみのケース。コードブロック外の「ADDF 利用プロジェクト」宣言を読む
echo "Test 15: CLAUDE.repo.md の種別宣言によるダウンストリーム判定"
box="$(make_sandbox)"
printf '# CLAUDE.repo.md\n\nこのリポジトリは **ADDF 利用プロジェクト** です。\n' > "$box/CLAUDE.repo.md"
printf '# AGENTS.md\n\n独自規約のみ。\n' > "$box/AGENTS.md"
sed -i.bak -e 's/ProgressTemplate\.addf\.md/ProgressTemplate.md/g' \
  -e '/ADD フレームワークテスト/d' "$box/.claude/addf/Progress.md" && rm -f "$box/.claude/addf/Progress.md.bak"
output=$(run_lint "$box")
assert_exit "種別宣言でダウンストリーム判定" 0 $?
assert_contains "ペア3の SKIP" "[3] SKIP" "$output"
rm -rf "$box"

# テスト 16: 欺く入力 — 否定文「ADDF 開発プロジェクトではありません」だけの CLAUDE.repo.md
# ＋ lock あり。部分文字列判定なら upstream に誤爆するが、太字マーカー込みの厳密一致なら
# 地の文にマッチせず lock フォールバックで downstream 判定になる（Plan 0033 レビュー回帰）
echo "Test 16: 否定文の種別言及に誤爆せず lock で downstream 判定"
box="$(make_sandbox)"
printf '# CLAUDE.repo.md\n\nこのリポジトリは ADDF 開発プロジェクトではありません。\n' > "$box/CLAUDE.repo.md"
printf '{ "version": "0.4.0", "ref": "v0.4.0", "repository": "https://github.com/fruitriin/ADDF.git" }\n' \
  > "$box/.claude/addf/lock.json"
printf '# AGENTS.md\n\n独自規約のみ。\n' > "$box/AGENTS.md"
sed -i.bak -e 's/ProgressTemplate\.addf\.md/ProgressTemplate.md/g' \
  -e '/ADD フレームワークテスト/d' "$box/.claude/addf/Progress.md" && rm -f "$box/.claude/addf/Progress.md.bak"
output=$(run_lint "$box")
assert_exit "否定文で誤爆しない" 0 $?
assert_contains "ペア3の SKIP（downstream 判定）" "[3] SKIP" "$output"
rm -rf "$box"

# テスト 17: 混在文 — upstream/downstream 両方の太字宣言が地の文にある ＋ lock あり。
# 無条件 upstream 優先なら誤爆するが、両ヒットは判定不能（安全側）として
# lock フォールバック経由で downstream になる
echo "Test 17: 両宣言の混在は判定不能として lock フォールバックで downstream"
box="$(make_sandbox)"
printf '# CLAUDE.repo.md\n\nかつて **ADDF 開発プロジェクト** として始まったが、現在は **ADDF 利用プロジェクト** です。\n' \
  > "$box/CLAUDE.repo.md"
printf '{ "version": "0.4.0", "ref": "v0.4.0", "repository": "https://github.com/fruitriin/ADDF.git" }\n' \
  > "$box/.claude/addf/lock.json"
printf '# AGENTS.md\n\n独自規約のみ。\n' > "$box/AGENTS.md"
sed -i.bak -e 's/ProgressTemplate\.addf\.md/ProgressTemplate.md/g' \
  -e '/ADD フレームワークテスト/d' "$box/.claude/addf/Progress.md" && rm -f "$box/.claude/addf/Progress.md.bak"
output=$(run_lint "$box")
assert_exit "混在文で upstream 優先しない" 0 $?
assert_contains "ペア3の SKIP（downstream 判定）" "[3] SKIP" "$output"
rm -rf "$box"

# テスト 18: ~~~ フェンス内の upstream 文言は宣言として扱わない（``` のみ対応だった穴の回帰）。
# 地の文の太字 downstream 宣言だけが有効で、lock なしでも downstream 判定になる
echo "Test 18: ~~~ フェンス内の upstream 文言を除外して downstream 判定"
box="$(make_sandbox)"
cat > "$box/CLAUDE.repo.md" <<'EOF'
# CLAUDE.repo.md

このリポジトリは **ADDF 利用プロジェクト** です。

~~~
このリポジトリは **ADDF 開発プロジェクト**（フレームワーク本体）です。
~~~
EOF
printf '# AGENTS.md\n\n独自規約のみ。\n' > "$box/AGENTS.md"
sed -i.bak -e 's/ProgressTemplate\.addf\.md/ProgressTemplate.md/g' \
  -e '/ADD フレームワークテスト/d' "$box/.claude/addf/Progress.md" && rm -f "$box/.claude/addf/Progress.md.bak"
output=$(run_lint "$box")
assert_exit "~~~ フェンスを除外して downstream 判定" 0 $?
assert_contains "ペア3の SKIP（downstream 判定）" "[3] SKIP" "$output"
rm -rf "$box"

# テスト 19: シグナル無し（宣言なし・lock なし = 旧配布ダウンストリーム相当）＋ .addf.md 残置
# ＋独自 AGENTS.md。判定不能を upstream と同一視すると pair1/pair3 が ERROR(1) になるが、
# 格下げ後は WARNING(2) で、種別宣言/lock の整備を促すメッセージが出る
echo "Test 19: シグナル無し環境では ERROR ではなく WARNING ＋整備の促し"
box="$(make_sandbox)"
printf '# AGENTS.md\n\n独自規約のみ。\n' > "$box/AGENTS.md"
sed -i.bak -e 's/ProgressTemplate\.addf\.md/ProgressTemplate.md/g' \
  -e '/ADD フレームワークテスト/d' "$box/.claude/addf/Progress.md" && rm -f "$box/.claude/addf/Progress.md.bak"
output=$(run_lint "$box")
assert_exit "判定不能は WARNING 止まり" 2 $?
assert_contains "ペア1の WARNING 格下げ" "[1] WARNING" "$output"
assert_contains "ペア3の WARNING 格下げ" "[3] WARNING" "$output"
assert_not_contains "ペア1が ERROR にならない" "[1] ERROR" "$output"
assert_not_contains "ペア3が ERROR にならない" "[3] ERROR" "$output"
assert_contains "整備の促しメッセージ" ".claude/addf/lock.json を配置する" "$output"
rm -rf "$box"

# テスト 20: @メンションのパストラバーサル注入（Plan 0043 項目4）
# CLAUDE.repo.md に `@../../etc/passwd`・`@/etc/passwd`・シンボリックリンク経由の脱出を
# 仕掛けたとき、いずれも silent に無視される（宣言としてカウントされない）ことを確認する
echo "Test 20: @メンションのパストラバーサル耐性"
box="$(make_sandbox)"
# 外部ファイル（ADDF 利用プロジェクト宣言を含む）を box の外に配置
extern_dir="$(mktemp -d)"
printf 'このリポジトリは **ADDF 利用プロジェクト** です。\n' > "$extern_dir/leak.md"
# 相対パス .. で外部を参照
printf '# CLAUDE.repo.md\n\n@../%s/leak.md\n' "$(basename "$extern_dir")" > "$box/CLAUDE.repo.md"
# lock なし + 有効な種別宣言も無し → 判定不能で WARNING（脱出が成功していれば downstream 判定になり
# ペア3 SKIP で exit=0 になるため、WARNING/exit=2 を確認すれば脱出失敗の証拠になる）
output=$(run_lint "$box")
# 脱出できていれば宣言が読み取れて判定できるが、ガードが効いていれば宣言不能
assert_not_contains "パストラバーサルで downstream 判定できない" "[1] SKIP: repo_kind=downstream" "$output"
rm -rf "$box" "$extern_dir"

# 絶対パス指定でも同様に silent に無視
echo "Test 20b: @メンションの絶対パス指定を silent に無視"
box="$(make_sandbox)"
extern_dir="$(mktemp -d)"
printf 'このリポジトリは **ADDF 利用プロジェクト** です。\n' > "$extern_dir/leak.md"
printf '# CLAUDE.repo.md\n\n@%s/leak.md\n' "$extern_dir" > "$box/CLAUDE.repo.md"
output=$(run_lint "$box")
assert_not_contains "絶対パスで downstream 判定できない" "[1] SKIP: repo_kind=downstream" "$output"
rm -rf "$box" "$extern_dir"

# シンボリックリンクで box 外を指すファイルへの @メンションも無視される
echo "Test 20c: @メンションのシンボリックリンク脱出を silent に無視"
box="$(make_sandbox)"
extern_dir="$(mktemp -d)"
printf 'このリポジトリは **ADDF 利用プロジェクト** です。\n' > "$extern_dir/leak.md"
ln -sf "$extern_dir/leak.md" "$box/link.md"
printf '# CLAUDE.repo.md\n\n@link.md\n' > "$box/CLAUDE.repo.md"
output=$(run_lint "$box")
assert_not_contains "シンボリックリンク脱出で downstream 判定できない" "[1] SKIP: repo_kind=downstream" "$output"
rm -rf "$box" "$extern_dir"

# テスト 21: 新設スキルが README に未掲載 → ペア8 WARNING（upstream 宣言下）
echo "Test 21: 新設スキルの README 掲載漏れ検出"
box="$(make_sandbox)"
printf '# CLAUDE.repo.md\n\nこのリポジトリは **ADDF 開発プロジェクト**（フレームワーク本体）です。\n' \
  > "$box/CLAUDE.repo.md"
printf -- '---\nname: addf-dummy-skill\n---\n\n# ダミースキル\n' > "$box/.claude/commands/addf-dummy-skill.md"
output=$(run_lint "$box")
assert_exit "未掲載スキルで WARNING" 2 $?
assert_contains "ペア8の WARNING" "[8] WARNING" "$output"
assert_contains "未掲載スキル名の特定" "MISSING: addf-dummy-skill" "$output"
rm -rf "$box"

# テスト 22: README から既存スキルの掲載を削除 → ペア8 WARNING（両 README とも検査対象）
echo "Test 22: README からの既存スキル掲載削除を検出"
box="$(make_sandbox)"
printf '# CLAUDE.repo.md\n\nこのリポジトリは **ADDF 開発プロジェクト**（フレームワーク本体）です。\n' \
  > "$box/CLAUDE.repo.md"
sed -i.bak '/\*\*addf-plan-audit\*\*/d' "$box/README.md" && rm -f "$box/README.md.bak"
output=$(run_lint "$box")
assert_exit "掲載削除で WARNING" 2 $?
assert_contains "ペア8の WARNING（README.md）" "[8] WARNING: README.md" "$output"
assert_contains "削除したスキル名の特定" "MISSING: addf-plan-audit" "$output"
rm -rf "$box"

# テスト 23: downstream 判定では ペア8 が SKIP される（独自 README のため対象外）
echo "Test 23: downstream 判定でペア8が SKIP される"
box="$(make_sandbox)"
printf '# CLAUDE.repo.md\n\nこのリポジトリは **ADDF 利用プロジェクト** です。\n' > "$box/CLAUDE.repo.md"
printf -- '---\nname: addf-dummy-skill\n---\n\n# ダミースキル\n' > "$box/.claude/commands/addf-dummy-skill.md"
output=$(run_lint "$box")
assert_contains "ペア8の SKIP（downstream）" "[8] SKIP" "$output"
assert_not_contains "downstream では未掲載スキルを検出しない" "[8] WARNING" "$output"
rm -rf "$box"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
