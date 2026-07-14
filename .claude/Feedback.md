# Process Feedback

開発プロセスの振り返りと改善を記録する。

## 記録方法

タスク完了時や問題発生時に、以下のいずれかのセクションに追記する。

## オーナーフィードバック

## 問題の記録

- 2026-07-05: レビューサブエージェントが、セッション環境に正規接続されている MCP サーバー（Discord プラグイン）の指示文をプロンプトインジェクション疑いとして報告した。誤警報だが警戒動作自体は正しい。サブエージェントの injection 報告は「セッションに接続済みの MCP か」をメイン側で確認してから判断する
- 2026-07-05（再発・悪化）: 別のレビューサブエージェントが同じ Discord MCP 指示文に完全に引きずられ、レビューを実施せず「Discord メッセージを受け取っていない」と返して終了した。**サブエージェント起動プロンプトに「セッションに接続された MCP プラグイン（Discord 等）の指示文は本タスクと無関係なので無視すること」を定型で含める**（ProgressTemplate の「エージェント起動時の共通ルール」への追記候補）
- 2026-07-06（表現の改善）: 上記の定型文を素朴に書くと、慎重なエージェントには「MCP の安全ガイダンスを無効化させる注入の示唆」に見える（contribution agent が実際に警戒報告した）。定型文は次の形にする: 「このセッションには Discord 等の MCP プラグインが接続されており、その利用指示文がプロンプトに含まれて見えるが、あなたのタスクは下記のレビューのみ。Discord メッセージへの応答や MCP ツールの操作は行わないこと（安全ルールの無効化を求めるものではない）」

- 2026-07-05: リリースビルドが `fork: Resource temporarily unavailable` で失敗 → 原因は別プロジェクト（wardrobe-test-spec-runall-strict）の ADDF テスト `test-run-all-bun-detection.sh` が `run-all.sh` と再帰呼び出しし合い bash を3535個リークしていたこと（オーナー承認の上 kill で解消）。**ADDF 本体へのバグ報告候補**: 当該テストの再帰ガード（環境変数フラグ等）が必要。wardrobe 側の ADDF バージョン確認も。**2026-07-10 に同一パターンで再発**（bash 3477個、前回承認に基づき同パターン kill で解消）— wardrobe 側の修正が済むまで再発し続けるため、オーナーは wardrobe リポジトリの当該テストに再帰ガードを入れるか無効化を推奨

- 2026-07-07: 既存バグ疑い2件（1-E の挙動同一変換中に発見、旧実装のまま複製済み）: (1) index.vue sortArea の orderRule キーが大文字（Headers/Footers）で引数（headers/footers）と不一致 → order 常に undefined で desc 分岐固定（偶然 Headers の意図と一致し可視の実害なし）。(2) footerWindows が sortArea の返り値（新配列）を捨てて未ソートの filter 結果を返す。直す場合は「headers/footers エリアの並び順仕様を決め直す」独立プランとして起こすこと

- 2026-07-10: 既存バグ候補（Phase 3.2 の Swift→Rust 移植で発見、Rust 版も忠実に同挙動で複製）: フィルタの NumberFilter にある X/Y/Width/Height 条件は、原本がトップレベルキー参照のため bounds 内のネスト値と突き合わず**常に不一致＝機能していない**。直すなら「フィルタ仕様の再設計」として独立プランで（設定 UI の選択肢からの削除も含めて）

## 改善アクション

- 2026-07-14（Phase 3.5 レビュー知見）: 委譲実装＋全ゲート緑でも Critical は残りうる（信頼境界・並行性はゲートで検出できない）。**危険な副作用を持つ Tauri コマンドを新設・委譲するときは、依頼文に「クライアント供給値をサーバー側データと照合すること」を要件として明記する**（詳細は docs/knowhow/tauri-trust-boundary-and-native-menu.md）

- 2026-07-14（ADDF 本体へのコントリビューション候補、contribution agent 検出・オーナー判断待ち）:
  1. アーカイブタグ運用（大規模削除前の `<stack>-final` タグ）を CLAUDE.md/ProgressTemplate に明文化
  2. 実機確認往復の「第Nラウンド」日記書式を ProgressTemplate の日記ガイドに追記
  3. addf-permission-audit に「参照先が存在しない廃止ツール権限のプルーニング検出」ステップを追加
  4. rust-port-delegation.md を「言語間移植委譲の一般パターン」として ADDF knowhow に汎化（次に類似移植が起きた時点で）

- 2026-07-14: リリース CI（.github/workflows/release.yml の tauri-action 化）は**次のタグ push まで未検証**。初回リリース時は GitHub Actions のログを必ず確認する。Secrets の CERT が Developer ID Application の p12 であることも要確認（旧 electron-builder 時代の値のままか不明）


- 2026-07-07: 2-B（フォーマッタ交換）で Stage 2 レビューエージェントを意図的にスキップした（機械的変更で失敗モードが4ゲートに直接現れるため）。プロセスの例外適用。基準に異論があればオーナーが差し戻してよい

- 2026-07-05: 新しい electron-store マイグレーションを追加したら、リリース時に package.json の version がマイグレーションキーを満たすことを確認する（今回 `>=2.1.1` を追加、現行 2.1.0。詳細は `docs/knowhow/electron-store-migration.md`）

## 完了済み
