# Pointer Events + Vue リアクティブで Sortable 的 D&D を再現する

**記録日**: 2026-07-05（pointer-drag-animation 実装時）
**参考**: fruitriin/misskey の MkDraggable（コミット 3dfe818）のエッセンス移植

## 構成（生 DOM 操作なし）

1. **ドラッグ中の並び順をリアクティブ状態に持つ**: `dragOrder: string[] | null` を data に置き、
   表示用 computed が `dragOrder ?? options.appOrder` を使う。pointermove 中に `moveApp` で
   `dragOrder` を差し替えると `<TransitionGroup name="flip-list">` の FLIP
   （`.flip-list-move { transition: transform }`）が「滑って避ける」を勝手に演出する
2. **振動（オシレーション）対策は2段**: 入れ替えクールダウン 150ms ＋ ゴーストの進行方向端が
   ターゲットに 30% 以上食い込んだら入れ替え（`shouldSwap` 純関数、taskbar/utils.ts）
3. **キャンセルの戻りもタダ**: `dragOrder = null` にするだけで computed が元の並びへ戻り、
   FLIP が戻りアニメーションになる

## 設計判断と根拠

- **setPointerCapture は使わず document でリッスン**: TransitionGroup の DOM 並び替えで
  Pointer Capture が暗黙解放されるため（MkDraggable の実装コメント由来）。
  pointermove/pointerup/pointercancel/visibilitychange を pointerdown 時に張り、
  cleanup で必ず剥がす。Vue 3 Options API の methods は this 束縛済み参照がキャッシュ
  されるので add/remove のペアが成立する
- **ゴーストは TransitionGroup の外**: 中に入れると enter/leave/move の transition:none
  除外が必要になる（MkDraggable はこれをやっている）。外に置けば無縁
- **ゴースト矩形は DOM を読まず算術で出す**: 押下時の `getBoundingClientRect` を
  プレーンオブジェクトで保存し、`基準矩形 + (clientX - startX)` で算出。
  `pointer-events: none` なので elementFromPoint の hide/show ハックも不要
- **ドラッグ後の click 合成抑止**: `didDrag` フラグを見て1回無視し、`setTimeout(0)` で解除
  （click は pointerup 直後に同期発火するため）。ドロップ位置が元ボタン外だと click が
  発火しないケースがあるので、フラグをイベント内でなくタイマーで解除するのが重要
- **確定時は options に楽観反映してから setOptions**: IPC 往復（setOptions →
  updateOptions）を待つと一瞬旧並びに戻る（FLIP があるとむしろ目立つ）
- **外部由来のリスト更新はドラッグ中保留**: Helper の process push をそのまま反映すると
  入れ替え判定の土台が動く。`dragActive` 中は `pendingWindows` に貯めて cleanup で flush

## ハマりやすい点

- `MOVE_THRESHOLD_PX`（8px）未満で pointerup → 通常クリックとして素通しする分岐を忘れない
- 右クリック共存は pointerdown の `event.button !== 0` ガード
- beforeUnmount でも cleanup（ディスプレイ再構成でタスクバーが再作成されるため）
