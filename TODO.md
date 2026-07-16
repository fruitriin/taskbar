# TODO

`.claude/addf/plans/` の完了状態・優先度をトラックする。
`.claude/addf/plans/` と TODO が一致しなければ TODO を編集する。

## 現在のフェーズ: v3.0.0 リリース済み（2026-07-14）・次テーマ選定

## バックログ

| 優先度 | Phase | 計画ファイル | 状態 |
|---|---|---|---|
| 1 | autoUpdate 再起票 | （Q4 回答: Phase 3 完了につき起票可能に） | 未起票: tauri-plugin-updater 前提で設計する |
| 2 | Plan Audit 棚卸し | [plan-audit-2026-07-14.md](.claude/addf/plans/plan-audit-2026-07-14.md) | オーナー確認待ち: 検出5件（rearch-phase1/2 の完了条件チェックリスト未更新、pointer-drag-animation の実機確認未消化5項目 等）。処置3択の採否待ち。**ツール自体の指摘**: lint-plan-status.py / lint-template-sync.py ペア6 が本プロジェクトの命名規則（非採番 Plan・Markdown リンク形式 TODO）と噛み合わずノーカバレッジな点も要判断 |
| 3 | グループD&D left/right実機確認 | [group-drag-swap-fix.md](.claude/addf/plans/group-drag-swap-fix.md) | 残課題: bottomレイアウトはオーナー実機確認済み（「完璧」評価）。left/rightレイアウトのグループ表示崩れの有無が未確認 |
| 4 | Spaces全デスクトップ表示・実機確認 | [spaces-all-desktops-visibility.md](.claude/addf/plans/spaces-all-desktops-visibility.md) | 実装・機械検証済み（2026-07-16）: visible_on_all_workspaces(true) 追加。CGWindowList probe の A/B 検証でバグ再現→解消を機械確認済み。残: オーナー実機確認（通常デスクトップ2以降で表示。フルスクリーン Space は隠れる仕様＝オーナー回答どおり） |

※優先度は仮置き。オーナーが並べ替えてください。

---

## アーカイブ

| Phase | 計画ファイル | 状態 |
|---|---|---|
| 単発 | [group-drag-swap-fix.md](.claude/addf/plans/group-drag-swap-fix.md) | 完了（2026-07-16）。グループD&D高速交互入れ替えバグを修正（判定単位とhitTest幾何取得単位の統一・blockedApp振動防止・末尾ドロップ対応等）。アニメーション速度はCDP実測診断を経て150msに再調整。オーナー実機確認（bottomレイアウト）で「こっちのほうがずっとよさそう」の最終評価。left/right実機確認は残課題としてバックログに別掲 |
| リリース | v3.0.0（GitHub Releases） | **公開済み（2026-07-14）** 🎉 Tauri 版初リリース。universal DMG・notarize/staple・アイコン検証済み。CI（tauri-action）も実走検証完了 |
| リアーキ全体 | [rearchitecture-plan.md](.claude/addf/plans/rearchitecture-plan.md) | **完了（2026-07-14）** 🎉 Phase 1〜3 全消化 |
| リアーキ Phase 1 | [rearch-phase1.md](.claude/addf/plans/rearch-phase1.md) | 完了（2026-07-07）。残課題は pages/→views/ リネーム見送りと既知の負債2件（計画参照） |
| リアーキ Phase 2 | [rearch-phase2.md](.claude/addf/plans/rearch-phase2.md) | 完了（2026-07-07。lint=oxlint / fmt=oxfmt / test=bun test / mise 廃止 → bun run） |
| リアーキ Phase 3 | [rearch-phase3.md](.claude/addf/plans/rearch-phase3.md) | **完了（2026-07-14）** 🎉 Tauri v2 移行・Electron/Swift 全廃・署名/notarize 検証済み・オーナー実機確認済み |
| 単発 | [swiftFilter.md](.claude/addf/plans/swiftFilter.md) | クローズ（Q4 回答: Phase 3 で Swift Helper ごと廃止のため不要） |
| 単発 | [autoUpdate.md](.claude/addf/plans/autoUpdate.md) | クローズ（Q4 回答: Phase 3 完了後に tauri-plugin-updater 前提で再起票する） |
| 単発 | [drag-state-machine-tests.md](.claude/addf/plans/drag-state-machine-tests.md) | 完了（2026-07-05。DI 抽出方式に方針変更、High 退行1件を検出・修正） |
| 単発 | [pointer-drag-animation.md](.claude/addf/plans/pointer-drag-animation.md) | 完了（2026-07-05。実機確認項目の消化が残） |
| 単発 | [app-window-grouping.md](.claude/addf/plans/app-window-grouping.md) | 完了（2026-07-05。D&D 実機確認済み。リリース時に version 2.1.1+ 必須） |
| 2.0.0 | [release200loadmap.md](.claude/addf/plans/release200loadmap.md) | 完了（2.0.0 リリース済み） |
| 単発 | [permission-ui-plan.md](.claude/addf/plans/permission-ui-plan.md) | 完了（旧 claudeTasks/Finished） |
