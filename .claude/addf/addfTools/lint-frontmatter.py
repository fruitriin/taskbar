#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""スキル frontmatter チェック — name, description フィールドの存在確認"""
import sys, glob

try:
    import yaml
except ModuleNotFoundError:
    # pyyaml は PEP 723 依存。受動的 lint のため欠如は SKIP（配布先で誤 ERROR を出さない）
    print('SKIP: pyyaml がありません。`uv run --python 3.11` で実行する'
          '（PEP 723 依存を自動解決）か、`pip install pyyaml` してください')
    sys.exit(0)

errors = []
# .claude/optional/ はオプトイン式スキルの原本置き場（有効化コピーの検査は commands 側で兼ねる）
for f in sorted(glob.glob('.claude/commands/addf-*.md')
                + glob.glob('.claude/optional/*/addf-*.md')):
    if f.endswith('.exp.md'):
        continue  # 経験ファイルはスキル定義ではないためスキップ
    with open(f) as fh:
        content = fh.read()
    if not content.startswith('---'):
        errors.append(f'{f}: frontmatter なし')
        continue
    parts = content.split('---', 2)
    if len(parts) < 3:
        errors.append(f'{f}: frontmatter 閉じタグなし')
        continue
    try:
        meta = yaml.safe_load(parts[1])
    except Exception as e:
        errors.append(f'{f}: YAML パースエラー: {e}')
        continue
    if not meta or not isinstance(meta, dict):
        errors.append(f'{f}: frontmatter が空または不正')
        continue
    for key in ['name', 'description']:
        if key not in meta:
            errors.append(f'{f}: {key} フィールドなし')

for e in errors:
    print(e)
sys.exit(1 if errors else 0)
