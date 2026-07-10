# Knowhow Index

> 自動生成。`/addf-knowhow-index reindex` で再生成できる。

| 鮮度 | ファイル | 要約 | キーワード |
|---|---|---|---|
| 🟢 2026-07-05 | [electron-store-migration.md](electron-store-migration.md) | electron-store のマイグレーション発火条件（semver.satisfies）と defaults 浅マージの落とし穴、3点セット対策 | electron-store, migration, semver, defaults, appOrder, フォールバック, store.ts |
| 🟢 2026-07-05 | [multi-display-renderer-state.md](multi-display-renderer-state.md) | マルチディスプレイでレンダラーローカル状態が食い違う罠と対策（決定的ルール・dataTransfer・store 配信） | マルチディスプレイ, BrowserWindow, D&D, dataTransfer, 決定的ソート, kCGWindowNumber, レンダラー状態 |
| 🟢 2026-07-10 | [rust-port-delegation.md](rust-port-delegation.md) | Swift/Electron→Rust 移植の委譲パターン（cargo ゲート反復・原本行参照・serde キー一致・ペイロード3実装逆算・DIP 変換・fire-and-forget 不在の代替） | Rust, Tauri, 委譲, serde, DIP, ipc, 移植, ignored テスト |
| 🟢 2026-07-06 | [behavior-identical-refactor.md](behavior-identical-refactor.md) | 挙動同一リファクタの運用（比較基準コミット明示レビュー・意図的逸脱の明記・統合時の全ペア diff・フォーマッタが等価性を破る罠） | リファクタ, 挙動同一, Composition API, レビュー, 全ペア diff, prettier, 意図的逸脱 |
| 🟢 2026-07-05 | [pointer-drag-reactive.md](pointer-drag-reactive.md) | Pointer Events + リアクティブ状態 + TransitionGroup FLIP で Sortable 的 D&D を生 DOM 操作なしに再現する設計。振動対策・click 抑止・楽観反映・更新保留 | Pointer Events, D&D, FLIP, TransitionGroup, shouldSwap, オシレーション, ゴースト, didDrag, MkDraggable, 楽観反映 |
