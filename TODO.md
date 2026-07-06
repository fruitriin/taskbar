# TODO

`docs/plans/` の完了状態・優先度をトラックする。
`docs/plans/` と TODO が一致しなければ TODO を編集する。

## 現在のフェーズ: リアーキテクチャ（Tauri v2 移行）準備

## バックログ

| 優先度 | Phase | 計画ファイル | 状態 |
|---|---|---|---|
| 1 | リアーキ全体 | [rearchitecture-plan.md](docs/plans/rearchitecture-plan.md) | 進行中（親計画。Phase 1 を詰め済み） |
| 2 | リアーキ Phase 1 | [rearch-phase1.md](docs/plans/rearch-phase1.md) | 進行中: 1-0〜1-E 完了。**残りは 1-F（UnoCSS）のみ**（オーナー目視確認が完了条件のため在席時推奨） |
| 3 | リアーキ Phase 2 | [rearch-phase2.md](docs/plans/rearch-phase2.md) | 詰め済み。2-0 完了・2-C クローズ（bun test 継続）・2-D 決定済み（mise 廃止 → package.json scripts）。残 2-A/2-B/2-D |
| 4 | リアーキ Phase 3 | [rearch-phase3.md](docs/plans/rearch-phase3.md) | 未着手 |
| 5 | 単発 | [swiftFilter.md](docs/plans/swiftFilter.md) | 未着手 ※Phase 3 で Swift Helper 廃止予定のため要否確認 |
| 6 | 単発 | [autoUpdate.md](docs/plans/autoUpdate.md) | 検討段階 |

※優先度は導入時の仮置き。オーナーが並べ替えてください。

---

## アーカイブ

| Phase | 計画ファイル | 状態 |
|---|---|---|
| 単発 | [drag-state-machine-tests.md](docs/plans/drag-state-machine-tests.md) | 完了（2026-07-05。DI 抽出方式に方針変更、High 退行1件を検出・修正） |
| 単発 | [pointer-drag-animation.md](docs/plans/pointer-drag-animation.md) | 完了（2026-07-05。実機確認項目の消化が残） |
| 単発 | [app-window-grouping.md](docs/plans/app-window-grouping.md) | 完了（2026-07-05。D&D 実機確認済み。リリース時に version 2.1.1+ 必須） |
| 2.0.0 | [release200loadmap.md](docs/plans/release200loadmap.md) | 完了（2.0.0 リリース済み） |
| 単発 | [permission-ui-plan.md](docs/plans/permission-ui-plan.md) | 完了（旧 claudeTasks/Finished） |
