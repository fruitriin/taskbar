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

### 現在のタスク: app-window-grouping（同一アプリのウィンドウグルーピングと並び順制御）

計画: `docs/plans/app-window-grouping.md`

#### サブタスクチェックリスト

- [x] utils.ts に純関数（グルーピング＋アプリ内ソート＋appOrder 解決）を実装
- [x] ユニットテスト作成（src/renderer/tests/window-sort.test.ts、16件）
- [x] store.ts に appOrder を追加（defaults・migration '>=2.1.1'・型）
- [x] index.vue の centerWindows に純関数を適用（出現順トラッキング込み）
- [x] タスクバー上の D&D（HTML5 DnD）で appOrder 並び替え・永続化
- [x] Stage 1: mise run test / test:renderer / typecheck / lint
- [x] Stage 2: addf-code-review-agent + addf-contribution-agent
- [x] Plan へ実装状況反映・ノウハウ・Feedback・アーカイブ・コミット

#### 日記

##### 2026-07-05 — タスク開始・現状調査完了
**やったこと**: 計画選択（オーナー指示で app-window-grouping）。コード調査で判明: option.vue に「並び順」select は実装済み（起動順/座標順、setOptions 保存も動く）。未実装なのはタスクバー側 — centerWindows は Helper 送信順のまま無ソート。vuedraggable は headers/footers 設定 UI で使用実績あり。
**今の見立て**: 計画ステップ3（設定UI）はほぼ完了済みなのでスキップ可。本体は utils.ts 純関数 + index.vue 適用 + D&D。確信度8割。
**次の自分へ**: 純関数 → テスト → store → index.vue の順。D&D は HTML5 ネイティブ（タスクバー側は vuedraggable のネスト構造が grid レイアウトと相性悪いため）。
**気になっていること**: 既存ストアに appOrder が無い場合のフォールバック（?? []）を忘れない。electron-store の defaults は options キーが既存だと効かない。

##### 2026-07-05 — 実装完了・Stage 1 通過
**やったこと**: utils.ts に sortWindowsInApp / groupWindowsByApp / moveApp を実装、テスト16件。index.vue の centerWindows にグルーピング適用＋HTML5 DnD で appOrder 永続化。store.ts に appOrder（defaults + '>=2.1.1' migration）。Stage 1 で既存不備を2件修正: (1) typecheck:node が bun:test 型欠如で常時失敗 → @types/bun 追加 + tsconfig types に "bun"、(2) lint エラー15件（electron-mocks の返り値型など、全て既存） → 修正して 0 errors。
**今の見立て**: 機能実装は完了。mise run build の失敗は Swift Helper バイナリ未ビルドの環境要因で、electron-vite build 単体は成功。確信度9割。
**次の自分へ**: Stage 2（code-review + contribution agent）の結果対応 → Plan 反映 → knowhow → Feedback → アーカイブ → コミット。
**気になっていること**: package.json の riinlogger（file:../RiinLogger、実体なし・コメントアウト import のみ）が bun install で毎回1件失敗を出す。Feedback に記録済み。D&D の実機確認は未実施（Playwright MCP 未接続のため）。

##### 2026-07-05 — Stage 2 前半完了（contribution agent）
**やったこと**: addf-contribution-agent 完了 — アップストリーム候補なし、分離パターン違反なし（全変更がプロジェクト固有のドメインロジックと判定）。Feedback.md に riinlogger と build の環境問題を記録済み。
**今の見立て**: 残りは code-review agent の結果対応のみ。指摘が Critical/High ならフェーズ内修正 → Stage 1 再実行。
**次の自分へ**: code-review 結果 → 修正 → Plan の実装状況ヘッダを「実装済み（D&D 実機確認は残）」に更新 → knowhow 記録（electron-store defaults の浅マージ、bun:test 型、center エリア無ソートの発見）→ アーカイブ（.claude/Progresses/2026-07-05-app-window-grouping.md）→ コミット（[renderer] 主体）。コミットは機能分と ADDF 導入分を分けること。
**気になっていること**: コミット時、ADDF 導入分（.claude/ ほか大量）と機能分の分離を git add で丁寧にやる必要がある。

##### 2026-07-05 — Stage 2 完了・レビュー指摘対応・タスク完了
**やったこと**: code-review agent の指摘（Critical 0 / Warning 2 / Medium 3 / Low 6）のうち Warning・Medium 全件と Low 4件を修正: (1) migration `>=2.1.1` の発火条件を Plan と knowhow に明記＋migration テスト2件追加、(2) グループ順フォールバックを最小 kCGWindowNumber 昇順の決定的ルールに変更（マルチディスプレイ収束）、(3) D&D を dataTransfer 経由にしてクロスウィンドウ対応、(4) buildAppOrder 切り出しで非表示アプリの位置温存＋テスト、(5) sortWindowsInApp をオプションオブジェクト化、(6) dragend で状態リセット、(7) createStoreMock を Store 型に。レビューの Info「並び順トグル UI 未実装」は誤指摘（option.vue 28-40 行に既存）。Stage 1 再実行オールグリーン（テスト65件・型0・lint 0 errors）。knowhow 2件記録、TODO アーカイブ更新。
**今の見立て**: タスク完了。残課題はリリース時 version 2.1.1+ と D&D 実機確認のみ（Plan・TODO に記録済み）。
**次の自分へ**: コミットは3分割（[addf] 導入 / [docs] 計画集約 / [renderer] 機能）で実施。
**気になっていること**: Low #9（Options 型の main/renderer 二重管理）は未対応。次に options へフィールドを足すときに統一を検討。

> 新しいタスク開始時は以下の構造で記録する:
> `### 現在のタスク: <Plan 名>` → `#### サブタスクチェックリスト` → `#### 日記`（運用ルール 3.5 の4項目書式）
