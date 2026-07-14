#!/bin/sh
# 署名＋notarize 付きリリースビルド（bun run release:mac）
#
# .env（gitignore 対象）の資格情報を Tauri bundler が期待する環境変数名に
# マッピングして tauri build を実行する。
#   .env 側:  APPLE_ID / APPLE_ID_PASS / TEAM_ID
#   Tauri 側: APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID（3つ揃うと notarize が走る）
#   署名 identity は tauri.conf.json の bundle.macOS.signingIdentity を使用
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "error: .env がありません（APPLE_ID / APPLE_ID_PASS / TEAM_ID が必要）" >&2
  exit 1
fi

# .env を読み込む（KEY=VALUE 形式のみ想定）
set -a
. ./.env
set +a

export APPLE_ID
export APPLE_PASSWORD="${APPLE_ID_PASS:?}"
export APPLE_TEAM_ID="${TEAM_ID:?}"

exec bunx tauri build "$@"
