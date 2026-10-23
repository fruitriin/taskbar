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

- 2026-10-23（ax-title-observer）: `scripts/install-app.sh` が起動中のアプリを `pgrep -x "taskbar.fm"` で探していたが、実行ファイル名は `app` のため一致せず、旧バイナリが動き続けたまま `open` で前面化されるだけだった（入れ替えたつもりで旧版が動く）。インストール先パスで `pkill -f` する形に修正済み。osascript の quit は自動操作の許可待ちで止まり得るため使わない。**改善アクション**: アプリの入れ替え後は `ps -o lstart` で起動時刻を、`cmp` でバイナリの一致を確認する
- 2026-10-23（ax-title-observer）: 「開発環境は Linux」と書かれた Plan がクラウドセッションから来たが、実際はローカル Mac で実機検証できた。**改善アクション**: 別環境で起票された Plan は、着手時に検証手段の前提（実機の有無・ブランチの分岐元）を確かめ直す。今回は分岐元が未 push の master より 17 コミット古く、Plan の置き場所（docs/plans → .claude/addf/plans）もずれていた

- 2026-07-16（spaces-all-desktops-visibility、ADDF 本体へのコントリビューション候補、contribution agent 検出・オーナー判断待ち）: 「主観フィードバックが収束しないときの実測プローブ選定」を ADDF ガイド層（development-process.md 相当）へ汎化する提案。Web 側（cdp-headless-e2e-probe.md）とネイティブ側（macos-spaces-window-visibility.md）で同じ型 —「ドメイン別の実測プローブ＋修正前後の A/B 比較＋対照群設計」— が2回連続で独立に発生しており再現性が裏付けられた。具体技術はダウンストリーム knowhow に留め、方法論のみ抽象度を上げて本体へ、が分離規約と整合

- 2026-07-14（Phase 3.5 レビュー知見）: 委譲実装＋全ゲート緑でも Critical は残りうる（信頼境界・並行性はゲートで検出できない）。**危険な副作用を持つ Tauri コマンドを新設・委譲するときは、依頼文に「クライアント供給値をサーバー側データと照合すること」を要件として明記する**（詳細は .claude/addf/knowhow/tauri-trust-boundary-and-native-menu.md）

- 2026-07-14（ADDF 本体へのコントリビューション候補、contribution agent 検出・オーナー判断待ち）:
  1. アーカイブタグ運用（大規模削除前の `<stack>-final` タグ）を CLAUDE.md/ProgressTemplate に明文化
  2. 実機確認往復の「第Nラウンド」日記書式を ProgressTemplate の日記ガイドに追記
  3. addf-permission-audit に「参照先が存在しない廃止ツール権限のプルーニング検出」ステップを追加
  4. rust-port-delegation.md を「言語間移植委譲の一般パターン」として ADDF knowhow に汎化（次に類似移植が起きた時点で）

- 2026-07-14: リリース CI（.github/workflows/release.yml の tauri-action 化）は**次のタグ push まで未検証**。初回リリース時は GitHub Actions のログを必ず確認する。Secrets の CERT が Developer ID Application の p12 であることも要確認（旧 electron-builder 時代の値のままか不明）


- 2026-07-07: 2-B（フォーマッタ交換）で Stage 2 レビューエージェントを意図的にスキップした（機械的変更で失敗モードが4ゲートに直接現れるため）。プロセスの例外適用。基準に異論があればオーナーが差し戻してよい

- 2026-07-05: 新しい electron-store マイグレーションを追加したら、リリース時に package.json の version がマイグレーションキーを満たすことを確認する（今回 `>=2.1.1` を追加、現行 2.1.0。詳細は `.claude/addf/knowhow/electron-store-migration.md`）

- 2026-07-15（group-drag-swap-fix）: Playwright MCP がセッションに未接続の状態でフロントエンドD&D/アニメーション系の実装を行った。ブラウザ自動化なしでは視覚検証ができないため、`bun run dev`（Tauri実機）を起動しオーナーとの対話的フィードバックループ（6往復程度）で検証した。事前に懸念していたリスク（CSS レイアウト崩れ）は実際には起きず、代わりに事前に想定していなかった種類の不具合（ゴーストの軸ブレ・rAFとVue TransitionGroup FLIPの競合・入れ子TransitionGroupのname衝突・スクロールバー・オーバーシュート時のスワップ不可）が7件見つかった。いずれも机上のコードレビューでは検出不能だった。**改善アクション**: フロントエンドのD&D/アニメーション系タスクをPlan化する際は「実機確認は複数往復が前提」と明記し、一括実装→一括確認ではなく小さい差分ごとに確認するサイクルを組み込む（`addf-dev.exp.md` に分かれ道の目印として記録済み）。Playwright MCP接続の有無を確認する手順をタスク開始時のチェック項目に加える余地もある

- 2026-07-16（group-drag-swap-fix 続き）: アニメーション速度について「体感」のフィードバックだけを頼りに150→220→800msと調整を繰り返したが収束しなかった（オーナーからは「早すぎる」「アニメーションしているように見えない」の両方の指摘が出て、何が正しいか判断できない状態に陥った）。Playwright MCP不在でも Chrome DevTools Protocol を素の Node.js（`node:child_process` + グローバル `WebSocket`）で直接叩けば実測できることに気づき、`bun run dev:web` にモックデータを注入・合成PointerEventでドラッグを再現し `transitionrun`/`transitionend` を計測したところ、設定値とほぼ一致する時間で正しく完走していた（メカニズムは壊れていなかった）。**改善アクション**: 主観的な「速い/遅い/効いてない」系のフィードバックが2往復以上収束しない兆候が出たら、早めに客観的な実測手段に切り替える（今回はCDP直叩き。手順は `.claude/addf/knowhow/cdp-headless-e2e-probe.md` に一般化して記録済み）。体感だけでパラメータを弄り続けるのは遠回りになりやすい

## 完了済み
