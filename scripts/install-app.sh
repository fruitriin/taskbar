#!/bin/sh
# ビルド済みの taskbar.fm.app を /Applications へインストールする（bun run install-app）
#
# 探索順:
#   1. bundle/macos/ の .app（universal → aarch64/通常 の順で、新しい方を採用）
#   2. .app が無ければ bundle/dmg/ の最新 dmg をマウントして抽出
#      （bundle.targets が "dmg" のみだった時代のビルド出力への後方互換）
# インストール手順: 起動中の taskbar.fm を終了 → /Applications を入れ替え → 再起動
set -eu

cd "$(dirname "$0")/.."

APP_NAME="taskbar.fm.app"
DEST="/Applications/$APP_NAME"

# --- 1. .app を探す（複数あれば最終更新が最新のもの） ---
newest_app=""
for candidate in \
  "src-tauri/target/universal-apple-darwin/release/bundle/macos/$APP_NAME" \
  "src-tauri/target/release/bundle/macos/$APP_NAME" \
  "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/$APP_NAME"; do
  if [ -d "$candidate" ]; then
    if [ -z "$newest_app" ] || [ "$candidate/Contents/MacOS" -nt "$newest_app/Contents/MacOS" ]; then
      newest_app="$candidate"
    fi
  fi
done

# --- 2. 無ければ最新の dmg から抽出 ---
mounted=""
cleanup() {
  if [ -n "$mounted" ]; then
    hdiutil detach "$mounted" -quiet || true
  fi
}
trap cleanup EXIT

if [ -z "$newest_app" ]; then
  newest_dmg="$(find src-tauri/target -path '*/bundle/dmg/*.dmg' -type f -print0 2>/dev/null |
    xargs -0 ls -t 2>/dev/null | head -1)"
  if [ -z "$newest_dmg" ]; then
    echo "error: ビルド済みの $APP_NAME も dmg も見つかりません。" >&2
    echo "       先に 'bun run build:mac'（または 'bun run release:mac'）を実行してください。" >&2
    exit 1
  fi
  echo "==> .app が無いため dmg から抽出します: $newest_dmg"
  mounted="$(hdiutil attach "$newest_dmg" -nobrowse -readonly |
    sed -n 's/.*\(\/Volumes\/.*\)/\1/p' | tail -1)"
  if [ ! -d "$mounted/$APP_NAME" ]; then
    echo "error: dmg 内に $APP_NAME が見つかりません（$mounted）" >&2
    exit 1
  fi
  newest_app="$mounted/$APP_NAME"
fi

echo "==> インストール元: $newest_app"

# --- 3. 起動中なら終了（プロセスが残っていると旧バイナリのまま動き続けるため） ---
if pgrep -xq "taskbar.fm" 2>/dev/null; then
  echo "==> 起動中の taskbar.fm を終了します"
  osascript -e 'tell application "taskbar.fm" to quit' >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -xq "taskbar.fm" || break
    sleep 0.5
  done
fi

# --- 4. 入れ替えて再起動 ---
rm -rf "$DEST"
cp -a "$newest_app" "$DEST"
echo "==> $DEST へインストールしました（$(defaults read "$DEST/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo 'バージョン不明')）"
open "$DEST"
echo "==> 起動しました"
