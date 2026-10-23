---
trust: normal
responsiveness: relaxed
image_clarity: balanced
---

# Plan: AXObserver によるウィンドウタイトル・ウィンドウ増減の検知

**実装状況**: 未着手
**作成日**: 2026-10-23
**出自**: オーナーとの考察セッション（タイトル取得タイミングの改善。A案＝AXObserver を採用）

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

### スライス 1: デバウンスの改修（Mac 実機不要・単体テストで完結）

タイトル変化はイベント頻度が上がるため、AX 導入前に受け側を整える。

- [ ] `debounce_loop` に**最大待ち時間（max_wait）**を追加する
  - 現状は純 trailing デバウンスのため、500ms 未満の間隔で通知が続く
    （ターミナルの進捗表示・点滅する通知タイトル等）と**永久に実行されない**（starvation）
  - 「最後のシグナルから delay 静穏」または「最初のシグナルから max_wait 経過」の早い方で実行
  - window_observer は `delay=500ms, max_wait=1s` 目安。display_manager（スクリーン構成変更）は
    現挙動維持でよいので、シグネチャ変更は呼び出し側で max_wait を指定する形にする（`None` = 上限なし）
  - テスト: `start_paused` で「シグナルが 300ms 間隔で 5 秒続いても 1 秒ごとに実行される」を追加
- [ ] `refresh_and_emit` に**差分なし emit 抑止**を追加する
  - 前回 emit したフィルタ通過リスト（アイコン適用前）を State に保持し、同一なら `process` を送らない
  - `window_ready` / `set_labeled_filters` / `get_exclude_windows` 経由の呼び出しは
    **強制 emit**（新規ビューの初期化やフィルタ変更の反映が目的のため）。引数か別関数で区別する
  - 除外リスト（ExcludedWindows）の更新は抑止しない

### スライス 2: AXObserver 基盤（新モジュール `ax_observer.rs`）

- [ ] **専用スレッド＋自前 CFRunLoop** で動かす
  - `AXObserverAddNotification` は対象プロセスとの IPC で、無応答アプリ相手だとブロックし得る。
    メインスレッドの RunLoop に載せるとタスクバー UI ごと固まるため分離する
  - `AXUIElementSetMessagingTimeout`（window_actions.rs と同じく 1 秒）を observer 対象要素に設定
  - コールバック内は「role 判定 → tokio チャンネルへ送信」だけに留める
- [ ] pid ごとの observer 管理（`HashMap<pid_t, Observer>`）
  - 起動時: `NSWorkspace.runningApplications` のうち activationPolicy が regular のものを登録
  - `didLaunch`: 追加登録。起動直後は AX 未準備で `kAXErrorCannotComplete` 等が返ることがあるため
    **バックオフ付き再試行**（例: 250ms → 500ms → 1s → 2s、最大 4 回）
  - `didTerminate`: observer を RunLoop から外して破棄
  - NSWorkspace 通知（メインスレッド）→ AX スレッドへの指示はチャンネル経由（スレッド境界を明確に）
  - 自プロセス（Taskbar.fm 自身）は登録しない
- [ ] アクセシビリティ権限がない場合は何もしない（従来の NSWorkspace 3通知のみで動作）。
  権限付与後に有効化されるよう、`check_permissions` の結果変化か一定間隔の再チェックで開始する
  （方式は実装時に決める。最小は「起動時に未許可なら再起動まで無効」でも可、その場合は Plan に記録）
- [ ] objc2-application-services 0.3 に AXObserver 系 API（`AXObserverCreate` /
  `AXObserverAddNotification` / `AXObserverGetRunLoopSource`）のバインディングと必要 feature が
  あるか確認する。無ければ window_actions.rs の `_AXUIElementGetWindow` と同様に extern 宣言する
- [ ] `window_observer::start_observation` から AX 側の送信端（`tx.clone()`）を渡して接続

### スライス 3: 実機確認（オーナー依頼・Questions.md 経由）

AX の挙動は単体テストでは検証できない。ローカル Mac で `bun run dev` によるログ・CPU の確認はエージェントが行い、体感を伴う以下はオーナーに確認してもらう:

- [ ] Safari / Chrome のタブ切替でタスクバーのタイトルが追従する
- [ ] Terminal / iTerm2 でコマンド実行に伴うタイトル変化が追従する
- [ ] VS Code（Electron 系）でファイル切替が追従する
- [ ] Finder で Cmd+N / Cmd+W がタスクバーに即反映される
- [ ] 背面アプリ（Music 等）のタイトル変化が反映される
- [ ] 無応答アプリ（強制停止中のアプリ等）があってもタスクバーが固まらない
- [ ] アクティビティモニタで常時 CPU 使用率が目立って増えていない

結果次第で「アプリ要素登録 → ウィンドウ要素登録」への切替や、AX 非対応アプリ向けの
低頻度ポーリング（5 秒程度・差分 emit 前提）を追加検討する（追加するなら本 Plan に追記）。

## 品質ゲート

CLAUDE.repo.md の品質ゲート一式。特に Rust 側:

```
cd src-tauri && cargo check && cargo clippy --all-targets -- -D warnings && cargo test && cargo fmt --check
```

※ AX/CF の FFI 部分は macOS ターゲットでしかビルドが通らない可能性がある。
非 macOS 環境でのビルド可否は既存モジュール（window_actions.rs 等）の扱いに合わせる。

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
