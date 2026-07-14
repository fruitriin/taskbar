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

# .env はシェルとして source しない（値に $() 等が混入した場合の実行を防ぐ）。
# 必要な3キーだけを素朴な KEY=VALUE として抽出する
env_value() {
  sed -n "s/^$1=//p" .env | tail -1
}

APPLE_ID="$(env_value APPLE_ID)"
APPLE_PASSWORD="$(env_value APPLE_ID_PASS)"
APPLE_TEAM_ID="$(env_value TEAM_ID)"

if [ -z "$APPLE_ID" ] || [ -z "$APPLE_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
  echo "error: .env に APPLE_ID / APPLE_ID_PASS / TEAM_ID が揃っていません" >&2
  exit 1
fi

export APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID

exec bunx tauri build "$@"
