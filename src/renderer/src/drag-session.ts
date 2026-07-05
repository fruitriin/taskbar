import { moveApp, shouldSwap } from './utils'
import type { Rect } from './utils'

/** ドラッグ開始とみなすポインタ移動量（クリックとの共存のため） */
export const MOVE_THRESHOLD_PX = 8

export type PointerInfo = {
  pointerId: number
  x: number
  y: number
  /** 押下中のボタンのビットマスク（0 = 全て離されている） */
  buttons: number
  /** pointerdown 時のみ使用。0 = 左ボタン */
  button?: number
}

export type DragSessionDeps = {
  /** ドラッグ開始時の並び順（buildAppOrder 済み）を返す */
  getBaseOrder: () => string[]
  /** 座標下のアプリボタンとその矩形。無ければ null */
  hitTest: (x: number, y: number) => { app: string; rect: Rect } | null
  /** 水平タスクバー（bottom）なら true */
  isHorizontal: () => boolean
  /** 閾値を超えてドラッグが確定した（rect は押下時のボタン矩形＝ゴーストの基準位置） */
  onDragStart: (app: string, rect: Rect) => void
  /** ドラッグ中の並びが変わった（FLIP の駆動源） */
  onOrderChange: (order: string[]) => void
  /** ドロップ確定。end より先に呼ばれる（楽観反映 → クリアの順序を保証） */
  onCommit: (order: string[]) => void
  /** セッション終了（確定・キャンセル共通の後片付け） */
  onEnd: () => void
  /** ゴースト追従（ドラッグ確定後の pointermove ごと） */
  onGhostMove: (dx: number, dy: number) => void
  /** 現在時刻（テストで注入。省略時は performance.now） */
  now?: () => number
  /** ドラッグ開始閾値（テストで注入） */
  moveThresholdPx?: number
}

export type DragSessionState = 'idle' | 'pending' | 'dragging'

export type DragSession = {
  readonly state: DragSessionState
  /** ポインタ追跡中か（pending 含む。process 更新の保留判定に使う） */
  readonly isActive: boolean
  /** 閾値を超えてドラッグ確定したか */
  readonly isDragging: boolean
  /**
   * ポインタ押下。追跡を開始したら true を返す（呼び出し側はこのとき
   * document リスナーを張る）。左ボタン以外・多重押下は false
   */
  pointerDown(ev: PointerInfo, app: string, rect: Rect): boolean
  pointerMove(ev: PointerInfo): void
  pointerUp(ev: PointerInfo): void
  /**
   * Esc・blur・pointercancel・visibilitychange 共通のキャンセル。
   * pointerId を渡すと追跡中のポインタと一致する場合のみキャンセルする
   * （別ポインタ由来の pointercancel で正当なセッションを打ち切らないため）
   */
  cancel(cancelPointerId?: number): void
}

// タスクバー D&D の状態機械（idle → pending → dragging）。
// DOM・Vue に依存せず、判定は utils.ts の純関数（shouldSwap / moveApp）に委譲する。
// 参考: fruitriin/misskey MkDraggable のエッセンス移植
export function createDragSession(deps: DragSessionDeps): DragSession {
  const now = deps.now ?? ((): number => performance.now())
  const threshold = deps.moveThresholdPx ?? MOVE_THRESHOLD_PX

  let state: DragSessionState = 'idle'
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let app: string | null = null
  let pressedRect: Rect | null = null
  let order: string[] | null = null
  let lastSwapAt = 0

  function end(): void {
    state = 'idle'
    pointerId = null
    app = null
    pressedRect = null
    order = null
    deps.onEnd()
  }

  return {
    get state(): DragSessionState {
      return state
    },
    get isActive(): boolean {
      return state !== 'idle'
    },
    get isDragging(): boolean {
      return state === 'dragging'
    },

    pointerDown(ev: PointerInfo, targetApp: string, rect: Rect): boolean {
      // 左ボタンのみ（右クリックメニューを阻害しない）・多重押下防止
      if (state !== 'idle' || (ev.button ?? 0) !== 0) return false
      state = 'pending'
      pointerId = ev.pointerId
      startX = ev.x
      startY = ev.y
      app = targetApp
      pressedRect = rect
      return true
    },

    pointerMove(ev: PointerInfo): void {
      if (state === 'idle' || ev.pointerId !== pointerId) return
      // pointerup を取りこぼした（ウィンドウ外で離された等）場合の自己修復
      if (ev.buttons === 0) {
        end()
        return
      }
      const dx = ev.x - startX
      const dy = ev.y - startY

      if (state === 'pending') {
        // 閾値未満は通常クリックとして素通しする
        if (Math.abs(dx) <= threshold && Math.abs(dy) <= threshold) return
        state = 'dragging'
        order = deps.getBaseOrder()
        lastSwapAt = 0
        deps.onDragStart(app as string, pressedRect as Rect)
      }

      deps.onGhostMove(dx, dy)
      if (!order || !app || !pressedRect) return

      const hit = deps.hitTest(ev.x, ev.y)
      if (!hit || hit.app === app) return

      // ゴースト矩形は押下時矩形＋移動量から算出（DOM 読み取り不要で決定的）
      const ghostRect: Rect = {
        left: pressedRect.left + dx,
        right: pressedRect.right + dx,
        top: pressedRect.top + dy,
        bottom: pressedRect.bottom + dy
      }
      const swap = shouldSwap({
        fromIndex: order.indexOf(app),
        toIndex: order.indexOf(hit.app),
        ghostRect,
        targetRect: hit.rect,
        horizontal: deps.isHorizontal(),
        lastSwapAt,
        now: now()
      })
      if (swap) {
        order = moveApp(order, app, hit.app)
        lastSwapAt = now()
        deps.onOrderChange(order)
      }
    },

    pointerUp(ev: PointerInfo): void {
      if (state === 'idle' || ev.pointerId !== pointerId) return
      // 確定（onCommit）→ 後片付け（onEnd）の順序を保証する
      if (state === 'dragging' && order) deps.onCommit(order)
      end()
    },

    cancel(cancelPointerId?: number): void {
      if (state === 'idle') return
      if (cancelPointerId !== undefined && cancelPointerId !== pointerId) return
      end()
    }
  }
}
