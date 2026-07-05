#!/bin/bash
# test-speculate-integrate.sh
# speculate-integrate.py の統合ふるまいを mktemp サンドボックスで検証する。
# fake git リポジトリに speculative/ ブランチ群を作り、
# 「2 feature の統合成功」「片方衝突時の記録と integration 再生成」を機械検証する（Plan 0028 フェーズ2）。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTEGRATE="$(cd "$SCRIPT_DIR/../.." && pwd)/addfTools/speculate-integrate.py"
PASS=0
FAIL=0

check() {
  local desc="$1" expected_exit="$2" actual_exit="$3" output="$4" expected_grep="${5:-}"
  if [ "$actual_exit" -ne "$expected_exit" ]; then
    echo "  FAIL: $desc (exit: expected=$expected_exit actual=$actual_exit)"
    echo "$output" | sed 's/^/    | /'
    FAIL=$((FAIL + 1))
    return
  fi
  if [ -n "$expected_grep" ] && ! grep -q "$expected_grep" <<<"$output"; then
    echo "  FAIL: $desc (出力に '$expected_grep' が見つからない)"
    echo "$output" | sed 's/^/    | /'
    FAIL=$((FAIL + 1))
    return
  fi
  echo "  PASS: $desc"
  PASS=$((PASS + 1))
}

assert() {
  local desc="$1"; shift
  if "$@"; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

# サンドボックス: fake git リポジトリ（integration worktree は repo の隣に作られるため
# サンドボックス直下に repo/ を掘る）
box="$(mktemp -d)"
trap 'rm -rf "$box"' EXIT
repo="$box/repo"
mkdir -p "$repo"
g() { git -C "$repo" -c user.name=t -c user.email=t@t "$@"; }
(
  cd "$repo"
  git init -q -b main .
  printf 'line1\n' > shared.txt
  git -c user.name=t -c user.email=t@t add shared.txt
  git -c user.name=t -c user.email=t@t commit -qm init
)

# speculative ブランチ群を用意する
# a: 独立ファイル追加 / b: 独立ファイル追加 / x, y: shared.txt の同一行を別内容に変更（相互衝突）
make_feature() {
  local name="$1" file="$2" content="$3"
  g checkout -q -b "speculative/$name" main
  printf '%s\n' "$content" > "$repo/$file"
  g add "$file"
  g commit -qm "$name"
  g checkout -q main
}
make_feature a a.txt "feature-a"
make_feature b b.txt "feature-b"
make_feature x shared.txt "x-version"
make_feature y shared.txt "y-version"
g checkout -q -b speculative/nochange main
g checkout -q main

run_integrate() {
  (cd "$repo" && python3 "$INTEGRATE" "$@" 2>&1)
}

echo "=== test-speculate-integrate.sh ==="

echo "Test 1: 独立した 2 feature の統合成功"
out="$(run_integrate --name integration/loop-test speculative/a speculative/b)"; code=$?
check "全統合で exit 0" 0 "$code" "$out" "integrated=speculative/a,speculative/b"
wt="$box/repo-integration"
assert "integration worktree が残っている" test -d "$wt"
assert "a.txt が統合されている" test -f "$wt/a.txt"
assert "b.txt が統合されている" test -f "$wt/b.txt"
count="$(g rev-list --count main..integration/loop-test)"
assert "1 feature = 1コミット（計2）" test "$count" = "2"

echo "Test 2: 衝突 feature はスキップして報告し、他は統合する"
out="$(run_integrate --name integration/loop-test speculative/x speculative/y)"; code=$?
check "衝突ありで exit 2" 2 "$code" "$out" "conflicted=speculative/y"
check "先着の x は統合される" 2 "$code" "$out" "integrated=speculative/x"
check "衝突ファイルが報告される" 2 "$code" "$out" "CONFLICT: speculative/y: shared.txt"
assert "worktree に衝突の残骸がない" test -z "$(cd "$wt" && git status --porcelain)"
assert "統合結果は x の内容" grep -q "x-version" "$wt/shared.txt"

echo "Test 3: 衝突 feature を外して integration を再生成できる（使い捨て）"
out="$(run_integrate --name integration/loop-test speculative/x)"; code=$?
check "再生成で exit 0" 0 "$code" "$out" "integrated=speculative/x"
count="$(g rev-list --count main..integration/loop-test)"
assert "再生成後は 1 コミットのみ（作り直し）" test "$count" = "1"

echo "Test 4: 存在しないブランチは missing として報告"
out="$(run_integrate --name integration/loop-test speculative/a speculative/ghost)"; code=$?
check "missing ありで exit 2" 2 "$code" "$out" "missing=speculative/ghost"
check "実在する a は統合される" 2 "$code" "$out" "integrated=speculative/a"

echo "Test 5: base と差分の無い feature は empty として報告"
out="$(run_integrate --name integration/loop-test speculative/nochange)"; code=$?
check "empty ありで exit 2" 2 "$code" "$out" "empty=speculative/nochange"

echo "Test 6: base 不在は ERROR"
out="$(run_integrate --base nosuch --name integration/loop-test speculative/a)"; code=$?
check "base 不在で exit 1" 1 "$code" "$out" "ERROR"

echo "Test 7: 置き先が git 管理外のディレクトリなら消さずに ERROR"
(cd "$repo" && git worktree remove --force "$wt" >/dev/null 2>&1; git worktree prune)
mkdir -p "$wt"
printf 'precious\n' > "$wt/user-data.txt"
out="$(run_integrate --name integration/loop-test speculative/a)"; code=$?
check "管理外ディレクトリで ERROR" 1 "$code" "$out" "ERROR"
assert "既存データが無傷" test -f "$wt/user-data.txt"
rm -rf "$wt"

echo "Test 8: commit フック拒否 → commit_failed として ERROR（差分の握り潰しを empty と偽らない）"
hook="$repo/.git/hooks/pre-commit"
printf '#!/bin/sh\nexit 1\n' > "$hook"
chmod +x "$hook"
out="$(run_integrate --name integration/loop-test speculative/a)"; code=$?
check "commit 失敗で exit 1" 1 "$code" "$out" "commit_failed=speculative/a"
check "empty には分類されない" 1 "$code" "$out" "empty=$"
rm -f "$hook"

echo "Test 9: 既存 integration worktree が dirty でも作り直すが、破棄を警告する"
run_integrate --name integration/loop-test speculative/a >/dev/null
printf 'uncommitted memo\n' > "$wt/memo.txt"
out="$(run_integrate --name integration/loop-test speculative/a)"; code=$?
check "dirty worktree の破棄を WARNING" 0 "$code" "$out" "WARNING: .*未コミット変更を破棄"
assert "作り直しは続行される" test -f "$wt/a.txt"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
