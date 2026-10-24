# TODO

`.claude/addf/plans/` の完了状態・優先度をトラックする。
`.claude/addf/plans/` と TODO が一致しなければ TODO を編集する。

## 現在のフェーズ: v3.0.0 リリース済み（2026-07-14）・次テーマ選定

## バックログ

| 優先度 | Phase | 計画ファイル | 状態 |
|---|---|---|---|
| 1 | タスクの結合（Windows 風）とサムネイル | [taskbar-app-combining.md](.claude/addf/plans/taskbar-app-combining.md) | 設計確定・着手可（2026-10-24）。サムネイルは ScreenCaptureKit で macOS 14 以降のみ（未満はグレーアウト）、ホバーで表示、結合ボタンは「（アプリ名）をすべて閉じる」、太さは推奨値から |
| 2 | 自動アップデート＋利用観測 | [auto-update-tauri.md](.claude/addf/plans/auto-update-tauri.md) | 起票済み（2026-07-18）。設計判断2点のオーナー回答待ち: ①計測方式 (a)ゼロインフラ/(b)自前プロキシ/(c)ハイブリッド推奨 ②更新UX (X)メニュー通知推奨/(Y)サイレント/(Z)ダイアログ。回答が出れば実装着手可 |
| 3 | Plan Audit ツールギャップ判断 | [plan-audit-2026-07-14.md](.claude/addf/plans/plan-audit-2026-07-14.md) | 検出 #1〜#6 は採否確定・全件反映済み（2026-07-16）。**残: ツールギャップの処置判断のみ** — lint-plan-status.py / lint-template-sync.py ペア6 が本プロジェクトの命名規則（非採番 Plan・Markdown リンク形式 TODO）と噛み合わずノーカバレッジ。選択肢: (a) Plan を NNNN- 採番に寄せる / (b) lint 側パターン拡張（推奨・ADDF 本体候補）/ (c) 現状維持 |
| 4 | グループD&D left/right実機確認ほか | [group-drag-swap-fix.md](.claude/addf/plans/group-drag-swap-fix.md) | 残課題: left/rightレイアウトのグループ表示崩れの有無（bottomは「完璧」評価済み）。**オーナー報告（2026-07-16）: left/right でスワップ中に縦スクロールバーが出ることがある → 同ラウンドで調査・修正**。あわせて [pointer-drag-animation.md](.claude/addf/plans/pointer-drag-animation.md) の実機確認未消化5項目も同ラウンドで消化（plan-audit #3 採否 (a)） |
※優先度は仮置き。オーナーが並べ替えてください。

---

## アーカイブ

| Phase | 計画ファイル | 状態 |
|---|---|---|
| 単発 | [context-menu-adjustments.md](.claude/addf/plans/context-menu-adjustments.md) | **完了（2026-10-24）**。右クリックメニューに「フルスクリーンを避ける」（トグル）と「設定」を追加、ピン留めに改名、余白の右クリックメニューを新設。設定画面が updateOptions に追従するよう修正（レビュー High） |
| 単発 | [window-overlap-avoidance.md](.claude/addf/plans/window-overlap-avoidance.md) | **完了（2026-10-24）**。タスクバーと重なるウィンドウを AX で移動優先・足りなければ縮小して避ける（Issue #48。既定有効）。突き抜けは尊重、ドラッグ中は保留、同一ウィンドウは 30 秒に 3 回まで。3 レイアウト×3 ケースほかを実機検証。Issue #48 のクローズは次回リリース時 |
| 単発 | [ax-title-observer.md](.claude/addf/plans/ax-title-observer.md) | **完了（2026-10-23）**。AXObserver でタイトル変化・ウィンドウ増減を検知（タブ切替・背面アプリ・Cmd+N/W が約 1 秒で反映）。デバウンスの最大待ち時間と差分 emit 抑止を追加。Terminal / Finder / Safari / VS Code / SIGSTOP 中アプリで実機検証、インストール版へ反映済み。副産物: install-app の起動中アプリ終了の不具合を修正 |
| 単発 | [spaces-all-desktops-visibility.md](.claude/addf/plans/spaces-all-desktops-visibility.md) | **完了（2026-07-16）**。仮想デスクトップ切替でタスクバーが2枚目以降に出ないバグを visible_on_all_workspaces(true) で修正。CGWindowList probe の A/B 機械検証＋オーナー実機確認済み（「よさそうー」）。副産物: install-app スクリプト刷新（bundle.targets に app 追加・dmg 抽出フォールバック） |
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
