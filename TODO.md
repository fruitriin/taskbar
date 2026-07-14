# TODO

`docs/plans/` の完了状態・優先度をトラックする。
`docs/plans/` と TODO が一致しなければ TODO を編集する。

## 現在のフェーズ: リアーキテクチャ完了 → v3.0.0 リリース

## バックログ

| 優先度 | Phase | 計画ファイル | 状態 |
|---|---|---|---|
| 1 | v3.0.0 リリース | （/addf-release で実施） | **draft 作成済み・オーナーの公開待ち（2026-07-14）**: master マージ・タグ push・CI 成功（universal DMG・notarize・staple 検証済み）・ノート設定済み。残りは GitHub 上の Publish ボタンのみ |
| 2 | autoUpdate 再起票 | （Q4 回答: Phase 3 完了につき起票可能に） | 未起票: tauri-plugin-updater 前提で設計する |

※優先度は仮置き。オーナーが並べ替えてください。

---

## アーカイブ

| Phase | 計画ファイル | 状態 |
|---|---|---|
| リアーキ全体 | [rearchitecture-plan.md](docs/plans/rearchitecture-plan.md) | **完了（2026-07-14）** 🎉 Phase 1〜3 全消化 |
| リアーキ Phase 1 | [rearch-phase1.md](docs/plans/rearch-phase1.md) | 完了（2026-07-07）。残課題は pages/→views/ リネーム見送りと既知の負債2件（計画参照） |
| リアーキ Phase 2 | [rearch-phase2.md](docs/plans/rearch-phase2.md) | 完了（2026-07-07。lint=oxlint / fmt=oxfmt / test=bun test / mise 廃止 → bun run） |
| リアーキ Phase 3 | [rearch-phase3.md](docs/plans/rearch-phase3.md) | **完了（2026-07-14）** 🎉 Tauri v2 移行・Electron/Swift 全廃・署名/notarize 検証済み・オーナー実機確認済み |
| 単発 | [swiftFilter.md](docs/plans/swiftFilter.md) | クローズ（Q4 回答: Phase 3 で Swift Helper ごと廃止のため不要） |
| 単発 | [autoUpdate.md](docs/plans/autoUpdate.md) | クローズ（Q4 回答: Phase 3 完了後に tauri-plugin-updater 前提で再起票する） |
| 単発 | [drag-state-machine-tests.md](docs/plans/drag-state-machine-tests.md) | 完了（2026-07-05。DI 抽出方式に方針変更、High 退行1件を検出・修正） |
| 単発 | [pointer-drag-animation.md](docs/plans/pointer-drag-animation.md) | 完了（2026-07-05。実機確認項目の消化が残） |
| 単発 | [app-window-grouping.md](docs/plans/app-window-grouping.md) | 完了（2026-07-05。D&D 実機確認済み。リリース時に version 2.1.1+ 必須） |
| 2.0.0 | [release200loadmap.md](docs/plans/release200loadmap.md) | 完了（2.0.0 リリース済み） |
| 単発 | [permission-ui-plan.md](docs/plans/permission-ui-plan.md) | 完了（旧 claudeTasks/Finished） |
