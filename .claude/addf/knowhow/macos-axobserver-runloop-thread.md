---
title: AXObserver を専用スレッドの CFRunLoop で動かす実装パターンと、osascript による実機検証の落とし穴
created: 2026-10-23
last_verified: 2026-10-23
depends_on: []
status: active
---

# AXObserver を専用スレッドの CFRunLoop で動かす実装パターンと、osascript による実機検証の落とし穴

関連: [macos-spaces-window-visibility.md](macos-spaces-window-visibility.md)（CGWindowList + osascript の実測プローブ）、
[cdp-headless-e2e-probe.md](cdp-headless-e2e-probe.md)（実測への切替の考え方）

## 発見した知見

### 1. objc2-application-services 0.3.2 には AXObserver 系 API が揃っている

- `AXObserver::create(pid, callback, out)` / `add_notification(&app, &name, refcon)` /
  `run_loop_source()` が既定 feature（AXError・libc を含む）で使える。extern 宣言は不要
- 通知名（`kAXTitleChangedNotification` 等）はヘッダの CFSTR マクロなので定数が生成されない。
  `CFString::from_static_str("AXTitleChanged")` のように文字列で持つ
- `AXObserverCreate` と `AXUIElementCopyAttributeValue` は Create/Copy 規則なので `CFRetained::from_raw`、
  `run_loop_source()` はバインディング側で retain 済みの `CFRetained` を返す

### 2. 専用スレッドで RunLoop を回すときの形

- `CFRunLoop::run_in_mode(kCFRunLoopDefaultMode, 0.25, false)` を回し、合間に std mpsc の指示を `try_recv` する。
  カスタム RunLoopSource で即時起床させるより単純で、遅延は最大 250ms に収まる
- **RunLoop にソースが1つもないと `run_in_mode` は即座に返る**（kCFRunLoopRunFinished）。
  observer が 0 件の間はチャンネルの `recv_timeout` で眠らないと CPU を空回しする
- コールバックの送信先は `static OnceLock<UnboundedSender<()>>` に置き、refcon は null にする。
  refcon に Box を渡すと observer 破棄とのライフタイム管理が必要になるが、送信先が1つなら不要
- 無応答アプリ対策として `set_messaging_timeout(1.0)` をアプリ要素とコールバック内の要素に設定する。
  SIGSTOP したアプリがあっても他アプリの通知・新規登録は止まらなかった（実測）

### 3. アプリ要素に登録したときのノイズ

- アプリ要素に登録すると子要素の通知もまとめて届く。`AXTitleChanged` はボタンやタブでも発火するので、
  コールバックで AXRole が `AXWindow` のものだけを通す
- `AXUIElementDestroyed` はメニューやツールチップの破棄でも頻発する。破棄済み要素の role は取れないため、
  受け側（refresh_and_emit）で「前回と同一なら emit しない」差分抑止を入れて吸収した
- 起動直後や AX 非対応のプロセスは `kAXErrorCannotComplete`（-25204）を返す。バックオフ付きで再試行し、駄目なら諦める

### 4. osascript による実機検証の落とし穴

- **`tell application "Safari"` は自動操作（Automation）の許可待ちで無期限に止まる**。
  System Events 経由のメニュー操作（`click menu item "次のタブを表示" of menu "ウインドウ"`）なら止まらない。
  osascript には必ず `timeout` を付ける
- **`keystroke "}" using {command down, shift down}` は JIS 配列では別のキーになる**。今回は Safari のタブ一覧表示に入ってしまった。
  キー操作よりメニュー項目のクリックのほうが確実
- fish はプロンプトのたびにウィンドウタイトルを書き戻すため、`printf '\e]0;title\a'` でのタイトル変更は残らない。
  `sleep 4` のようなコマンドを実行すると、実行中はタイトルがコマンド名になるので、これを変化の再現に使える
- `screencapture -x` で全画面を撮れば、キー操作が意図どおり効いたかを目視で確認できる

## 検証の型

`TASKBAR_DEBUG_LOG=1 bun run dev` で AX 通知と `'process' emitted / suppressed` を debug ログに出し、
操作の前後でログの行数を区切って集計する。操作は osascript で再現し、
「通知が届く → 約 1 秒（デバウンス 500ms）で emit」を判定基準にする。
