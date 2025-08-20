#!/bin/bash

# TaskbarHelperのデバッグ出力をキャプチャしてテストフィクスチャーに保存するスクリプト

set -e

# カラー出力用の定数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ヘルパーバイナリのパスを確認
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HELPER_PATH="$PROJECT_ROOT/resources/TaskbarHelper"
FIXTURES_PATH="$PROJECT_ROOT/src/main/tests/fixtures/taskbar-helper-fixtures.ts"

echo -e "${BLUE}TaskbarHelper Debug Output Capture Tool${NC}"
echo "==========================================="

# TaskbarHelperバイナリの存在確認
if [ ! -f "$HELPER_PATH" ]; then
    echo -e "${RED}Error: TaskbarHelper binary not found at: $HELPER_PATH${NC}"
    echo -e "${YELLOW}Please build the Swift helper first using: mise run swiftbuild${NC}"
    exit 1
fi

echo -e "${GREEN}✓ TaskbarHelper binary found${NC}"

# 出力ファイルのパス
OUTPUT_DIR="$PROJECT_ROOT/debug-output"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RAW_OUTPUT="$OUTPUT_DIR/helper_debug_$TIMESTAMP.json"
FORMATTED_OUTPUT="$OUTPUT_DIR/helper_debug_formatted_$TIMESTAMP.json"

echo -e "${BLUE}Capturing TaskbarHelper debug output...${NC}"

# TaskbarHelperのデバッグ出力をキャプチャ
if "$HELPER_PATH" debug > "$RAW_OUTPUT" 2>&1; then
    echo -e "${GREEN}✓ Debug output captured to: $RAW_OUTPUT${NC}"
    
    # JSONフォーマットチェック
    if command -v jq >/dev/null 2>&1; then
        echo -e "${BLUE}Formatting JSON output...${NC}"
        if jq '.' "$RAW_OUTPUT" > "$FORMATTED_OUTPUT"; then
            echo -e "${GREEN}✓ Formatted JSON saved to: $FORMATTED_OUTPUT${NC}"
        else
            echo -e "${YELLOW}Warning: JSON formatting failed, using raw output${NC}"
            cp "$RAW_OUTPUT" "$FORMATTED_OUTPUT"
        fi
    else
        echo -e "${YELLOW}Note: jq not found, skipping JSON formatting${NC}"
        cp "$RAW_OUTPUT" "$FORMATTED_OUTPUT"
    fi
    
    # フィクスチャーファイルを更新するかユーザーに確認
    echo ""
    echo -e "${YELLOW}Would you like to update the test fixtures with this debug output? (y/N)${NC}"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        # フィクスチャーファイルのrealWorldSampleを更新
        echo -e "${BLUE}Updating test fixtures...${NC}"
        
        # JSONデータを取得
        JSON_DATA=$(cat "$FORMATTED_OUTPUT")
        
        # TypeScriptファイルの更新（realWorldSample部分のみ）
        # 一時ファイルを作成
        TEMP_FILE=$(mktemp)
        
        # realWorldSample以前の部分をコピー
        sed '/export const realWorldSample: MacWindow\[\] = \[/,$d' "$FIXTURES_PATH" > "$TEMP_FILE"
        
        # 新しいrealWorldSampleを追加
        echo "export const realWorldSample: MacWindow[] = " >> "$TEMP_FILE"
        echo "$JSON_DATA" >> "$TEMP_FILE"
        
        # ファイルの残りの部分を追加（testHelpers以降）
        echo "" >> "$TEMP_FILE"
        sed -n '/\/\*\*/,$p' "$FIXTURES_PATH" | sed -n '/export const testHelpers/,$p' >> "$TEMP_FILE"
        
        # 元のファイルを置き換え
        mv "$TEMP_FILE" "$FIXTURES_PATH"
        
        echo -e "${GREEN}✓ Test fixtures updated successfully${NC}"
        echo -e "${BLUE}Updated file: $FIXTURES_PATH${NC}"
    else
        echo -e "${YELLOW}Fixtures not updated. You can manually copy the JSON from:${NC}"
        echo -e "${BLUE}$FORMATTED_OUTPUT${NC}"
    fi
    
else
    echo -e "${RED}Error: Failed to capture TaskbarHelper debug output${NC}"
    echo -e "${YELLOW}Make sure TaskbarHelper has proper permissions and is working correctly${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Debug output capture completed!${NC}"
echo ""
echo -e "${BLUE}Files created:${NC}"
echo "  Raw output: $RAW_OUTPUT"
echo "  Formatted:  $FORMATTED_OUTPUT"
echo ""
echo -e "${BLUE}Usage tips:${NC}"
echo "  • Use the captured data to test filterProcesses function"
echo "  • Compare before/after filtering results"
echo "  • Create specific test scenarios based on real data"
echo "  • Update the fixtures regularly to keep tests realistic"