#!/bin/bash
# run-all.sh
# フック・ツールの自動テストを一括実行する。
# スキルテストは自然言語シナリオのため手動実行（.claude/tests/skills/ を参照）。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_PASS=0
TOTAL_FAIL=0

run_test() {
  local test_file="$1"
  local name="$(basename "$test_file")"
  echo ""
  echo "━━━ $name ━━━"
  if bash "$test_file"; then
    echo "→ $name: ALL PASSED"
  else
    echo "→ $name: SOME FAILED"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
}

echo "╔══════════════════════════════════════╗"
echo "║  ADDF Framework Test Runner          ║"
echo "╚══════════════════════════════════════╝"

# フックテスト
echo ""
echo "▶ Hook Tests"
for f in "$SCRIPT_DIR"/hooks/test-*.sh; do
  [ -f "$f" ] && run_test "$f"
done

# ツールテスト
echo ""
echo "▶ Tool Tests"
for f in "$SCRIPT_DIR"/tools/test-*.sh; do
  [ -f "$f" ] && run_test "$f"
done

# スキルテスト案内
echo ""
echo "▶ Skill Tests (manual)"
echo "  スキルテストは自然言語シナリオです。手動で実行してください:"
for f in "$SCRIPT_DIR"/skills/test-*.md; do
  [ -f "$f" ] && echo "  - $(basename "$f")"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$TOTAL_FAIL" -eq 0 ]; then
  echo "✓ All automated tests passed"
  exit 0
else
  echo "✗ $TOTAL_FAIL test suite(s) had failures"
  exit 1
fi
