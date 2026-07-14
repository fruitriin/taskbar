#!/bin/bash
# build.sh
#
# Swift ツール群をコンパイルしてバイナリを生成する。
#
# Usage: ./build.sh
# 出力先: このスクリプトと同じディレクトリ

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building window-info..."
swiftc "$SCRIPT_DIR/window-info.swift" -o "$SCRIPT_DIR/window-info" \
    -framework ApplicationServices -framework Foundation
echo "    OK: $SCRIPT_DIR/window-info"

echo "==> Building capture-window..."
swiftc "$SCRIPT_DIR/capture-window.swift" -o "$SCRIPT_DIR/capture-window" \
    -framework ScreenCaptureKit -framework CoreGraphics -framework Foundation
echo "    OK: $SCRIPT_DIR/capture-window"

echo "==> Setting execute permission on check-screen-recording.sh..."
chmod +x "$SCRIPT_DIR/check-screen-recording.sh"
echo "    OK: $SCRIPT_DIR/check-screen-recording.sh"

echo "==> Building annotate-grid..."
swiftc "$SCRIPT_DIR/annotate-grid.swift" -o "$SCRIPT_DIR/annotate-grid" \
    -framework CoreGraphics -framework CoreText -framework Foundation -framework ImageIO
echo "    OK: $SCRIPT_DIR/annotate-grid"

echo "==> Building clip-image..."
swiftc "$SCRIPT_DIR/clip-image.swift" -o "$SCRIPT_DIR/clip-image" \
    -framework CoreGraphics -framework Foundation -framework ImageIO
echo "    OK: $SCRIPT_DIR/clip-image"

echo ""
echo "Build complete."
