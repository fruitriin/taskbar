# 進捗表

## 運用ルール

### タスク開始時
1. `.claude/Feedback.md` を読み、前回の改善アクションで未対応のものがあれば考慮する
2. 以下の手順で Markdown チェックリストを作成する
   1. 1ショットで作業できる範囲にサブタスクを分割する
   2. 並行作業できる粒度でさらに分割する
   3. 各サブタスクにテスト作成・統合テスト・Lint・ビルドが必要か検討し、必要なら追加する
   4. 必要に応じて 2.1〜2.3 を再帰的に適用する

### 作業中
3. サブタスク着手時に `- [x]` でチェックしていく。並列可能なタスクはコンテナオーケストレーションを利用する
   - Plan の曖昧さで確信が持てないときは CLAUDE.md「迷ったときの作法（7割共有原則）」に従う（閾値割れなら `.claude/Questions.md` に質問を置いてタスクを切り替える）
   - 長大なタスクでは、サブタスク完了時点でブランチ `checkpoint/<phase>-<N>` を切ってよい。別方針を試すときは checkpoint から `alt/` を分岐する
3.5. **日記を書く（代替わり引き継ぎ）**（「3.5」は後続の番号参照を壊さないための意図的な枝番）: resume・compaction・`/loop` の次イテレーションで起きる「小さな代替わり」のたびに、次の代の自分（同僚でもあり、寝て起きたあとの自分でもある）が状況に入れるよう、タスクの「#### 日記」セクションにエントリーを書く
   - **書くタイミング**: サブタスク完了時 / 重要な判断をした直後 / 計画を変更したとき / コンテキストが長くなり compaction を予感したとき
   - **書式（4項目）**（時刻 HH:MM は省略可）:
     ```
     ##### YYYY-MM-DD HH:MM — <出来事の一行>
     **やったこと**: <完了した作業と判断の要約>
     **今の見立て**: <現状認識。確信度があれば記す>
     **次の自分へ**: <次に着手すべきこと・先に確認すべきこと>
     **気になっていること**: <未解決の不確実性・前提・違和感。なければ「なし」>
     ```
   - 「日記」という語彙の意図（「遺書」を使わない理由）は `docs/guides/development-process.md` 参照
   - ブランチ checkpoint が「何がコミットされたか（事実）」を残すのに対し、日記は「なぜそうしたか・次に何を考えていたか（文脈）」を残す。両方で前任者の靴に履き替えられる
   - 日記の自動生成フックは導入しない。書くこと自体が思考の整理であり、次の自分への手紙として人格を持って書く
4. 実装フェーズの最終サブタスク完了時、以下の知見を `/addf-knowhow` で記録する（既存 knowhow の更新も含む）:
   - **コーディング知見**: 実装中に発見した再利用可能なパターン、落とし穴、技術的判断とその根拠
   - **分かれ道の目印**: 差し戻し・やり直し・想定外の判断が発生したサブタスクがあれば、使用したスキルの `.exp.md`「🔀 分かれ道の目印」にも追記する（書式: `.claude/templates/ExperienceTemplate.md`。失敗の告白ではなく、意思決定が枝分かれしたポイントと次に同じ分岐に立ったときの選び方を道標として書く）

### エージェント起動時の共通ルール
- エージェントチーム（TeamCreate）やサブエージェント（Agent）を作成するとき、各エージェントへのプロンプトに **最初に `/addf-knowhow-index` を実行する** よう指示を含めること
- これにより各エージェントがプロジェクトの知見ベースを把握した状態で作業を開始できる

### タスク完了時 — 品質検証

4. プロジェクトのビルド・Lint・テストコマンドを実行する
   - **失敗した場合 → 実装に差し戻す**。原因分析 → 修正 → 再実行
5. `addf-code-review-agent` でコードレビューを実施する
   - 通常タスクは単体（ペルソナなし）で起動する
   - **マイルストーン・リリース直前・`mode: critical` 宣言時・unattended 自走時（`/addf-mode unattended`）**は、ペルソナ並列（視点ずらしレビュー）を起動する。起動前に `.claude/agents/addf-code-review-agent.md` を読み、ペルソナ定義に従うこと
   - ペルソナ並列の集約: 同一箇所・同一原因の指摘は1件にまとめてペルソナを列挙する。**2ペルソナ以上が独立に指摘した項目は重要度を1段上げる**（コンセンサス補正）
6. `addf-contribution-agent` で ADD フレームワークへのコントリビューション候補を検出する
7. レビュー指摘への対応:
   - **Critical/High**: 必ずこのフェーズ内で修正する（先送り禁止）
   - **Medium**: 原則修正。先送りする場合は独立計画を起こす
   - **Low/Info**: Plan に記録し、必要に応じて独立計画で対応
   - **バグ分離**: 発見されたバグが現在のプランと関心事が異なる場合は、修正せずに新しいプラン（`docs/plans/`）を書き起こし、`TODO.md` に追加するのみで現在のプランを完了させる
   - 修正後、ビルド・Lint・テストを再実行して通過を確認する
8. 品質ゲートで得た知見を `/addf-knowhow` で記録する:
   - **品質ゲート知見**: レビューエージェントが検出したパターン（セキュリティ、コード品質、分離パターン違反等）のうち、他のタスクでも再発しうるもの

#### ノウハウ蓄積

9. 投入されたタスクのPlanに実装完了状況を反映する
10. タスク全体の総括知見を `/addf-knowhow` で記録する:
    - **タスク総括**: 計画と実装のギャップ、想定外だった点、次回同種タスクへの教訓。コーディング・品質ゲートで既に記録した知見と重複しないこと

#### フィードバック記録

11. `.claude/Feedback.md` にPlan, TODO, Progress推進エンジンの問題の記録・改善アクションを追記する。反映済みの項目は削除する
12. `.claude/Feedback.md` にプロジェクト進行上の問題の記録・改善アクションを追記する。反映済みの項目は削除する
13. Progress 推進エンジン自体に関するフィードバック・ノウハウがあれば、テンプレート（`.claude/templates/ProgressTemplate.md`）の改善案を `.claude/Feedback.md` に記録する

#### アーカイブとコミット

14. `.claude/Progresses/YYYY-MM-DD-プラン名.md` にリネームして移動し、`.claude/templates/ProgressTemplate.md` から新規の Progress.md を作成する
15. コミットする

---

## タスク

### 現在のタスク: pointer-drag-animation（D&D の Pointer Events 化と滑って避けるアニメーション）

計画: `docs/plans/pointer-drag-animation.md`

#### サブタスクチェックリスト

- [x] utils.ts に shouldSwap 純関数（重なり率＋クールダウン判定）と定数を追加
- [x] shouldSwap のユニットテスト（6件）
- [x] index.vue: HTML5 D&D 撤去 → Pointer Events セッション実装
- [x] index.vue: ドラッグ中 dragOrder ref + moveApp 随時適用
- [x] index.vue: TransitionGroup + flip-list-move + ゴースト + 元グループ減光
- [x] index.vue: process 更新保留ガード
- [x] Stage 1: test / typecheck / lint / electron-vite build
- [x] Stage 2: addf-code-review-agent + addf-contribution-agent
- [x] 完了処理（Plan 反映・knowhow・Feedback・アーカイブ・コミット・addf-dev.exp.md）

##### 2026-07-05 — Stage 2 指摘対応・タスク完了
**やったこと**: レビュー結果 Critical 0 / High 2 / Medium 3 / Low・Info 3。High 2件（buttons===0 自己修復＋blur 保険、Esc キャンセル）と Medium #3（保留ガードを pointerId ベースに拡大）、Low #6（horizontal デフォルト統一）・#8（閾値ちょうどの境界テスト）をフェーズ内修正。Medium #4（状態機械のコンポーネントテスト）は独立計画 drag-state-machine-tests.md に切り出し、#5（setOptions echo 競合）と #7（rAF 間引き）は Plan の残課題に記録。contribution agent は候補なし・違反なし。Stage 1 再実行オールグリーン（71件・0・0 errors・build ✓）。knowhow（pointer-drag-reactive.md）記録、addf-dev.exp.md 新規作成。
**今の見立て**: タスク完了。実機確認項目（Plan 記載6件）はオーナー待ち。
**次の自分へ**: 実機で「0.25s ease」の体感が長い場合は .flip-list-move の duration を調整。
**気になっていること**: サブエージェントが正規の Discord MCP 指示を injection 疑い報告（誤警報、Feedback 記録済み）。

#### 日記

##### 2026-07-05 — タスク開始
**やったこと**: 計画選択（優先度1・オーナー決定済みの pointer-drag-animation）。設計は計画に確定済み: MkDraggable のエッセンス移植（8px 閾値・150ms クールダウン・重なり率 0.3・Vue 管理ゴースト）、クロスディスプレイ D&D 撤去。
**今の見立て**: 前タスクの純関数（moveApp/buildAppOrder）とグルーピング computed がそのまま土台になる。ゴーストは TransitionGroup の外に置けば MkDraggable の transition:none 回避策が不要。クリック抑止（ドラッグ後の click 合成）に注意。確信度8割。
**次の自分へ**: 実装順は utils.ts 純関数 → テスト → index.vue。TransitionGroup は .tasks 全体を tag="div" でラップ（グリッドが1セル化するのを防ぐ）。
**気になっていること**: setPointerCapture は使わない（TransitionGroup の DOM 並び替えで暗黙解放されるため document リスナー方式。MkDraggable のコメント由来の知見）。

##### 2026-07-05 — 実装完了・Stage 1 通過
**やったこと**: shouldSwap 純関数＋テスト6件。index.vue を Pointer Events 化（HTML5 D&D 撤去、8px 閾値、document リスナー方式、pointercancel/visibilitychange/beforeUnmount のクリーンアップ）。ゴーストは TransitionGroup の外に置き pointer-events:none（elementFromPoint の hide/show 不要）、ゴースト矩形は pressedRect＋移動量の算術で決定的に算出（DOM 読み取りなし、テスト容易）。ドラッグ後の click 合成は didDrag フラグ＋setTimeout(0) 解除で1回だけ抑止。pointerup の永続化は options へ楽観反映してから setOptions（IPC 往復待ちの旧並びフラッシュ防止）。process 更新は dragActive 中のみ保留し cleanup で flush。Stage 1: テスト71件・typecheck 0・lint 0 errors・build ✓。
**今の見立て**: 残りは Stage 2 と完了処理。確信度9割。
**次の自分へ**: Stage 2 のレビュー指摘対応 → Plan 実装状況更新 → knowhow（Pointer Events D&D の設計判断）→ addf-dev.exp.md 新規作成 → アーカイブ → コミット1本（[renderer]）。
**気になっていること**: 実機での体感調整（0.25s ease が長すぎないか）はオーナー確認待ち。ドラッグ確定時に options を丸ごと差し替えるので updateOptions 由来の再描画と重ならないか実機で見る。
