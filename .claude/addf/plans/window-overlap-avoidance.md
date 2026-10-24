---
trust: nervous
responsiveness: interactive
image_clarity: vague
---

# Plan: タスクバーと重なるウィンドウの自動回避（Issue #48 の Tauri 版）

## 実装状況: 未着手（設計判断のオーナー回答待ち）

> 出典: GitHub Issue #48「taskbar とウィンドウの重なりを検出して他のウィンドウを移動したりリサイズしたりしたい」（OPEN）。
> 2026-01 に Claude bot が Electron 版で参考実装（ブランチ `claude/issue-48-20260122-0739`、コミット `6b7b828`）を作ったが、
> Tauri 移行で土台が変わったため取り込まず、本 Plan で作り直す。参考実装のブランチは本 Plan の起票後に削除した
> （コミットはローカルの `refs/archive/remote/claude/issue-48-20260122-0739` に退避済み）

## 関連 Plan

- [ax-title-observer.md](ax-title-observer.md) — ウィンドウの生成・移動を検知する AXObserver 基盤。
  本 Plan は同じ基盤に AXMoved / AXResized を足して「調整のきっかけ」に使う

## 目的

macOS には Windows のように「タスクバーの分だけ作業領域を予約する」公開 API がなく、最大化やドラッグで
ウィンドウがタスクバーの下に潜り込む。タスクバーと重なったウィンドウを、AX で移動・リサイズして避けさせる。

## 現状の挙動

- タスクバーは floating レベルの枠なしウィンドウで、他のウィンドウの上に重なって表示される。
  重なられた側のウィンドウ下端（bottom レイアウト）や右端（right レイアウト）のボタン・スクロールバーが隠れる
- タスクバーの矩形は `display_manager::taskbar_bounds(work_area, layout)`（純関数）で決まる。
  bottom は高さ 60px、left/right は幅 210px
- AX によるウィンドウ操作の土台は `window_actions.rs` にある（AXUIElement の特定・属性の書き込み・
  CGWindowID との対応付け `_AXUIElementGetWindow`・メッセージタイムアウト）

## 参考実装（Electron 版）から引き継ぐもの・引き継がないもの

| 項目 | 参考実装 | 本 Plan での扱い |
|---|---|---|
| 重なり判定 | 矩形の交差判定（`isOverlapping`） | 引き継ぐ（純関数・単体テスト） |
| 調整の方向 | bottom → 高さを縮める／right → 幅を縮める／left → 右へずらして幅を縮める（最小幅 100px） | 引き継ぐ。top 方向の調整は不要（タスクバーは上に来ない） |
| ウィンドウ操作 | AppleScript（System Events）でウィンドウ名の部分一致 | **AX 直接**に置き換える。名前一致は誤爆し、名前を AppleScript に埋め込むためインジェクションの余地もあった |
| タスクバーの大きさ | 210 / 60 を関数内に直書き | `taskbar_bounds` を共用する |
| 起動のきっかけ | IPC `adjustOverlappingWindows` の受け口だけで、呼ぶ側がなかった | AX 通知で自動起動する（下の設計判断 1） |
| 有効化設定 | `autoAdjustOverlappingWindows`（既定 false）を追加したが参照されていなかった | 設定として実装し、既定は無効（設計判断 3） |
| 座標系 | CGWindowList の座標と Electron の workArea を混在 | CG（左上原点・グローバル座標）に揃える。Tauri の Monitor は物理 px なので論理 px へ変換する |

## 設計判断（要オーナー確認）

1. **いつ調整するか**
   - (a) **推奨**: ウィンドウの生成時（AXWindowCreated）と、移動・リサイズが落ち着いたとき（AXMoved / AXResized を 500ms デバウンス）
   - (b) 生成時だけ（あとから潜り込ませた場合は放置）
   - (c) メニューに「重なりを解消」を置き、手動実行だけにする
2. **ユーザーが意図的に重ねたときの扱い**（(a) を選んだ場合）
   - 推奨: 同じウィンドウを調整したら、そのウィンドウは一定時間（例: 10 秒）再調整しない。
     ユーザーがタスクバーの上にドラッグし直したら、その意図を尊重する（調整とユーザー操作の綱引きを防ぐ）
3. **既定値**: 推奨は「無効（設定画面でオン）」。他アプリのウィンドウを勝手に動かすため
4. **対象外にするウィンドウ**（推奨案）
   - フルスクリーン（AXFullScreen）、最小化中、layer が 0 以外（パネル・オーバーレイ）
   - サイズを変えられないウィンドウ（AXSize が設定不可）。移動だけで避けられる場合は移動する
   - 既存のフィルタ（labeledFilters）で除外されているウィンドウ
5. **縮めすぎの下限**: 縮めた結果が小さすぎる（例: 幅・高さ 200px 未満）なら調整しない

## 変更内容（フェーズ）

### フェーズ 1: 判定と調整量の計算（純関数・単体テストで完結）

- **対象**: 新規 `src-tauri/src/overlap.rs`
- `adjustment(window: Rect, taskbar: Rect, layout, min_size) -> Option<Rect>` を実装する。参考実装の
  テスト（144 行）の観点（重ならない／各レイアウトでの縮小・移動／下限）を Rust に移植する
- マルチディスプレイ: ウィンドウの中心が属するディスプレイのタスクバーとだけ比べる

### フェーズ 2: AX による移動・リサイズ

- **対象**: `window_actions.rs` に `set_frame(pid, window_number, rect)` を追加
- CGWindowID → AXUIElement の特定は既存の `find_ax_window` を流用する（名前一致は使わない）
- AXPosition / AXSize を `AXValue`（CGPoint / CGSize）で書き込む。書き込み可否は `AXUIElementIsAttributeSettable` で確認する
- spawn_blocking ＋タイムアウト、メッセージタイムアウト 1 秒（既存方針どおり）
- 信頼境界: 調整対象はサーバー側（CGWindowList）で取得したウィンドウだけにし、フロントから座標を受け取らない
  （Feedback 2026-07-14 の改善アクション）

### フェーズ 3: きっかけの配線と設定

- **対象**: `ax_observer.rs`（AXMoved / AXResized の購読追加）、`window_observer.rs`、`store.rs` / `types.ts`（設定項目）、設定画面
- 設計判断 1・2 の回答に沿って実装する。調整そのものが AXMoved / AXResized を発火させるため、
  自分の調整による通知を無視する仕組み（調整直後のクールダウン）を必ず入れる
- 設定 `autoAvoidTaskbarOverlap`（既定 false）を store.rs と types.ts に同時に追加する

### フェーズ 4: 実機検証

`bun run dev` ＋ `TASKBAR_DEBUG_LOG=1` で、ax-title-observer と同じ osascript プローブにより検証する
（手順は knowhow/macos-axobserver-runloop-thread.md）。

- bottom / right / left の各レイアウトで、潜り込んだウィンドウが避ける
- 緑ボタンの拡大（zoom）・ダブルクリック拡大で避ける
- 調整と通知の無限ループが起きない（ログで調整回数を数える）
- フルスクリーン・サイズ固定のウィンドウには触らない
- 設定オフでは一切動かない

## 影響範囲

- Rust: `overlap.rs`（新規）、`window_actions.rs`、`ax_observer.rs`、`window_observer.rs`、`store.rs`
- フロント: 設定画面（option.vue）、`types.ts`
- 設定スキーマ: `store.rs` と `types.ts` の一致（CLAUDE.repo.md の規約）

## テスト方針

- フェーズ 1 は単体テストで網羅する（参考実装のテスト観点を移植）
- フェーズ 2〜3 は AppHandle や他プロセスが必要なため、フェーズ 4 の実機プローブで検証する

## 破壊的変更の許容範囲

なし（既定無効の追加機能）

## 要オーナー確認

上記「設計判断」の 1〜5。とくに 1（いつ調整するか）と 3（既定値）は実装の形が変わる。

## 完了条件

- [ ] フェーズ 1 の単体テストが通る
- [ ] 品質ゲート一式（CLAUDE.repo.md）が通る
- [ ] フェーズ 4 の検証項目をすべて確認し、結果を本 Plan に記録する
- [ ] オーナーが普段使いで「邪魔な重なりが解消され、勝手に動いて困る場面がない」と確認する <!-- human-judgment -->
- [ ] Issue #48 に結果を書いてクローズする

## AI 実装時間見積もり

設計判断の回答が出ていれば、フェーズ 1〜4 で 1 セッション程度。
