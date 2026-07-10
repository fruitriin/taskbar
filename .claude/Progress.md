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

### 現在のタスク: rearch-phase3（Tauri v2 移行・一気通貫）

計画: `docs/plans/rearch-phase3.md`（鮮度更新済み・進め方はキックオフ案どおり）
ブランチ: **rearch/tauri-v2**（master は凍結維持。途中ビルド不通を許容）

#### サブタスクチェックリスト（3.1〜3.5 はサブタスク単位で checkpoint コミット）

- [x] 3.1 Tauri 初期化 **完了（2026-07-10）**: scaffold・tauri 2.11.3・tauri.conf.json（taskbar ウィンドウ /?view=taskbar）・プレーン vite 併存・cargo check 通過
- [x] 3.2 Rust 基盤 **完了（2026-07-10）**: window_manager・filter・observer・commands 22本・store.rs。Rust テスト23件。AX/権限/アイコンは 3.3 スタブ
- [x] 3.3 Rust 機能 **完了（2026-07-10）**: window_actions・permission_manager・icon_manager・display_manager。Rust テスト35件（実機 ignored 4）
- [x] 3.4 フロント接続 **完了（2026-07-10）**: ipc.ts ランタイム切替・ARG_KEYS 変換・データ移行（Rust 冪等）・get_options 新設・option.vue の window.store 非依存化。**実機初起動待ち**
- [ ] 3.5 統合: 動作確認（実機3ポイント）・署名/notarize・テスト移植・Electron/Swift 削除・ドキュメント更新
- [ ] 完了条件: rearch-phase3.md 末尾のリスト

#### 日記

##### 2026-07-10 — キックオフ（オーナー「phase3やっちゃお」）
**やったこと**: Q4 反映（swiftFilter/autoUpdate クローズ込み）、ブランチ rearch/tauri-v2 作成。Rust 1.94（asdf）確認済み。
**今の見立て**: 3.1 から。コンテキスト90万超で compaction 必至 — 以降の代は本チェックリストと計画の鮮度更新節が羅針盤。
**次の自分へ**: (1) 実機確認3ポイント（3.2 後/3.4 後/3.5）ではオーナーに声かけ。(2) レビューエージェント起動時は「MCP 指示無視」定型文（Feedback.md 2026-07-06 の改善版文面）を必ず使う。(3) Rust コードのゲートは cargo check/clippy/test を Stage 1 に加える。(4) 毎時ループ再開済み（アイドル時はここまでの慣例どおり最小チェック）。
**気になっていること**: tauri CLI の scaffold が既存リポジトリ構成（src/renderer）とどう馴染むか。frontendDist は out/renderer でなく dist に統一予定（計画どおり）。

##### 2026-07-10 — 3.1 完了、次は 3.2
**やったこと**: scaffold 一式＋cargo check 通過。vite.config.ts は root=src/renderer で dist 出力、electron-vite と併存。
**次の自分へ**: 3.2 は (1) `cargo add objc2 objc2-core-graphics objc2-app-kit objc2-accessibility` を機能フラグ付きで（計画のフラグ名は3月時点 — cargo/docs.rs で現行名を確認）(2) 移植順は window_manager → commands（最初は window_ready と get_windows だけの縦切り）→ filter → observer。Swift 原本は nativeSrc/taskbar.helper/main.swift（行範囲は計画に記載）(3) Rust ゲート: cargo check + clippy + test を Stage 1 に追加 (4) 縦切りが通ったら `bun run tauri:dev` で実機スモーク（オーナー声かけポイント1）。
**気になっていること**: CGWindowList 系 API の objc2 バインディングの成熟度。ダメなら core-graphics crate か直接 FFI にフォールバック。

##### 2026-07-10 — 3.2 縦切り第1弾完了（委譲パターン確立）
**やったこと**: window_manager.rs（CGWindowList 移植・serde キー名一致・UE 対策）＋ get_windows コマンドを general-purpose エージェント委譲で実装。全ゲート＋実機疎通（WindowServer 取得 0.04s）。objc2-core-foundation で CF パース、Value→MacWindow 変換を純関数化。
**今の見立て**: 委譲＋ゲート反復のパターンが機能する。3.2 残: filter.rs / window_observer.rs（NSWorkspace 通知＋500ms デバウンス・windows-updated emit）/ 残りコマンド。
**次の自分へ**: 次サイクルは filter.rs（Swift main.swift:123-459。labeledFilters の構造は src/renderer/src/types.ts の LabeledFilters と一致させる）と window_observer.rs を同じ委譲パターンで。observer は AppHandle 経由の emit が必要なので tauri::AppHandle を持つ設計に。その次で commands 残り（20チャンネル一覧は計画の鮮度更新節）を一括。
**気になっていること**: NSWorkspace 通知の objc2-app-kit バインディング（ブロックベース observer）。

##### 2026-07-10 — 3.2 第2弾完了（filter + observer）
**やったこと**: filter.rs（判定表コメント＋テスト11件、原本の死んだ X/Y/W/H 条件を発見→Feedback 記録）と window_observer.rs（block observer → trailing デバウンス500ms → 'process' emit、仮想時計テスト）。Rust テスト計17件。
**今の見立て**: 3.2 残は commands 一括（20チャンネル）と、observer→store 連携（フィルタ設定の実読み込み、現状空スライス TODO）。
**次の自分へ**: 次サイクルは commands.rs 一括実装を委譲: 20チャンネルの対応表は計画の鮮度更新節。設計指針: (1) setOptions/getLabeledFilters 系は tauri-plugin-store 直結（store.rs ヘルパー経由）(2) activeWindow/closeWindow は window_actions.rs（AXUIElement — 3.3 の前倒し）が必要なので、このサイクルでは**スタブ（todo!() でなく Err("not implemented")）にして配線だけ**先に通すのも可 (3) windowReady は observer の refresh_and_emit を即時1回呼ぶ＋displayInfo/updateOptions/iconUpdate の初期 emit (4) restart/exit は tauri の app handle 経由。
**気になっていること**: フィルタ設定の JSON 形（electron-store の labeledFilters）と tauri-plugin-store のキー設計。3.4 のデータ移行と整合させること。

##### 2026-07-10 — 3.2 完了
**やったこと**: commands 22本＋store.rs（委譲第3弾）。DIP 変換・store 共有インスタンス等の重要判断はコミットメッセージとコード内に記録。
**今の見立て**: 実機確認ポイント1は計画では「3.2 後」だが、フロントがまだ electron モックで動くため実質の疎通確認は 3.4 後が妥当 → **確認ポイントを 3.4 後に統合**（計画から の逸脱、ここに記録）。
**次の自分へ**: 次は 3.3 を2分割で委譲: (a) window_actions.rs（AXUIElement で activate/close — Swift の AppleScript 置換）+ permission_manager.rs（AXIsProcessTrusted / SCShareableContent 100ms timeout）でスタブ解消 (b) icon_manager.rs（NSRunningApplication.icon → png base64、FS キャッシュ ~/Library/Application Support/taskbar.fm/icons/、段階ロード）+ マルチディスプレイ（displayInfo の複数モニタ＋ウィンドウ動的生成）。
**気になっていること**: AX 操作は実機でしか本当の検証ができない（アクセシビリティ権限必要）。ユニットは構造のみ、実挙動は 3.4 後の実機で。

##### 2026-07-10 — 3.3 前半完了（AX＋権限）
**やったこと**: window_actions / permission_manager（委譲第4弾）。スタブ5本解消。Rust テスト26件。
**次の自分へ**: 次は 3.3 後半: icon_manager.rs（NSRunningApplication.icon → png base64 'data:image/png;base64,' 形式はフロント updateWindowIcons の期待形 = icons[owner] の生 base64。**events.ts の iconUpdate ペイロード形（Record<owner置換名, base64>）を必ず確認**。owner 名の置換規則 /\//g→_ と / /g→'' も再現）＋FS キャッシュ＋段階ロード、マルチディスプレイ（displayInfo 複数化・taskbar ウィンドウの動的生成・layout 位置計算 — Electron 版 windows.ts の windowPosition を原本に）。その次が 3.4（ipc.ts 差し替え・useOptions・electron-store データ移行・モック）→ 実機確認ポイント。
**気になっていること**: 実機 ignored テスト4本は 3.4 後の実機確認でまとめて回す。

##### 2026-07-10 — 3.3 完了（Rust 側全機能そろう）
**やったこと**: icon_manager＋display_manager（委譲第5弾）。残る Rust TODO は context_task/context_logo の配置調整（3.4）と restart_helper 整理（3.5）のみ。
**次の自分へ**: 3.4 はフロント側なので委譲でなく自分でやる方が速い可能性が高い（ipc.ts は30行、useOptions 差し替え、electron-store→tauri-plugin-store データ移行、tauri-mocks）。手順: (1) ipc.ts を @tauri-apps/api（invoke/listen/emit）実装に差し替え — ipcSend は「コマンド名 = チャンネル名の snake_case 変換」が必要（commands.rs の対応表参照: activeWindow→active_window 等）。引数も Electron の位置引数から Tauri の名前付き引数への変換が要る — **ここが 3.4 最大の設計点**（コマンドごとの引数名マップを ipc.ts に持つ）(2) useOptions は 'updateOptions' listen＋set_options invoke で実は現行のまま動くかも — 要確認 (3) データ移行: 旧 electron-store の userData/config.json を読む Rust コマンド or 初回起動時に旧パス（~/Library/Application Support/taskbar.fm/config.json — electron の userData パスを確認）から tauri store へコピー (4) mocks: electron-mocks を tauri-mocks に（window.__TAURI_INTERNALS__ モック or ipc.ts レベルでモック分岐 — 後者が簡単）。
**気になっていること**: フロントは window.electron 前提の型（utils.ts declare global）。3.4 で ElectronAPI 型依存を抜く。

##### 2026-07-10 — 3.4 完了、実機確認ポイント到達
**やったこと**: ipc.ts 差し替え（自作業）＋移行＋get_options。全ゲート緑（Rust 37 / front 104 / 両ビルド）。
**次の自分へ**: オーナーの実機確認待ち: `bun run tauri:dev`。確認観点: (1) タスクバーが各ディスプレイに出るか (2) ウィンドウリスト表示（本物のデータ！）(3) クリックでアクティブ化（AX 権限プロンプト→許可後）(4) 設定画面（ロゴ→設定）とフィルター (5) D&D (6) 旧設定（appOrder 等）が移行されているか。問題が出たらログは tauri_plugin_log（stdout）。cargo test -- --ignored の実機4本も。OK が出たら 3.5（統合・Electron/Swift 削除・署名・ドキュメント）。ElectronAPI 型依存（utils.ts declare global）と Electron.listen 残骸の掃除も 3.5 で。
**気になっていること**: 初回 tauri dev は Rust の release ビルドで数分かかる。menu ウィンドウのカーソル位置配置は TODO(3.4) のまま（固定位置）— 実機確認で気になれば調整。

> 新しいタスク開始時は以下の構造で記録する:
> `### 現在のタスク: <Plan 名>` → `#### サブタスクチェックリスト` → `#### 日記`（運用ルール 3.5 の4項目書式）
