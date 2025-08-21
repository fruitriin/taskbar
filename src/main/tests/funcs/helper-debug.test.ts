import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LabeledFilters } from '@/funcs/store'

// ストアのモック
vi.mock('@/funcs/store', () => ({
  store: {
    get: vi.fn(),
    store: {}
  }
}))

import { filterProcesses } from '@/funcs/helper'
import { store } from '@/funcs/store'

// テスト用のWindowデータ
const createTestWindow = (overrides: any = {}): MacWindow => ({
  kCGWindowLayer: 0,
  kCGWindowName: 'TestWindow',
  kCGWindowMemoryUsage: 1024,
  kCGWindowIsOnscreen: true,
  kCGWindowSharingState: 1,
  kCGWindowOwnerPID: 12345,
  kCGWindowOwnerName: 'TestApp',
  kCGWindowNumber: 123,
  kCGWindowStoreType: 2,
  kCGWindowBounds: {
    X: 100,
    Height: 600,
    Y: 50,
    Width: 800
  },
  appIcon: '',
  ...overrides
})

describe('Helper filterProcesses - Debug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('デバッグ: フィルタリングなしの場合すべてのウィンドウが残る', () => {
    // フィルターを空に設定
    vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
      if (key === 'labeledFilters') {
        return []
      }
      if (key === 'filters') {
        return []
      }
      return defaultValue
    })

    const windows = [
      createTestWindow({ kCGWindowOwnerName: 'Safari' }),
      createTestWindow({ kCGWindowOwnerName: 'Dock' }),
      createTestWindow({ kCGWindowOwnerName: 'Chrome' })
    ]

    const result = filterProcesses(windows)

    console.log(
      'Input windows:',
      windows.map((w) => w.kCGWindowOwnerName)
    )
    console.log(
      'Output windows:',
      result.map((w) => w.kCGWindowOwnerName)
    )
    console.log('Filters applied:', vi.mocked(store.get).mock.calls)

    expect(result).toHaveLength(3)
  })

  it('デバッグ: Dockフィルターが正しく動作する', () => {
    const dockFilter: LabeledFilters[] = [
      {
        label: 'Dockを除外',
        filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
      }
    ]

    vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
      if (key === 'labeledFilters') {
        return dockFilter
      }
      if (key === 'filters') {
        return []
      }
      return defaultValue
    })

    const windows = [
      createTestWindow({ kCGWindowOwnerName: 'Safari' }),
      createTestWindow({ kCGWindowOwnerName: 'Dock' }),
      createTestWindow({ kCGWindowOwnerName: 'Chrome' })
    ]

    const result = filterProcesses(windows)

    console.log('Applied filter:', dockFilter)
    console.log(
      'Input windows:',
      windows.map((w) => w.kCGWindowOwnerName)
    )
    console.log(
      'Output windows:',
      result.map((w) => w.kCGWindowOwnerName)
    )

    expect(result).toHaveLength(2)
    expect(result.map((w) => w.kCGWindowOwnerName)).toEqual(['Safari', 'Chrome'])
    expect(result.map((w) => w.kCGWindowOwnerName)).not.toContain('Dock')
  })

  it('デバッグ: 複合フィルター（FinderかつWindow名が空）の動作確認', () => {
    const finderFilter: LabeledFilters[] = [
      {
        label: '空のFinderウィンドウを除外',
        filters: [
          { property: 'kCGWindowOwnerName', is: 'Finder' },
          { property: 'kCGWindowName', is: '' }
        ]
      }
    ]

    vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
      if (key === 'labeledFilters') {
        return finderFilter
      }
      if (key === 'filters') {
        return []
      }
      return defaultValue
    })

    const windows = [
      createTestWindow({ kCGWindowOwnerName: 'Finder', kCGWindowName: 'Documents' }),
      createTestWindow({ kCGWindowOwnerName: 'Finder', kCGWindowName: '' }),
      createTestWindow({ kCGWindowOwnerName: 'Safari', kCGWindowName: '' }),
      createTestWindow({ kCGWindowOwnerName: 'Chrome' })
    ]

    const result = filterProcesses(windows)

    console.log('Applied filter:', finderFilter)
    console.log(
      'Input windows:',
      windows.map((w) => `${w.kCGWindowOwnerName}:"${w.kCGWindowName}"`)
    )
    console.log(
      'Output windows:',
      result.map((w) => `${w.kCGWindowOwnerName}:"${w.kCGWindowName}"`)
    )

    // 空のFinderウィンドウのみ除外される
    expect(result).toHaveLength(3)
    expect(result.map((w) => w.kCGWindowOwnerName)).toContain('Finder') // Documents Finder
    expect(result.map((w) => w.kCGWindowOwnerName)).toContain('Safari')
    expect(result.map((w) => w.kCGWindowOwnerName)).toContain('Chrome')

    // 空のFinderウィンドウは除外される
    const emptyFinderExists = result.some(
      (w) => w.kCGWindowOwnerName === 'Finder' && w.kCGWindowName === ''
    )
    expect(emptyFinderExists).toBe(false)
  })

  it('デバッグ: レガシーフィルターの動作確認', () => {
    const legacyFilters = [[{ property: 'kCGWindowOwnerName', is: 'Spotlight' }]]

    vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
      if (key === 'labeledFilters') {
        return []
      }
      if (key === 'filters') {
        return legacyFilters
      }
      return defaultValue
    })

    const windows = [
      createTestWindow({ kCGWindowOwnerName: 'Safari' }),
      createTestWindow({ kCGWindowOwnerName: 'Spotlight' }),
      createTestWindow({ kCGWindowOwnerName: 'Chrome' })
    ]

    const result = filterProcesses(windows)

    console.log('Applied legacy filter:', legacyFilters)
    console.log(
      'Input windows:',
      windows.map((w) => w.kCGWindowOwnerName)
    )
    console.log(
      'Output windows:',
      result.map((w) => w.kCGWindowOwnerName)
    )

    expect(result).toHaveLength(2)
    expect(result.map((w) => w.kCGWindowOwnerName)).not.toContain('Spotlight')
  })

  it('デバッグ: 新旧フィルターが両方存在する場合', () => {
    const labeledFilters: LabeledFilters[] = [
      {
        label: 'Dockを除外',
        filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
      }
    ]

    const legacyFilters = [[{ property: 'kCGWindowOwnerName', is: 'Spotlight' }]]

    vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
      if (key === 'labeledFilters') {
        return labeledFilters
      }
      if (key === 'filters') {
        return legacyFilters
      }
      return defaultValue
    })

    const windows = [
      createTestWindow({ kCGWindowOwnerName: 'Safari' }),
      createTestWindow({ kCGWindowOwnerName: 'Dock' }),
      createTestWindow({ kCGWindowOwnerName: 'Spotlight' }),
      createTestWindow({ kCGWindowOwnerName: 'Chrome' })
    ]

    const result = filterProcesses(windows)

    console.log('Applied labeled filters:', labeledFilters)
    console.log('Applied legacy filters:', legacyFilters)
    console.log(
      'Input windows:',
      windows.map((w) => w.kCGWindowOwnerName)
    )
    console.log(
      'Output windows:',
      result.map((w) => w.kCGWindowOwnerName)
    )

    // DockとSpotlightの両方が除外される
    expect(result).toHaveLength(2)
    expect(result.map((w) => w.kCGWindowOwnerName)).toEqual(['Safari', 'Chrome'])
  })

  it('デバッグ: サイズフィルターの動作確認', () => {
    // @ts-ignore - Test mock parameter
    vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
      return defaultValue || []
    })

    const windows = [
      createTestWindow({
        kCGWindowOwnerName: 'NormalApp',
        kCGWindowBounds: { X: 0, Y: 0, Width: 800, Height: 600 }
      }),
      createTestWindow({
        kCGWindowOwnerName: 'TinyHeightApp',
        kCGWindowBounds: { X: 0, Y: 0, Width: 800, Height: 30 }
      }),
      createTestWindow({
        kCGWindowOwnerName: 'TinyWidthApp',
        kCGWindowBounds: { X: 0, Y: 0, Width: 30, Height: 600 }
      })
    ]

    const result = filterProcesses(windows)

    console.log('Input windows with sizes:')
    windows.forEach((w) => {
      console.log(
        `  ${w.kCGWindowOwnerName}: ${w.kCGWindowBounds.Width}x${w.kCGWindowBounds.Height}`
      )
    })
    console.log(
      'Output windows:',
      result.map((w) => w.kCGWindowOwnerName)
    )

    // サイズが小さすぎるウィンドウは除外される
    expect(result).toHaveLength(1)
    expect(result[0].kCGWindowOwnerName).toBe('NormalApp')
  })

  it('デバッグ: フィルターの実行順序を確認', () => {
    const labeledFilters: LabeledFilters[] = [
      {
        label: 'Dockを除外',
        filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
      }
    ]

    vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
      console.log(`Store.get called with key: ${key}`)
      if (key === 'labeledFilters') {
        return labeledFilters
      }
      if (key === 'filters') {
        return []
      }
      return defaultValue
    })

    const windows = [
      createTestWindow({
        kCGWindowOwnerName: 'Dock',
        kCGWindowBounds: { X: 0, Y: 0, Width: 30, Height: 600 } // サイズも小さい
      })
    ]

    const result = filterProcesses(windows)

    console.log('Store.get calls:', vi.mocked(store.get).mock.calls)
    console.log('Result length:', result.length)

    // サイズフィルターで先に除外されるか、Dockフィルターで除外されるか
    expect(result).toHaveLength(0)
  })
})
