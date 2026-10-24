import { describe, it, expect } from 'bun:test'
import {
  sortWindowsInApp,
  sameJson,
  groupWindowsByApp,
  chunkIntoGroups,
  moveApp,
  buildAppOrder,
  shouldSwap,
  rectsSeparated,
  REORDER_COOLDOWN_MS
} from '../src/utils'

// テスト用の最小ウィンドウ生成ヘルパー
function win(app: string, num: number, x = 0, y = 0): MacWindow {
  return {
    kCGWindowLayer: 0,
    kCGWindowName: `${app}-${num}`,
    kCGWindowMemoryUsage: 0,
    kCGWindowSharingState: 0,
    kCGWindowOwnerPID: 100,
    kCGWindowOwnerName: app,
    kCGWindowNumber: num,
    kCGWindowBounds: { X: x, Y: y, Width: 100, Height: 100 },
    appIcon: ''
  } as MacWindow
}

// 並び順の検証を「アプリ名-番号」のリストで行う
function names(windows: MacWindow[]): string[] {
  return windows.map((w) => w.kCGWindowName as string)
}

describe('sortWindowsInApp', () => {
  it('起動順: kCGWindowNumber 昇順で並ぶ', () => {
    const result = sortWindowsInApp([win('A', 30), win('A', 10), win('A', 20)], {
      sortByPosition: false,
      layout: 'bottom'
    })
    expect(names(result)).toEqual(['A-10', 'A-20', 'A-30'])
  })

  it('座標順(bottom): X 昇順で並ぶ', () => {
    const result = sortWindowsInApp([win('A', 1, 300), win('A', 2, 100), win('A', 3, 200)], {
      sortByPosition: true,
      layout: 'bottom'
    })
    expect(names(result)).toEqual(['A-2', 'A-3', 'A-1'])
  })

  it('座標順(left/right): Y 昇順で並ぶ', () => {
    const windows = [win('A', 1, 0, 300), win('A', 2, 0, 100), win('A', 3, 0, 200)]
    expect(names(sortWindowsInApp(windows, { sortByPosition: true, layout: 'left' }))).toEqual([
      'A-2',
      'A-3',
      'A-1'
    ])
    expect(names(sortWindowsInApp(windows, { sortByPosition: true, layout: 'right' }))).toEqual([
      'A-2',
      'A-3',
      'A-1'
    ])
  })

  it('元の配列を破壊しない', () => {
    const windows = [win('A', 2), win('A', 1)]
    sortWindowsInApp(windows, { sortByPosition: false, layout: 'bottom' })
    expect(names(windows)).toEqual(['A-2', 'A-1'])
  })
})

describe('groupWindowsByApp', () => {
  const base = { sortByPosition: false, layout: 'bottom', appOrder: [] as string[] }

  it('同一アプリのウィンドウが隣接する', () => {
    const result = groupWindowsByApp([win('A', 1), win('B', 2), win('A', 3), win('B', 4)], base)
    expect(names(result)).toEqual(['A-1', 'A-3', 'B-2', 'B-4'])
  })

  it('入力順が揺れてもグループ内は起動順で安定する', () => {
    const shuffled = [win('B', 4), win('A', 3), win('B', 2), win('A', 1)]
    const result = groupWindowsByApp(shuffled, { ...base, appearanceOrder: ['A', 'B'] })
    expect(names(result)).toEqual(['A-1', 'A-3', 'B-2', 'B-4'])
  })

  it('appOrder が最優先される', () => {
    const result = groupWindowsByApp([win('A', 1), win('B', 2), win('C', 3)], {
      ...base,
      appOrder: ['C', 'A']
    })
    expect(names(result)).toEqual(['C-3', 'A-1', 'B-2'])
  })

  it('appOrder に無いアプリは appearanceOrder で続く', () => {
    const result = groupWindowsByApp([win('C', 1), win('B', 2), win('A', 3)], {
      ...base,
      appOrder: ['B'],
      appearanceOrder: ['A', 'C']
    })
    expect(names(result)).toEqual(['B-2', 'A-3', 'C-1'])
  })

  it('appOrder に実在しないアプリが混ざっていても無視される', () => {
    const result = groupWindowsByApp([win('A', 1), win('B', 2)], {
      ...base,
      appOrder: ['Ghost', 'B']
    })
    expect(names(result)).toEqual(['B-2', 'A-1'])
  })

  it('座標順オプションがグループ内に適用される', () => {
    const result = groupWindowsByApp([win('A', 1, 200), win('A', 2, 100), win('B', 3)], {
      ...base,
      sortByPosition: true
    })
    expect(names(result)).toEqual(['A-2', 'A-1', 'B-3'])
  })

  it('空配列は空配列を返す', () => {
    expect(groupWindowsByApp([], base)).toEqual([])
  })

  it('フォールバックのグループ順は最小ウィンドウ番号の昇順（入力順に依存せず決定的）', () => {
    const result1 = groupWindowsByApp([win('B', 4), win('B', 2), win('A', 3)], base)
    const result2 = groupWindowsByApp([win('A', 3), win('B', 2), win('B', 4)], base)
    expect(names(result1)).toEqual(['B-2', 'B-4', 'A-3'])
    expect(names(result2)).toEqual(names(result1))
  })
})

describe('chunkIntoGroups', () => {
  it('同一アプリの連続区間を1グループに束ねる', () => {
    const result = chunkIntoGroups([win('A', 1), win('A', 3), win('B', 2), win('B', 4)])
    expect(result).toEqual([
      { app: 'A', windows: [win('A', 1), win('A', 3)] },
      { app: 'B', windows: [win('B', 2), win('B', 4)] }
    ])
  })

  it('単一ウィンドウのアプリも1要素のグループになる（分岐なしで統一構造）', () => {
    const result = chunkIntoGroups([win('A', 1), win('B', 2), win('C', 3)])
    expect(result.map((g) => g.app)).toEqual(['A', 'B', 'C'])
    expect(result.every((g) => g.windows.length === 1)).toBe(true)
  })

  it('同一アプリが非連続（groupWindowsByApp を経ていない入力）だと別グループに分かれる', () => {
    // chunkIntoGroups 自体は「隣接」判定のみで、事前に groupWindowsByApp で
    // 同一アプリを隣接させておく契約に依存する（呼び出し側の責務）
    const result = chunkIntoGroups([win('A', 1), win('B', 2), win('A', 3)])
    expect(result.map((g) => g.app)).toEqual(['A', 'B', 'A'])
  })

  it('空配列は空配列を返す', () => {
    expect(chunkIntoGroups([])).toEqual([])
  })
})

describe('buildAppOrder', () => {
  it('既存 appOrder の並びを温存し、無いアプリを末尾に追加する', () => {
    const result = buildAppOrder(['X', 'A'], [win('B', 1), win('A', 2), win('C', 3)])
    expect(result).toEqual(['X', 'A', 'B', 'C'])
  })

  it('既存 appOrder が空なら表示順のアプリ列になる', () => {
    const result = buildAppOrder([], [win('B', 1), win('A', 2), win('B', 3)])
    expect(result).toEqual(['B', 'A'])
  })

  it('非表示アプリ（X）の位置が保持される', () => {
    // X は現在非表示だが、並び順リストからは消えない
    const result = buildAppOrder(['A', 'X', 'B'], [win('A', 1), win('B', 2)])
    expect(result).toEqual(['A', 'X', 'B'])
  })
})

describe('moveApp', () => {
  const apps = ['A', 'B', 'C', 'D']

  it('後方から前方へ: target の前に挿入される', () => {
    expect(moveApp(apps, 'D', 'B')).toEqual(['A', 'D', 'B', 'C'])
  })

  it('前方から後方へ: target の後ろに挿入される', () => {
    expect(moveApp(apps, 'A', 'C')).toEqual(['B', 'C', 'A', 'D'])
  })

  it('同一要素へのドロップは変化なし', () => {
    expect(moveApp(apps, 'B', 'B')).toEqual(apps)
  })

  it('存在しない要素は変化なし', () => {
    expect(moveApp(apps, 'X', 'B')).toEqual(apps)
    expect(moveApp(apps, 'B', 'X')).toEqual(apps)
  })

  it('元の配列を破壊しない', () => {
    moveApp(apps, 'D', 'A')
    expect(apps).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('shouldSwap', () => {
  // 幅100pxのボタンが x=0 と x=100 に並ぶ水平タスクバーを想定
  const rect = (
    left: number,
    width = 100
  ): { left: number; right: number; top: number; bottom: number } => ({
    left,
    right: left + width,
    top: 0,
    bottom: 40
  })
  const base = {
    fromIndex: 0,
    toIndex: 1,
    targetRect: rect(100),
    horizontal: true,
    lastSwapAt: 0,
    now: 10_000
  }

  it('前方→後方: ゴースト後端が閾値以上食い込んだら入れ替える', () => {
    // 閾値 = 100 * OVERLAP_RATIO = 30px
    expect(shouldSwap({ ...base, ghostRect: rect(100 - 100 + 31) })).toBe(true) // 31px 食い込み
    expect(shouldSwap({ ...base, ghostRect: rect(100 - 100 + 30) })).toBe(true) // 閾値ちょうど（>=）
    expect(shouldSwap({ ...base, ghostRect: rect(100 - 100 + 29) })).toBe(false) // 29px
  })

  it('後方→前方: ゴースト前端側の食い込みで判定する', () => {
    const back = { ...base, fromIndex: 2, toIndex: 1 }
    // targetRect.right(200) - ghostRect.left >= 30 で入れ替え
    expect(shouldSwap({ ...back, ghostRect: rect(169) })).toBe(true) // 200-169=31
    expect(shouldSwap({ ...back, ghostRect: rect(171) })).toBe(false) // 200-171=29
  })

  it('クールダウン中は入れ替えない', () => {
    const input = { ...base, ghostRect: rect(50), lastSwapAt: 10_000 - REORDER_COOLDOWN_MS + 1 }
    expect(shouldSwap(input)).toBe(false)
    expect(shouldSwap({ ...input, lastSwapAt: 10_000 - REORDER_COOLDOWN_MS })).toBe(true)
  })

  it('垂直レイアウトでは Y 方向で判定する', () => {
    const vRect = (top: number): { left: number; right: number; top: number; bottom: number } => ({
      left: 0,
      right: 200,
      top,
      bottom: top + 40
    })
    const vertical = {
      ...base,
      horizontal: false,
      targetRect: vRect(40)
    }
    // 閾値 = 40 * 0.3 = 12px
    expect(shouldSwap({ ...vertical, ghostRect: vRect(13) })).toBe(true) // 53-40=13
    expect(shouldSwap({ ...vertical, ghostRect: vRect(11) })).toBe(false) // 51-40=11
  })

  it('自分自身・不明なインデックスは常に false', () => {
    expect(shouldSwap({ ...base, ghostRect: rect(100), fromIndex: 1, toIndex: 1 })).toBe(false)
    expect(shouldSwap({ ...base, ghostRect: rect(100), fromIndex: -1 })).toBe(false)
  })

  it('OVERLAP_RATIO は小さいほうの矩形を基準にする', () => {
    // ターゲットが 40px と小さい場合、閾値 = 40 * 0.3 = 12px
    const smallTarget = { ...base, targetRect: rect(100, 40) }
    expect(shouldSwap({ ...smallTarget, ghostRect: rect(13) })).toBe(true) // 113-100=13
    expect(shouldSwap({ ...smallTarget, ghostRect: rect(11) })).toBe(false)
  })
})

describe('rectsSeparated', () => {
  // 幅100pxの矩形が x=0 と x=100 に並ぶ水平タスクバーを想定
  const rect = (
    left: number,
    width = 100
  ): { left: number; right: number; top: number; bottom: number } => ({
    left,
    right: left + width,
    top: 0,
    bottom: 40
  })

  it('重なっていれば false（完全に離れていない）', () => {
    expect(rectsSeparated(rect(50), rect(100), true)).toBe(false) // 50-150 と 100-200 は重なる
  })

  it('隙間なく接しているだけなら true（重なりゼロ）', () => {
    expect(rectsSeparated(rect(0), rect(100), true)).toBe(true) // 0-100 と 100-200 は接するのみ
  })

  it('完全に離れていれば true', () => {
    expect(rectsSeparated(rect(0), rect(200), true)).toBe(true)
  })

  it('垂直レイアウトでは Y 方向で判定する', () => {
    const vRect = (top: number): { left: number; right: number; top: number; bottom: number } => ({
      left: 0,
      right: 200,
      top,
      bottom: top + 40
    })
    expect(rectsSeparated(vRect(20), vRect(40), false)).toBe(false) // 20-60 と 40-80 は重なる
    expect(rectsSeparated(vRect(0), vRect(40), false)).toBe(true)
  })
})

describe('sameJson', () => {
  it('キーの順序が違っても同じ値なら等しい', () => {
    expect(
      sameJson(
        { a: 1, b: [1, 2], c: { x: true, y: 'z' } },
        { c: { y: 'z', x: true }, b: [1, 2], a: 1 }
      )
    ).toBe(true)
  })
  it('値が違えば等しくない', () => {
    expect(sameJson({ a: 1, b: true }, { a: 1, b: false })).toBe(false)
  })
  it('配列の順序は区別する', () => {
    expect(sameJson({ list: [1, 2] }, { list: [2, 1] })).toBe(false)
  })
})
