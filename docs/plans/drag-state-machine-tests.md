# Plan: ドラッグ状態機械のコンポーネントテスト

**実装状況**: 実装済み（2026-07-05。方針変更あり: 下記「実装時の決定」参照）
**作成日**: 2026-07-05
**出自**: pointer-drag-animation のコードレビュー指摘 Medium #4 の先送り分

## 実装時の決定（2026-07-05）

- **@vue/test-utils のマウントテストではなく、状態機械の DI 抽出＋ headless テストを採用**
  - 根拠: bun test は .vue SFC をコンパイルできない（import するとパス文字列が返ることを検証で確認）。
    マウント路線は Bun 用 SFC プラグインという重いインフラが必要
  - 状態機械を `src/renderer/src/drag-session.ts` に抽出（idle → pending → dragging、deps 注入）し、
    `drag-session.test.ts` で21テスト。スコープの優先カバー対象 1・4・5 を達成
  - 副次効果: 抽出時にレビューで **High 退行1件を検出・修正**（onPointerCancel の pointerId
    ガード欠落 → `cancel(pointerId?)` に拡張）。挙動同一リファクタでも糊付け部分は退行しうる証左
- **残置（テスト対象外の薄い糊付け）**: document/window リスナーの登録解除ペア、pending flush の
  実配線、didDrag の setTimeout 解除は index.vue 側に残る。ここを検証したくなったら
  @vue/test-utils ＋ Bun SFC プラグイン導入を独立計画として起こすこと（現状はコードレビューで担保）

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
