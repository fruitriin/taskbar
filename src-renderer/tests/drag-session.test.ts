import { describe, it, expect } from 'bun:test'
import { createDragSession, MOVE_THRESHOLD_PX } from '../src/drag-session'
import type { DragSessionDeps, PointerInfo } from '../src/drag-session'
import { REORDER_COOLDOWN_MS } from '../src/utils'
import type { Rect } from '../src/utils'

// 幅100pxのボタンが x=0,100,200 に並ぶ水平タスクバーを模したヒットテスト
const APPS = ['A', 'B', 'C']
function rectOf(index: number): Rect {
  return { left: index * 100, right: index * 100 + 100, top: 0, bottom: 40 }
}

type Harness = {
  session: ReturnType<typeof createDragSession>
  calls: {
    starts: string[]
    orders: string[][]
    commits: string[][]
    ends: number
    ghosts: [number, number][]
  }
  clock: { now: number }
}

function createHarness(overrides: Partial<DragSessionDeps> = {}): Harness {
  const calls: Harness['calls'] = { starts: [], orders: [], commits: [], ends: 0, ghosts: [] }
  const clock = { now: 10_000 }
  const session = createDragSession({
    getBaseOrder: () => [...APPS],
    // 座標 x が乗っているボタンを返す（アプリ順は常に A,B,C 固定の単純モデル）
    hitTest: (x) => {
      const index = Math.floor(x / 100)
      if (x < 0 || index >= APPS.length) return null
      return { app: APPS[index], rect: rectOf(index) }
    },
    isHorizontal: () => true,
    onDragStart: (app) => calls.starts.push(app),
    onOrderChange: (order) => calls.orders.push(order),
    onCommit: (order) => calls.commits.push(order),
    onEnd: () => calls.ends++,
    onGhostMove: (dx, dy) => calls.ghosts.push([dx, dy]),
    now: () => clock.now,
    ...overrides
  })
  return { session, calls, clock }
}

function p(pointerId: number, x: number, y = 20, buttons = 1, button = 0): PointerInfo {
  return { pointerId, x, y, buttons, button }
}

// ボタンA（x=0..100）の中央 x=50 で押下する共通操作
function pressA(h: Harness, pointerId = 1): void {
  expect(h.session.pointerDown(p(pointerId, 50), 'A', rectOf(0))).toBe(true)
}

describe('createDragSession: 開始条件', () => {
  it('左ボタンの押下で pending になる', () => {
    const h = createHarness()
    pressA(h)
    expect(h.session.state).toBe('pending')
    expect(h.session.isActive).toBe(true)
    expect(h.session.isDragging).toBe(false)
  })

  it('右ボタン・中ボタンは受け付けない', () => {
    const h = createHarness()
    expect(h.session.pointerDown(p(1, 50, 20, 2, 2), 'A', rectOf(0))).toBe(false)
    expect(h.session.state).toBe('idle')
  })

  it('多重 pointerdown は拒否される', () => {
    const h = createHarness()
    pressA(h)
    expect(h.session.pointerDown(p(2, 150), 'B', rectOf(1))).toBe(false)
    expect(h.session.state).toBe('pending')
  })

  it('閾値以下の移動ではドラッグ開始しない', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, 50 + MOVE_THRESHOLD_PX))
    expect(h.session.isDragging).toBe(false)
    expect(h.calls.starts).toEqual([])
  })

  it('閾値を超えるとドラッグ開始し onDragStart が呼ばれる', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, 50 + MOVE_THRESHOLD_PX + 1))
    expect(h.session.isDragging).toBe(true)
    expect(h.calls.starts).toEqual(['A'])
  })
})

describe('createDragSession: クリック素通しと確定', () => {
  it('動かさず pointerup → onCommit されず onEnd のみ（通常クリック）', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerUp(p(1, 50))
    expect(h.calls.commits).toEqual([])
    expect(h.calls.starts).toEqual([])
    expect(h.calls.ends).toBe(1)
    expect(h.session.state).toBe('idle')
  })

  it('ドラッグ後の pointerup で onCommit → onEnd の順に呼ばれる', () => {
    const h = createHarness()
    const sequence: string[] = []
    const h2 = createHarness({
      onCommit: () => sequence.push('commit'),
      onEnd: () => sequence.push('end')
    })
    pressA(h2)
    h2.session.pointerMove(p(1, 150)) // B の中央まで移動 → swap
    h2.session.pointerUp(p(1, 150))
    expect(sequence).toEqual(['commit', 'end'])
    void h
  })

  it('swap 後に確定すると並び替え済みの順序が commit される', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, 150)) // ゴースト(50..150)がB(100..200)に50px食い込み → swap
    expect(h.calls.orders).toEqual([['B', 'A', 'C']])
    h.session.pointerUp(p(1, 150))
    expect(h.calls.commits).toEqual([['B', 'A', 'C']])
  })
})

describe('createDragSession: 入れ替えとクールダウン', () => {
  it('クールダウン中は連続 swap しない', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, 150)) // swap 1回目（lastSwapAt = now）
    h.session.pointerMove(p(1, 250)) // クールダウン中 → swap しない
    expect(h.calls.orders).toHaveLength(1)

    h.clock.now += REORDER_COOLDOWN_MS
    h.session.pointerMove(p(1, 250)) // クールダウン明け → swap 2回目
    expect(h.calls.orders).toHaveLength(2)
    expect(h.calls.orders[1]).toEqual(['B', 'C', 'A'])
  })

  it('自分自身の上では swap しない', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, 59)) // 閾値超えだが自分（A: 0..100）の上
    expect(h.calls.starts).toEqual(['A'])
    expect(h.calls.orders).toEqual([])
  })

  it('ヒットなし（ボタン外）では何も起きない', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, -50))
    expect(h.calls.orders).toEqual([])
  })

  it('ゴースト追従はドラッグ確定後の move ごとに通知される', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, 150, 25))
    expect(h.calls.ghosts).toEqual([[100, 5]])
  })
})

describe('createDragSession: 振動防止（直前に入れ替えた相手との即時再入れ替え禁止）', () => {
  // hitTest が「現在の並び順」で位置解決する点が createHarness と異なる（FLIP 後の
  // 実際の再配置を模す。createHarness の既定 hitTest は APPS 固定でこの検証には使えない）
  function createOrderAwareHarness(): {
    session: ReturnType<typeof createDragSession>
    orders: string[][]
    clock: { now: number }
  } {
    let currentOrder = [...APPS]
    const orders: string[][] = []
    const clock = { now: 10_000 }
    const session = createDragSession({
      getBaseOrder: () => [...APPS],
      hitTest: (x) => {
        const index = Math.floor(x / 100)
        if (x < 0 || index >= currentOrder.length) return null
        return { app: currentOrder[index], rect: rectOf(index) }
      },
      isHorizontal: () => true,
      onDragStart: () => {},
      onOrderChange: (order) => {
        currentOrder = order
        orders.push(order)
      },
      onCommit: () => {},
      onEnd: () => {},
      onGhostMove: () => {},
      now: () => clock.now
    })
    return { session, orders, clock }
  }

  it('入れ替え直後、ゴーストが相手の元位置に戻っても即座には逆再入れ替えしない', () => {
    const h = createOrderAwareHarness()
    expect(h.session.pointerDown(p(1, 50), 'A', rectOf(0))).toBe(true)

    // A(index0) → B(index1) へ 1回目の swap。並びは ['B', 'A', 'C'] になる
    h.session.pointerMove(p(1, 150))
    expect(h.orders).toHaveLength(1)
    expect(h.orders[0]).toEqual(['B', 'A', 'C'])

    // クールダウン明け。ゴーストが押下時位置（dx=0）へ戻る = B の現在位置と完全一致する。
    // 閾値条件だけを見れば逆 swap が成立してしまうが、直前に入れ替えた B からゴーストが
    // 一度も完全に離れていないため、再入れ替えは起きない
    h.clock.now += REORDER_COOLDOWN_MS
    h.session.pointerMove(p(1, 50))
    expect(h.orders).toHaveLength(1)
  })

  it('自分自身へのホバーだけでは block が解除されない（レビュー指摘の回帰テスト）', () => {
    // FLIP アニメーション中、ドラッグ元の実要素が直前にスワップした相手の旧位置
    // （＝ゴーストが留まっている境界付近）へ滑り込んでくる過程で、一時的に自分自身への
    // ホバーを経由することがある。ここで block が解除されると振動防止が破られる
    const h = createOrderAwareHarness()
    expect(h.session.pointerDown(p(1, 50), 'A', rectOf(0))).toBe(true)

    // A(index0) → B(index1) へ swap。並びは ['B', 'A', 'C']。A は新しい並びで index1（x=100..200）
    h.session.pointerMove(p(1, 150))
    expect(h.orders).toHaveLength(1)

    // クールダウン明け。x=150 は新しい並びでは自分自身（A, index1）の領域 → 何もしない
    h.clock.now += REORDER_COOLDOWN_MS
    h.session.pointerMove(p(1, 150))
    expect(h.orders).toHaveLength(1)

    // 自分自身へのホバーの直後でも、B の元位置（x=50）に戻れば依然として block されたまま
    h.session.pointerMove(p(1, 50))
    expect(h.orders).toHaveLength(1)
  })

  it('block された相手とは別のアプリへ乗り換えると、元の相手は再び入れ替え可能に戻る', () => {
    const h = createOrderAwareHarness()
    expect(h.session.pointerDown(p(1, 50), 'A', rectOf(0))).toBe(true)

    // A(index0) → B(index1) へ swap。並びは ['B', 'A', 'C']。blockedApp = 'B'
    h.session.pointerMove(p(1, 150))
    expect(h.orders).toHaveLength(1)

    // クールダウン明け、C（index2）へ乗り換え swap。並びは ['B', 'C', 'A']。blockedApp = 'C'
    h.clock.now += REORDER_COOLDOWN_MS
    h.session.pointerMove(p(1, 250))
    expect(h.orders).toHaveLength(2)
    expect(h.orders[1]).toEqual(['B', 'C', 'A'])

    // クールダウン明け、B（index0）へ戻ると block は 'C' に移っているため正当に再入れ替えできる
    h.clock.now += REORDER_COOLDOWN_MS
    h.session.pointerMove(p(1, 50))
    expect(h.orders).toHaveLength(3)
    expect(h.orders[2]).toEqual(['A', 'B', 'C'])
  })
})

describe('createDragSession: キャンセルと自己修復', () => {
  it('cancel（Esc / blur / pointercancel 相当）で commit されず終了する', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, 150))
    h.session.cancel()
    expect(h.calls.commits).toEqual([])
    expect(h.calls.ends).toBe(1)
    expect(h.session.state).toBe('idle')
  })

  it('buttons === 0 の pointermove で自己修復（取りこぼした pointerup 扱い）', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(1, 150))
    h.session.pointerMove({ pointerId: 1, x: 200, y: 20, buttons: 0 })
    expect(h.calls.commits).toEqual([]) // 確定はしない
    expect(h.calls.ends).toBe(1)
    expect(h.session.state).toBe('idle')
  })

  it('終了後は再びドラッグを受け付ける（詰まらない）', () => {
    const h = createHarness()
    pressA(h)
    h.session.cancel()
    expect(h.session.pointerDown(p(2, 150), 'B', rectOf(1))).toBe(true)
    expect(h.session.state).toBe('pending')
  })

  it('idle 中の cancel は onEnd を呼ばない', () => {
    const h = createHarness()
    h.session.cancel()
    expect(h.calls.ends).toBe(0)
  })
})

describe('createDragSession: pointerId の分離', () => {
  it('別ポインタの move / up は無視される', () => {
    const h = createHarness()
    pressA(h)
    h.session.pointerMove(p(99, 150))
    h.session.pointerUp(p(99, 150))
    expect(h.session.state).toBe('pending')
    expect(h.calls.starts).toEqual([])
    expect(h.calls.ends).toBe(0)
  })

  it('別ポインタ由来の cancel(pointerId) は無視される', () => {
    const h = createHarness()
    pressA(h)
    h.session.cancel(99)
    expect(h.session.state).toBe('pending')
    expect(h.calls.ends).toBe(0)
  })

  it('追跡中ポインタの cancel(pointerId) はキャンセルされる', () => {
    const h = createHarness()
    pressA(h)
    h.session.cancel(1)
    expect(h.session.state).toBe('idle')
    expect(h.calls.ends).toBe(1)
  })

  it('id 省略の cancel（Esc / blur）は常にキャンセルする', () => {
    const h = createHarness()
    pressA(h)
    h.session.cancel()
    expect(h.session.state).toBe('idle')
  })
})

describe('createDragSession: onDragStart に押下時矩形が渡る', () => {
  it('rect がゴースト初期化用に渡される', () => {
    const rects: Rect[] = []
    const h = createHarness({ onDragStart: (_app, rect) => rects.push(rect) })
    pressA(h)
    h.session.pointerMove(p(1, 150))
    expect(rects).toEqual([rectOf(0)])
  })
})
