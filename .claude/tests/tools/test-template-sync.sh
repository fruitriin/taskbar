#!/bin/bash
# test-template-sync.sh
# lint-template-sync.py の同期チェックテスト。
# 実リポジトリでの正常系と、サンドボックスでの意図的ドリフト検出を検証する。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LINT="$PROJECT_DIR/.claude/addfTools/lint-template-sync.py"
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

make_sandbox() {
  local box
  box="$(mktemp -d)"
  mkdir -p "$box/.claude/templates" "$box/.claude/commands" "$box/docs/guides"
  cp "$PROJECT_DIR/CLAUDE.md" "$PROJECT_DIR/AGENTS.md" "$PROJECT_DIR/.gitignore" "$box/"
  cp "$PROJECT_DIR/.claude/Progress.md" "$box/.claude/"
  cp "$PROJECT_DIR/.claude/templates/ProgressTemplate.addf.md" \
     "$PROJECT_DIR/.claude/templates/ProgressTemplate.md" "$box/.claude/templates/"
  cp "$PROJECT_DIR/.claude/commands/addf-init.md" "$box/.claude/commands/"
  cp "$PROJECT_DIR/docs/guides/development-process.md" "$box/docs/guides/"
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

# テスト 2: ProgressTemplate.md のステップ欠落 → WARNING (exit=2)
echo "Test 2: ダウンストリーム版テンプレートのステップ欠落"
box="$(make_sandbox)"
grep -v '^15\. コミットする' "$box/.claude/templates/ProgressTemplate.md" > "$box/tmp" \
  && mv "$box/tmp" "$box/.claude/templates/ProgressTemplate.md"
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
echo "Test 4: Progress.md の運用ルール乖離"
box="$(make_sandbox)"
grep -v '^15\. コミットする' "$box/.claude/Progress.md" > "$box/tmp" \
  && mv "$box/tmp" "$box/.claude/Progress.md"
output=$(run_lint "$box")
assert_exit "運用ルール乖離で ERROR" 1 $?
assert_contains "ペア1の ERROR" "[1] ERROR" "$output"
rm -rf "$box"

# テスト 5: development-process.md の手順追加ドリフト → WARNING (exit=2)
echo "Test 5: development-process.md の手順ドリフト"
box="$(make_sandbox)"
sed -i.bak 's/^4\. TODO に未完了タスクがない場合/44. TODO に未完了タスクがない場合/' \
  "$box/docs/guides/development-process.md" && rm -f "$box/docs/guides/development-process.md.bak"
output=$(run_lint "$box")
assert_exit "手順ドリフトで WARNING" 2 $?
assert_contains "ペア4の WARNING" "[4] WARNING" "$output"
rm -rf "$box"

# テスト 6: ダウンストリーム環境（ADDF 本体固有ファイルなし）→ ペア2〜4 SKIP で exit=0
# addf-init.md と .gitignore は配布対象のため存在する想定（ペア5は SKIP せず実行され OK になる）
echo "Test 6: ダウンストリーム環境シミュレーション"
box="$(make_sandbox)"
rm -f "$box/.claude/templates/ProgressTemplate.addf.md" "$box/AGENTS.md"
rm -rf "$box/docs/guides"
# Progress.md をダウンストリーム版テンプレート由来の内容に変換する
sed -i.bak -e 's/ProgressTemplate\.addf\.md/ProgressTemplate.md/g' \
  -e '/ADD フレームワークテスト/d' "$box/.claude/Progress.md" && rm -f "$box/.claude/Progress.md.bak"
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

# テスト 9: .gitignore 欠如 → 実行時生成ファイル（.claude/Dashboard.md）がカバー不能で WARNING
# addf-init 実行後の環境では .gitignore ADDF ブロックが必ず存在するため定常運用では発生しない。
# 発生時は「未整備」を伝える早期警告として妥当 — その仕様をここで固定化する
echo "Test 9: .gitignore 欠如時のカバー漏れ検出"
box="$(make_sandbox)"
rm -f "$box/.gitignore"
output=$(run_lint "$box")
assert_exit ".gitignore 欠如で WARNING" 2 $?
assert_contains "Dashboard.md の UNCOVERED" "UNCOVERED: .claude/Dashboard.md" "$output"
rm -rf "$box"

# ペア6用サンドボックス: TODO.addf.md と Plan ファイルの最小セットを作る
make_plans_sandbox() {
  local box
  box="$(make_sandbox)"
  mkdir -p "$box/docs/plans-add"
  cat > "$box/docs/plans-add/0001-sample.md" <<'EOF'
# Plan: サンプル

## 実装状況: 完了（2026-06-11）

本文
EOF
  cat > "$box/docs/plans-add/TODO.addf.md" <<'EOF'
# TODO (ADDF)

| 優先度 | Phase | 計画ファイル | 状態 |
|---|---|---|---|
| 1 | 1 | `docs/plans-add/0001-sample.md` | 完了 |
EOF
  echo "$box"
}

# テスト 10: TODO「未着手」⇔ Plan ヘッダ「完了」の矛盾 → ペア6 WARNING (exit=2)
echo "Test 10: TODO⇔Plan 状態の矛盾検出"
box="$(make_plans_sandbox)"
sed -i.bak 's/| 完了 |/| 未着手 |/' "$box/docs/plans-add/TODO.addf.md" \
  && rm -f "$box/docs/plans-add/TODO.addf.md.bak"
output=$(run_lint "$box")
assert_exit "状態矛盾で WARNING" 2 $?
assert_contains "ペア6の WARNING" "[6] WARNING" "$output"
assert_contains "矛盾の特定" "矛盾: docs/plans-add/0001-sample.md" "$output"
rm -rf "$box"

# テスト 11: TODO 登録漏れと参照切れ → ペア6 WARNING (exit=2)
echo "Test 11: TODO 登録漏れ・参照切れの検出"
box="$(make_plans_sandbox)"
cat > "$box/docs/plans-add/0002-unlisted.md" <<'EOF'
# Plan: 登録漏れサンプル

## 実装状況: 未着手
EOF
printf '| 2 | 2 | `docs/plans-add/0003-ghost.md` | 未着手 |\n' >> "$box/docs/plans-add/TODO.addf.md"
output=$(run_lint "$box")
assert_exit "登録漏れで WARNING" 2 $?
assert_contains "登録漏れの特定" "登録漏れ: docs/plans-add/0002-unlisted.md" "$output"
assert_contains "参照切れの特定" "不在: docs/plans-add/TODO.addf.md が参照する docs/plans-add/0003-ghost.md" "$output"
rm -rf "$box"

# テスト 12: 実装状況ヘッダの無い Plan は検査対象外（信用ベース・旧 Plan 互換）→ exit=0
# あわせて TODO が無い環境（make_sandbox のまま）で SKIP になることも確認する
# 注: テスト1と同じく実リポジトリのコピーが前提。exit≠0 ならペア6ではなく実ファイルのドリフトを疑う
echo "Test 12: ヘッダ無し Plan のスキップと TODO 不在の SKIP"
box="$(make_plans_sandbox)"
printf '# Plan: ヘッダ無し旧式\n\n本文のみ\n' > "$box/docs/plans-add/0001-sample.md"
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
printf '# Plan: 表記ゆれ\n\n## 状態: 未着手\n\n本文\n' > "$box/docs/plans-add/0001-sample.md"
output=$(run_lint "$box")
assert_exit "表記ゆれで WARNING" 2 $?
assert_contains "表記ゆれの特定" "表記ゆれ: docs/plans-add/0001-sample.md" "$output"
rm -rf "$box"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
