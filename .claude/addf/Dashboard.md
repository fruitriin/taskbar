# 前回セッションからの差分まとめ（ADDF 導入 2026-07-05 〜 2026-07-10）

## 完了

- **v2.1.1 リリース**（公証済み dmg / GitHub Release）— アプリグルーピング＋「滑って避ける」D&D
- **リアーキ Phase 1 完結**（8スライス）: Composition API 全面化・エントリー4→1統合（?view=）・UnoCSS 化・vue-router / pinia / bulma / less / dart-sass / vitest の6依存撤去
- **リアーキ Phase 2 完結**（5スライス）: lint=Oxlint・fmt=Oxfmt・test=bun test 継続・mise 廃止 → package.json scripts（bun run）
- **リアーキ Phase 3 進行中**（ブランチ rearch/tauri-v2、master 比 +17 コミット）:
  - 3.1 Tauri 初期化 ✅ / 3.2 Rust 基盤（22コマンド）✅ / 3.3 AX 操作・権限・アイコン・マルチディスプレイ ✅ / 3.4 フロント接続＋データ移行 ✅
  - 実機フィードバック5件（メニュー座標・blur クローズ・権限表示・環境設定ボタン・画像ドラッグ）修正済み
- 品質: フロントテスト104件＋Rust テスト37件＋実機用4件。ADDF コミット計48件

## 質問（未回答）

- Q3: アイドル時の投機開発（addf-speculate）を回すか — 急ぎではない
- **再実機確認待ち**: `bun run tauri:dev` で修正5件の確認（これが 3.5 着手のゲート）

## 気になった点

- **wardrobe-test-spec-runall-strict の ADDF テスト暴走が2回再発**（bash 3400個超でシステムのプロセス上限を圧迫）。wardrobe 側に再帰ガードを入れるまで再発します — 対処推奨
- Tauri 版の既知の残 TODO: context_task（タスク右クリックメニュー、現在ログのみ）、restart_helper の導線整理（3.5）
- 既存バグ候補2件を Feedback.md に記録済み（sortArea のキー不一致・フィルタの X/Y/W/H 条件が昔から不動作）

## 次のアクション

1. オーナー: `bun run tauri:dev` で修正5件を確認
2. OK → 3.5（Electron/Swift 完全削除・署名/notarize・テスト移植・ドキュメント刷新）で Phase 3 完結 → v3.0.0
3. ループ再開はいつでも `/loop 1h /addf-dev`
