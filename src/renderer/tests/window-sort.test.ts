import { describe, it, expect } from 'bun:test'
import { sortWindowsInApp, groupWindowsByApp, moveApp, buildAppOrder } from '../src/utils'

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
