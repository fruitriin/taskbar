# Plan: ドラッグ状態機械のコンポーネントテスト

**実装状況**: 未着手
**作成日**: 2026-07-05
**出自**: pointer-drag-animation のコードレビュー指摘 Medium #4 の先送り分

## 目的

index.vue の Pointer Events ドラッグ状態機械は utils.ts の純関数（テスト済み）に比べて
テストがなく、退行に気づきにくい。happy-dom 環境でコンポーネントレベルのテストを追加する。

## スコープ

- テスト基盤: @vue/test-utils の導入検討（現状 renderer テストはプレーンな bun test のみ）
- 優先カバー対象:
  1. 多重 pointerdown 防止（pointerId ガード）
  2. cleanupDrag 後の document/window リスナー完全解除
  3. process 更新の保留と cleanup 時の flush タイミング
  4. ドラッグ後の click 合成抑止（didDrag）と通常クリックの素通し
  5. 自己修復パス（event.buttons === 0 / blur / Escape / pointercancel）

## メモ

- pointerdown → pointermove → pointerup を dispatchEvent でシミュレートする
- PointerEvent が happy-dom に無い場合は MouseEvent ベースの polyfill を検討
