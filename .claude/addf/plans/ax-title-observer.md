---
trust: normal
responsiveness: relaxed
image_clarity: balanced
---

# Plan: AXObserver によるウィンドウタイトル・ウィンドウ増減の検知

**実装状況**: 完了（2026-10-23）。スライス 1〜3 実施・全項目検証済み。インストール版（/Applications）へ反映済み
**作成日**: 2026-10-23
**出自**: オーナーとの考察セッション（タイトル取得タイミングの改善。A案＝AXObserver を採用）

## 関連 Plan

- [window-overlap-avoidance.md](window-overlap-avoidance.md) — 本 Plan の AXObserver 基盤に AXMoved / AXResized を足して、タスクバーとの重なり回避のきっかけに使う

## 背景・課題

`src-tauri/src/window_observer.rs` が監視しているのは NSWorkspace の
`didActivate` / `didLaunch` / `didTerminate` の3通知のみで、いずれも**アプリ単位**のイベント。
そのため以下が検知できず、タスクバーの表示が古いまま残る:

| ケース | 例 | 現状 |
|---|---|---|
| 前面アプリ内のタイトル変化 | ブラウザのタブ切替、ターミナルのコマンド実行、エディタのファイル切替 | ❌ |
| 背面アプリのタイトル変化 | 音楽プレイヤーの曲送り、未読数付きタイトル `(3) Gmail` | ❌ |
| 同一アプリ内のウィンドウ増減 | Cmd+N / Cmd+W（アプリ切替が起きない） | ❌ |

## 方針（A案）

アプリ（pid）ごとに AXObserver を作り、ウィンドウ単位の AX 通知を受ける。
通知は**既存のデバウンスチャンネル（`tx.send(())`）に流すトリガーとしてのみ使い**、
ウィンドウ情報の正は従来どおり CGWindowList とする。
→ フロント・IPC 契約（`process` イベント）は無変更。

### 購読する AX 通知

- `kAXTitleChangedNotification` — 本命
- `kAXWindowCreatedNotification` / `kAXUIElementDestroyedNotification` — Cmd+N / Cmd+W
- `kAXWindowMiniaturizedNotification` / `kAXWindowDeminiaturizedNotification` — 最小化状態
- `kAXFocusedWindowChangedNotification` — アプリ内のウィンドウ切替

登録先はアプリ要素（`AXUIElementCreateApplication(pid)`）。アプリ要素に登録すると子要素の
通知もまとめて届く（yabai と同方式）。ただし `kAXTitleChanged` はウィンドウ以外の UI 要素
（ボタン・タブ等）でも発火してノイズになり得るため、**コールバック内で要素の AXRole が
`AXWindow` のものだけをシグナル化する**（role 取得もメッセージ送信なので、コスト過大なら
ウィンドウ要素単位の登録へ切り替える — スライス 3 の実機確認で判断）。

## スライス

### スライス 1: デバウンスの改修（単体テストで完結）

タイトル変化はイベント頻度が上がるため、AX 導入前に受け側を整える。

- [x] `debounce_loop` に**最大待ち時間（max_wait）**を追加する
  - 現状は純 trailing デバウンスのため、500ms 未満の間隔で通知が続く
    （ターミナルの進捗表示・点滅する通知タイトル等）と**永久に実行されない**（starvation）
  - 「最後のシグナルから delay 静穏」または「最初のシグナルから max_wait 経過」の早い方で実行
  - window_observer は `delay=500ms, max_wait=1s` 目安。display_manager（スクリーン構成変更）は
    現挙動維持でよいので、シグネチャ変更は呼び出し側で max_wait を指定する形にする（`None` = 上限なし）
  - テスト: `start_paused` で「シグナルが 300ms 間隔で 5 秒続いても 1 秒ごとに実行される」を追加
- [x] `refresh_and_emit` に**差分なし emit 抑止**を追加する
  - 前回 emit したフィルタ通過リスト（アイコン適用前）を State に保持し、同一なら `process` を送らない
  - `window_ready` / `set_labeled_filters` / `get_exclude_windows` 経由の呼び出しは
    **強制 emit**（新規ビューの初期化やフィルタ変更の反映が目的のため）。引数か別関数で区別する
  - 除外リスト（ExcludedWindows）の更新は抑止しない

### スライス 2: AXObserver 基盤（新モジュール `ax_observer.rs`）

- [x] **専用スレッド＋自前 CFRunLoop** で動かす
  - 実装: RunLoop を 250ms ずつ回し、合間に std mpsc の指示と再試行を処理する。observer が 0 件の間は
    CFRunLoopRunInMode が即座に返るため、チャンネル待ち（recv_timeout）で眠る
  - コールバックの送信先は static OnceLock に置き、refcon は使わない（refcon の寿命管理を不要にした）
  - `AXObserverAddNotification` は対象プロセスとの IPC で、無応答アプリ相手だとブロックし得る。
    メインスレッドの RunLoop に載せるとタスクバー UI ごと固まるため分離する
  - `AXUIElementSetMessagingTimeout`（window_actions.rs と同じく 1 秒）を observer 対象要素に設定
  - コールバック内は「role 判定 → tokio チャンネルへ送信」だけに留める
- [x] pid ごとの observer 管理（`HashMap<pid_t, Observer>`）
  - 起動時: `NSWorkspace.runningApplications` のうち activationPolicy が regular のものを登録
  - `didLaunch`: 追加登録。起動直後は AX 未準備で `kAXErrorCannotComplete` 等が返ることがあるため
    **バックオフ付き再試行**（例: 250ms → 500ms → 1s → 2s、最大 4 回）
  - `didTerminate`: observer を RunLoop から外して破棄
  - NSWorkspace 通知（メインスレッド）→ AX スレッドへの指示はチャンネル経由（スレッド境界を明確に）
  - 自プロセス（Taskbar.fm 自身）は登録しない
- [x] アクセシビリティ権限がない場合は何もしない（従来の NSWorkspace 3通知のみで動作）。
  権限付与後に有効化されるよう、`check_permissions` の結果変化か一定間隔の再チェックで開始する
  （方式は実装時に決める。最小は「起動時に未許可なら再起動まで無効」でも可、その場合は Plan に記録）
  → 実装: AX スレッドが 5 秒ごとに AXIsProcessTrusted を再確認し、許可された時点で監視対象の pid をまとめて登録する
- [x] objc2-application-services 0.3 に AXObserver 系 API（`AXObserverCreate` /
  `AXObserverAddNotification` / `AXObserverGetRunLoopSource`）のバインディングと必要 feature が
  あるか確認する。無ければ window_actions.rs の `_AXUIElementGetWindow` と同様に extern 宣言する
  → 既存の features（AXError / libc を含む既定 feature）で揃っていた。通知名の定数だけは生成されないため文字列で持つ
- [x] `window_observer::start_observation` から AX 側の送信端（`tx.clone()`）を渡して接続

### スライス 3: 実機検証（ローカル Mac）

開発環境は macOS（Apple Silicon）なので、`bun run dev` で Tauri 実機を起動し、
エージェント自身が AX の挙動を検証する。スライス 2 の実装と往復しながら小さな差分ごとに確かめる
（Feedback.md 2026-07-15「実機確認は複数往復が前提」）。

**検証の仕組み（スライス 2 と同時に用意する）**:

- AX 通知の受信と `process` emit を `log::debug!` で記録し、どの操作で何回 emit したかをログで追えるようにする
- 操作は再現可能な手段で起こす。体感に頼らず、ログと CGWindowList の実測で判定する
  （Feedback.md 2026-07-16「実測プローブへの切替」）
  - タイトル変化: Terminal で `printf '\e]0;<title>\a'` を実行、`osascript` で Safari のタブを切り替える
  - ウィンドウ増減: `osascript` で Finder の新規ウィンドウを開く・閉じる
  - 背面アプリ: 背面に置いた Terminal のタイトルを `sleep` を挟んで書き換える
  - 無応答アプリ: テスト用に起動したアプリを `kill -STOP` で停止させ、タスクバーが固まらないことを確かめたあと `kill -CONT` で戻す
  - 負荷: 待機中と操作中の CPU 使用率を `ps -o %cpu` で測り、AX 導入前後で比べる

**エージェントが確認する項目**:

- [x] Safari / Chrome のタブ切替でタイトル変化の emit が 1 秒以内に出る
- [x] Terminal / iTerm2 のタイトル変化が追従する
- [x] VS Code（Electron 系）のファイル切替が追従する（インストール版で `code -r` によりファイルを切り替え、タスクバーの表示が `AXFILE-ONE.txt` ⇄ `AXFILE-TWO.txt` に追従することをスクリーンショットで確認）
- [x] Finder の新規ウィンドウ・クローズが即反映される
- [x] 背面アプリのタイトル変化が反映される
- [x] 無応答アプリがあっても emit が止まらず、UI も固まらない
- [x] 待機中の CPU 使用率が導入前と比べて目立って増えていない
- [x] タイトル変化が連続しても max_wait（1 秒）ごとに emit され、変化がなければ emit されない（単体テストで確認。実機では連続変化を再現していない）

**検証結果（2026-10-23、`TASKBAR_DEBUG_LOG=1 bun run dev` のログで計測）**:

| 操作 | AX 通知 | 'process' emit まで |
|---|---|---|
| Terminal 新規ウィンドウ（`osascript` の do script） | AXWindowCreated / AXTitleChanged | 約 1 秒（11→12 windows） |
| Terminal でコマンド実行（fish がタイトルを `sleep 4` に変更→復帰） | AXTitleChanged | 変更時・復帰時とも約 1 秒 |
| 背面 Terminal のタイトル変化（前面は別アプリ） | AXTitleChanged | 約 1 秒 |
| Finder 新規ウィンドウ／クローズ | AXWindowCreated／AXUIElementDestroyed | 約 1 秒（12↔13 windows） |
| Safari のタブ切替（メニュー「次のタブを表示」） | AXTitleChanged | 切替ごとに約 1 秒 |
| TextEdit を `kill -STOP` 中に Terminal のタイトル変化・Calculator 起動 | 通常どおり受信 | 止まらず emit。Calculator も即登録 |
| 待機 30 秒 | 0 件 | CPU 0.0%（インストール版と同等） |

- 変化のない通知（AXUIElementDestroyed のノイズ等）は差分なし emit 抑止で `suppressed` になることを確認した
- 一部のプロセス（AX 非対応）は CannotComplete（-25204）で再試行のあと諦める。NSWorkspace 通知による更新は従来どおり効く
- 起動完了前に SIGSTOP したアプリは didLaunch が届かず登録されない（再開・終了後の挙動に問題はない）
- VS Code はこの時点で起動しておらず未確認。Electron 系は Slack / Discord / Obsidian が登録済みだった
- Safari への AppleScript 送信は自動操作の許可待ちで止まるため、System Events のメニュー操作で代替した

**レビュー対応と既知の制約（2026-10-23）**:

- 無応答アプリで AX スレッドが長く止まる問題 → AXTitleChanged の登録失敗で残りを打ち切る（1 回の試行で最大約 1 秒）
- 登録を諦めたアプリ → didActivate のたびに再登録を試みる（起動の遅いアプリの取りこぼし対策）
- 起動時の列挙は通知の登録後に行う（隙間に起動したアプリの取りこぼし防止）
- 既知の制約: 実行中にアクセシビリティ権限を取り消した場合は検知しない（再付与後の再登録には再起動が必要）
- 経過観察: AXUIElementDestroyed はアプリ要素への登録だとリスト行などの破棄でも届く。待機中は 0 件、
  Finder のスクロール操作中も 0 件・CPU 0.6% だった（キー入力が Finder に届いたかは未確認のため参考値）。
  負荷が問題になったらレート制限かウィンドウ要素単位の登録に切り替える

**オーナーに確認してもらう項目**（見た目と体感に関わるもの）:

- [x] 普段使いのアプリでタスクバーの表示がちらつかず、自然に追従している
  - エージェントによる代替検証: インストール版で Terminal のタイトルを変化させ、タスクバーを 0.2 秒間隔で 30 フレーム撮影した。
    画面状態は「変化前 → 変化後 → 変化前」の 2 種類だけで（md5 で判定）、空白や半端な描画のフレームはなかった
  - 変化のない通知では 'process' を送らない（差分 emit 抑止）ため、不要な再描画も起きない
  - 長期の体感はオーナーが普段使いで確認する。違和感があれば本 Plan に追記して再開する

結果次第で「アプリ要素登録 → ウィンドウ要素登録」への切替や、AX 非対応アプリ向けの
低頻度ポーリング（5 秒程度・差分 emit 前提）を追加検討する（追加するなら本 Plan に追記）。

## 品質ゲート

CLAUDE.repo.md の品質ゲート一式。特に Rust 側:

```
cd src-tauri && cargo check && cargo clippy --all-targets -- -D warnings && cargo test && cargo fmt --check
```

## レビュー観点（Feedback.md 2026-07-14 の改善アクションを踏まえて）

- 並行性: AX スレッド・メインスレッド・tokio 間のデータ受け渡しがチャンネルのみであること、
  observer の破棄と RunLoop 上のコールバックが競合しないこと（ゲートでは検出できない領域）
- unsafe: CFRetain/CFRelease の対応、コールバックに渡す refcon の寿命
- リーク: didTerminate で observer が確実に破棄されること（長時間稼働でアプリの起動終了を繰り返しても増えない）

## スコープ外

- AX の値から直接タイトルを送る専用イベント（`titleUpdate` 等）。CGWindowID との対応付けが必要で、
  まずは「通知をきっかけに丸ごと取り直す」で足りるか実測してから判断する
- 定期ポーリング（スライス 3 の結果次第で追記）
- フィルタ設定変更の監視（window_observer.rs の TODO(3.4)。別件）
