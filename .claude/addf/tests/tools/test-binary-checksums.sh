#!/bin/bash
# test-binary-checksums.sh
# コミット済みバイナリ4種と checksums.sha256 の照合テスト（Plan 0031）。
# ハッシュ計算のみでバイナリを実行しないため、非 macOS でも SKIP せず全ケース実行する。
# 異常系は mktemp サンドボックスへのドリフト注入で検証する（実リポジトリを汚さない）。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
TOOLS_DIR="$PROJECT_DIR/.claude/addf/addfTools"
VERIFY="$TOOLS_DIR/verify-checksums.sh"
PASS=0
FAIL=0
SKIP=0

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
  if printf '%s' "$haystack" | grep -qF "$needle"; then
    echo "  PASS: $test_name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $test_name (output did not contain: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local test_name="$1" needle="$2" haystack="$3"
  if printf '%s' "$haystack" | grep -qF "$needle"; then
    echo "  FAIL: $test_name (output unexpectedly contained: $needle)"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS: $test_name"
    PASS=$((PASS + 1))
  fi
}

# サンドボックス: 偽バイナリ4つ + build.sh / verify-checksums.sh のコピーで
# .claude/addf/addfTools/ の相対レイアウトを再現する（照合はハッシュのみなので偽物で十分）
BOX="$(mktemp -d)"
trap 'rm -rf "$BOX"' EXIT
BOX_TOOLS="$BOX/.claude/addf/addfTools"
mkdir -p "$BOX_TOOLS"
for f in window-info capture-window annotate-grid clip-image; do
  printf 'fake-binary-%s\n' "$f" > "$BOX_TOOLS/$f"
done
cp "$TOOLS_DIR/build.sh" "$TOOLS_DIR/verify-checksums.sh" "$BOX_TOOLS/"

echo "=== test-binary-checksums.sh ==="

# テスト 1: 実リポジトリの照合が通る（本体では SKIP が出ないことも固定 —
# 誤って downstream 判定に裏返ったとき気づけるフェイルセーフ）
echo "Test 1: 実リポジトリ照合（一致 → PASS・SKIP なし）"
out="$(bash "$VERIFY" 2>&1)"
assert_exit "実リポジトリで exit 0" 0 $?
assert_contains "4バイナリ照合 OK" "OK: clip-image" "$out"
assert_not_contains "本体で SKIP が出ない" "SKIP" "$out"

# テスト 2: サンドボックスで生成 → 照合の往復（build.sh --checksums-only の生成経路）
echo "Test 2: build.sh --checksums-only 生成 → 照合一致"
bash "$BOX_TOOLS/build.sh" --checksums-only >/dev/null 2>&1
assert_exit "サンドボックスで checksums 生成" 0 $?
bash "$BOX_TOOLS/verify-checksums.sh" >/dev/null 2>&1
assert_exit "生成直後の照合が exit 0" 0 $?

# テスト 3: バイナリ改変 → FAIL（バイナリだけ更新した片側コミットの検出）
echo "Test 3: バイナリ改変 → FAIL"
printf 'tampered\n' >> "$BOX_TOOLS/window-info"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
assert_exit "改変バイナリで exit 1" 1 $?
assert_contains "不一致メッセージ" "FAIL: window-info" "$out"
bash "$BOX_TOOLS/build.sh" --checksums-only >/dev/null 2>&1  # 整合状態へ復旧

# テスト 4: checksums だけ更新 → FAIL（checksums だけの片側コミットの検出）
echo "Test 4: checksums だけ更新 → FAIL"
zero_hash="$(printf '0%.0s' $(seq 64))"
awk -v h="$zero_hash" 'NR==1{$1=h}1' "$BOX_TOOLS/checksums.sha256" > "$BOX_TOOLS/checksums.tmp" \
  && mv "$BOX_TOOLS/checksums.tmp" "$BOX_TOOLS/checksums.sha256"
bash "$BOX_TOOLS/verify-checksums.sh" >/dev/null 2>&1
assert_exit "改変 checksums で exit 1" 1 $?

# テスト 5: checksums 不在 + upstream 宣言 → FAIL（本体ではビルド漏れ/削除ドリフト）
echo "Test 5: checksums 不在（upstream）→ FAIL"
rm -f "$BOX_TOOLS/checksums.sha256"
printf 'このリポジトリは **ADDF 開発プロジェクト**（フレームワーク本体）です。\n' > "$BOX/CLAUDE.repo.md"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
assert_exit "upstream で checksums 不在は exit 1" 1 $?
assert_contains "upstream 判定の明示" "repo_kind=upstream" "$out"

# テスト 6: checksums 不在 + downstream（lock フォールバック）→ 明示 SKIP で exit 0
echo "Test 6: checksums 不在（downstream）→ SKIP"
rm -f "$BOX/CLAUDE.repo.md"
printf '{"version":"0.0.0"}\n' > "$BOX/.claude/addf/lock.json"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
assert_exit "downstream で checksums 不在は exit 0" 0 $?
assert_contains "SKIP の明示出力" "SKIP" "$out"

# テスト 7: checksums 不在 + シグナルなし（判定不能）→ SKIP + WARNING（exit 2）
echo "Test 7: checksums 不在（判定不能）→ WARNING"
rm -f "$BOX/.claude/addf/lock.json"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
assert_exit "判定不能で exit 2" 2 $?
assert_contains "種別シグナル整備の促し" "判定不能" "$out"

# テスト 8: downstream の種別宣言（コードフェンス外）が lock より優先される
echo "Test 8: downstream 種別宣言 → SKIP"
rm -f "$BOX_TOOLS/checksums.sha256"
printf 'このリポジトリは **ADDF 利用プロジェクト** です。\n' > "$BOX/CLAUDE.repo.md"
bash "$BOX_TOOLS/verify-checksums.sh" >/dev/null 2>&1
assert_exit "宣言による downstream 判定で exit 0" 0 $?

# 整合状態に復旧してから攻撃者モデル系のテストへ入る
rm -f "$BOX/CLAUDE.repo.md" "$BOX/.claude/addf/lock.json"
bash "$BOX_TOOLS/build.sh" --checksums-only >/dev/null 2>&1

# テスト 9: attacker — allowlist 外の実行可能ファイル（evil-tool）混入 → ERROR（Plan 0031 C1）
echo "Test 9: allowlist 外の実行可能ファイル混入 → ERROR"
printf '#!/bin/sh\n' > "$BOX_TOOLS/evil-tool"
chmod +x "$BOX_TOOLS/evil-tool"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
exit_code=$?
assert_exit "未登録実行可能ファイルで FAIL" 1 "$exit_code"
assert_contains "未登録バイナリ検出メッセージ" "未登録バイナリ検出" "$out"
assert_contains "evil-tool を指す" "evil-tool" "$out"
rm -f "$BOX_TOOLS/evil-tool"

# テスト 10: attacker — checksums.sha256 の name にパストラバーサル → ERROR（Plan 0031 C2）
echo "Test 10: checksums.sha256 の name にパストラバーサル → ERROR"
bash "$BOX_TOOLS/build.sh" --checksums-only >/dev/null 2>&1
zero_hash="$(printf '0%.0s' $(seq 64))"
printf '%s  ../../etc/passwd\n' "$zero_hash" >> "$BOX_TOOLS/checksums.sha256"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
exit_code=$?
assert_exit "パストラバーサル検出で exit 1" 1 "$exit_code"
assert_contains "セパレータまたは .. の拒否メッセージ" "パスセパレータまたは" "$out"
assert_not_contains "actual: ハッシュを漏洩しない" "actual:" "$out"
bash "$BOX_TOOLS/build.sh" --checksums-only >/dev/null 2>&1

# テスト 11: attacker — checksums.sha256 の name が allowlist 外（BINARIES にない） → ERROR
echo "Test 11: checksums.sha256 の name が allowlist 外 → ERROR"
printf '%s  malicious-tool\n' "$zero_hash" >> "$BOX_TOOLS/checksums.sha256"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
exit_code=$?
assert_exit "allowlist 外 name で exit 1" 1 "$exit_code"
assert_contains "allowlist メッセージ" "allowlist" "$out"
bash "$BOX_TOOLS/build.sh" --checksums-only >/dev/null 2>&1

# テスト 12: 空 checksums → ERROR（Plan 0031 W9）
echo "Test 12: 空 checksums → ERROR"
: > "$BOX_TOOLS/checksums.sha256"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
exit_code=$?
assert_exit "空 checksums で exit 1" 1 "$exit_code"
assert_contains "照合対象1件もない" "照合対象が1件もありません" "$out"
bash "$BOX_TOOLS/build.sh" --checksums-only >/dev/null 2>&1

# テスト 13: バイナリ不在 → FAIL に復旧コマンド案内を含む（Plan 0031 W5）
echo "Test 13: バイナリ不在 → FAIL に復旧コマンド案内"
saved="$BOX/window-info.saved"
mv "$BOX_TOOLS/window-info" "$saved"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
exit_code=$?
assert_exit "バイナリ不在で exit 1" 1 "$exit_code"
assert_contains "バイナリ不在の FAIL メッセージ" "バイナリが不在" "$out"
assert_contains "復旧案内文" "復旧: バイナリを再ビルド" "$out"
mv "$saved" "$BOX_TOOLS/window-info"

# テスト 14: ハッシュ不一致 → FAIL に復旧コマンド案内を含む（Plan 0031 W5）
echo "Test 14: ハッシュ不一致 → FAIL に復旧コマンド案内"
printf 'tampered\n' >> "$BOX_TOOLS/window-info"
out="$(bash "$BOX_TOOLS/verify-checksums.sh" 2>&1)"
exit_code=$?
assert_exit "改変で exit 1" 1 "$exit_code"
assert_contains "復旧案内（不一致）" "片側コミットの疑い" "$out"
bash "$BOX_TOOLS/build.sh" --checksums-only >/dev/null 2>&1

# テスト 15: sha256sum / shasum 分岐強制（Plan 0031 S15 — 可能な範囲でカバー）
# 実プロジェクトの CLAUDE.repo.md / CLAUDE.repo.example.md をサンドボックスにコピーして
# 「@メンション経由の upstream 判定」の疎通を確認する（Plan 0031 H3(d)）
echo "Test 15: 実プロジェクト構成の CLAUDE.repo.md をコピー → upstream 判定"
# CLAUDE.repo.md / CLAUDE.repo.example.md のいずれかを持たない構成（ダウンストリームの一部・
# Issue #26 実測）では以降の cp が失敗するため、必須ランタイム不在ではなく正当な
# プロジェクト構成差異として SKIP する（sync-lint-design.md の「addfTools はダウンストリーム
# 配布を前提に欠如=SKIP で設計する」方針。@メンション先の example.md だけが欠けている構成でも
# 同様に SKIP しないと cp 失敗を無視したまま後続の assert_exit がスプリアスな FAIL になる）
if [ ! -f "$PROJECT_DIR/CLAUDE.repo.md" ] || [ ! -f "$PROJECT_DIR/CLAUDE.repo.example.md" ]; then
  echo "  SKIP: CLAUDE.repo.md or CLAUDE.repo.example.md not found — skipping upstream classification test"
  SKIP=$((SKIP + 1))
else
  BOX2="$(mktemp -d)"
  mkdir -p "$BOX2/.claude/addf/addfTools"
  for f in window-info capture-window annotate-grid clip-image; do
    printf 'fake-binary-%s\n' "$f" > "$BOX2/.claude/addf/addfTools/$f"
  done
  cp "$TOOLS_DIR/build.sh" "$TOOLS_DIR/verify-checksums.sh" "$BOX2/.claude/addf/addfTools/"
  # @メンション構造をそのまま再現するため、実プロジェクトの CLAUDE.repo.md と
  # 参照先 CLAUDE.repo.example.md を両方コピー
  cp "$PROJECT_DIR/CLAUDE.repo.md" "$BOX2/CLAUDE.repo.md"
  cp "$PROJECT_DIR/CLAUDE.repo.example.md" "$BOX2/CLAUDE.repo.example.md"
  # checksums 不在 + upstream 判定成立 → ERROR + repo_kind=upstream を出す
  out="$(bash "$BOX2/.claude/addf/addfTools/verify-checksums.sh" 2>&1)"
  exit_code=$?
  assert_exit "実プロジェクト CLAUDE.repo.md コピーで upstream 判定 → ERROR" 1 "$exit_code"
  assert_contains "@メンション解決で upstream 判定" "repo_kind=upstream" "$out"
  rm -rf "$BOX2"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed, $SKIP skipped"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
