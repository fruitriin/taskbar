import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LabeledFilters } from '@/funcs/store'

import {
  sampleAppWindows,
  systemWindows,
  finderWindows,
  tinyWindows,
  taskbarWindows,
  mixedWindowScenario,
  expectedFilteredWindows,
  emptyWindowScenario,
  testHelpers
} from '../fixtures/taskbar-helper-fixtures'

// ストアのモック
vi.mock('@/funcs/store', () => ({
  store: {
    get: vi.fn(),
    store: {
      filters: []
    }
  }
}))

import { filterProcesses } from '@/funcs/helper'
import { store } from '@/funcs/store'

describe('Helper filterProcesses with LabeledFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // デフォルトのlabeledFiltersを設定
    const defaultLabeledFilters: LabeledFilters[] = [
      {
        label: 'オフスクリーンウィンドウを除外',
        filters: [{ property: 'kCGWindowIsOnscreen', is: false }]
      },
      {
        label: 'Dockを除外',
        filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
      },
      {
        label: 'Spotlightを除外',
        filters: [{ property: 'kCGWindowOwnerName', is: 'Spotlight' }]
      },
      {
        label: '通知センターを除外',
        filters: [{ property: 'kCGWindowName', is: 'Notification Center' }]
      },
      {
        label: 'コントロールセンターを除外',
        filters: [{ property: 'kCGWindowOwnerName', is: 'コントロールセンター' }]
      },
      {
        label: 'Taskbar.fmを除外',
        filters: [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }]
      },
      {
        label: '空のFinderウィンドウを除外',
        filters: [
          { property: 'kCGWindowOwnerName', is: 'Finder' },
          { property: 'kCGWindowName', is: '' }
        ]
      },
      {
        label: '空のターミナルウィンドウを除外',
        filters: [
          { property: 'kCGWindowOwnerName', is: 'ターミナル' },
          { property: 'kCGWindowName', is: '' }
        ]
      }
    ]

    vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
      if (key === 'labeledFilters') {
        return defaultLabeledFilters
      }
      if (key === 'filters') {
        return [] // レガシーフィルターは空
      }
      return defaultValue
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Size filtering', () => {
    it('40px未満の高さのウィンドウを除外する', () => {
      const result = filterProcesses(tinyWindows as MacWindow[])

      // tinyWindowsには高さ20pxのウィンドウが含まれている
      const tinyHeight = tinyWindows.find((w) => w.kCGWindowBounds.Height < 40)
      expect(tinyHeight).toBeDefined()

      // フィルタリング後には含まれていない
      const resultIds = result.map((w) => w.kCGWindowNumber)
      expect(resultIds).not.toContain(tinyHeight!.kCGWindowNumber)
    })

    it('40px未満の幅のウィンドウを除外する', () => {
      const result = filterProcesses(tinyWindows as MacWindow[])

      // tinyWindowsには幅30pxのウィンドウが含まれている
      const tinyWidth = tinyWindows.find((w) => w.kCGWindowBounds.Width < 40)
      expect(tinyWidth).toBeDefined()

      // フィルタリング後には含まれていない
      const resultIds = result.map((w) => w.kCGWindowNumber)
      expect(resultIds).not.toContain(tinyWidth!.kCGWindowNumber)
    })

    it('十分なサイズのウィンドウは残す', () => {
      const result = filterProcesses(sampleAppWindows as MacWindow[])

      // sampleAppWindowsはすべて十分なサイズなので、システムフィルター以外で除外されない
      expect(result.length).toBeGreaterThan(0)

      // 各ウィンドウが十分なサイズを持つことを確認
      result.forEach((window) => {
        expect(window.kCGWindowBounds.Height).toBeGreaterThanOrEqual(40)
        expect(window.kCGWindowBounds.Width).toBeGreaterThanOrEqual(40)
      })
    })
  })

  describe('LabeledFilters filtering', () => {
    it('Dockウィンドウを除外する', () => {
      const dockWindow = systemWindows.find((w) => w.kCGWindowOwnerName === 'Dock')!
      const result = filterProcesses([dockWindow] as MacWindow[])

      expect(result).toHaveLength(0)
    })

    it('Spotlightウィンドウを除外する', () => {
      const spotlightWindow = systemWindows.find((w) => w.kCGWindowOwnerName === 'Spotlight')!
      const result = filterProcesses([spotlightWindow] as MacWindow[])

      expect(result).toHaveLength(0)
    })

    it('通知センターウィンドウを除外する', () => {
      const notificationWindow = systemWindows.find(
        (w) => w.kCGWindowName === 'Notification Center'
      )!
      const result = filterProcesses([notificationWindow] as MacWindow[])

      expect(result).toHaveLength(0)
    })

    it('コントロールセンターを除外する', () => {
      const controlCenterWindow = systemWindows.find(
        (w) => w.kCGWindowOwnerName === 'コントロールセンター'
      )!
      const result = filterProcesses([controlCenterWindow] as MacWindow[])

      expect(result).toHaveLength(0)
    })

    it('Taskbar.fmウィンドウを除外する', () => {
      const result = filterProcesses(taskbarWindows as MacWindow[])

      expect(result).toHaveLength(0)
    })

    it('空のFinderウィンドウを除外する（複合条件）', () => {
      const emptyFinderWindow = finderWindows.find((w) => w.kCGWindowName === '')!
      const namedFinderWindow = finderWindows.find((w) => w.kCGWindowName !== '')!

      const result = filterProcesses([emptyFinderWindow, namedFinderWindow] as MacWindow[])

      // 空のFinderウィンドウは除外、名前のあるFinderウィンドウは残る
      expect(result).toHaveLength(1)
      expect(result[0].kCGWindowNumber).toBe(namedFinderWindow.kCGWindowNumber)
    })

    it('空のターミナルウィンドウを除外する（複合条件）', () => {
      const emptyTerminalWindow = testHelpers.generateRandomWindow({
        kCGWindowOwnerName: 'ターミナル',
        kCGWindowName: '',
        kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
      })
      
      const namedTerminalWindow = testHelpers.generateRandomWindow({
        kCGWindowOwnerName: 'ターミナル',
        kCGWindowName: 'Terminal — zsh — 80×24',
        kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
      })

      const result = filterProcesses([emptyTerminalWindow, namedTerminalWindow] as MacWindow[])

      // 空のターミナルウィンドウは除外、名前のあるターミナルウィンドウは残る
      expect(result).toHaveLength(1)
      expect(result[0].kCGWindowNumber).toBe(namedTerminalWindow.kCGWindowNumber)
    })

    it('一般的なアプリケーションウィンドウは残す', () => {
      const result = filterProcesses(sampleAppWindows as MacWindow[])

      // システムフィルターに該当しないアプリケーションウィンドウは残る
      expect(result.length).toBe(sampleAppWindows.length)

      const resultIds = result.map((w) => w.kCGWindowNumber)
      sampleAppWindows.forEach((window) => {
        expect(resultIds).toContain(window.kCGWindowNumber)
      })
    })
  })

  describe('Mixed scenarios', () => {
    it('複合シナリオで適切にフィルタリングする', () => {
      const result = filterProcesses(mixedWindowScenario as MacWindow[])

      // 期待される結果と比較
      const resultAppNames = result.map((w) => w.kCGWindowOwnerName)
      const expectedAppNames = (expectedFilteredWindows as MacWindow[]).map(
        (w) => w.kCGWindowOwnerName
      )

      // 結果と期待値を直接比較
      expect(resultAppNames).toEqual(expect.arrayContaining(expectedAppNames))
      expect(result).toHaveLength(expectedFilteredWindows.length)

      // 除外されるべきアプリが含まれていないことを確認
      expect(resultAppNames).not.toContain('Dock')
      expect(resultAppNames).not.toContain('Spotlight')
      expect(resultAppNames).not.toContain('taskbar.fm')

      // 残るべきアプリが含まれていることを確認
      expect(resultAppNames).toContain('TextEdit')
      expect(resultAppNames).toContain('Google Chrome')
      expect(resultAppNames).toContain('Code')
    })

    it('空の配列を適切に処理する', () => {
      const result = filterProcesses(emptyWindowScenario as MacWindow[])

      expect(result).toEqual([])
    })

    it('フィルター条件に一致しないウィンドウのみの場合', () => {
      // カスタムウィンドウを作成（どのフィルターにも該当しない）
      const customWindows: MacWindow[] = [
        testHelpers.generateRandomWindow({
          kCGWindowOwnerName: 'UnknownApp',
          kCGWindowName: 'Test Window',
          kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
        })
      ] as MacWindow[]

      const result = filterProcesses(customWindows)

      expect(result).toHaveLength(1)
      expect(result[0].kCGWindowOwnerName).toBe('UnknownApp')
    })
  })

  describe('Legacy filter compatibility', () => {
    it('レガシーフィルターも同時に処理する', () => {
      // レガシーフィルターを設定
      const legacyFilters = [[{ property: 'kCGWindowOwnerName', is: 'LegacyApp' }]]

      vi.mocked(store.get).mockImplementation((key: string, defaultValue: any) => {
        if (key === 'labeledFilters') {
          return [] // 新しいフィルターは空
        }
        if (key === 'filters') {
          return legacyFilters
        }
        return defaultValue
      })

      const legacyWindow = testHelpers.generateRandomWindow({
        kCGWindowOwnerName: 'LegacyApp',
        kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
      })

      const result = filterProcesses([legacyWindow] as MacWindow[])

      expect(result).toHaveLength(0) // レガシーフィルターで除外される
    })

    it('新旧フィルターが両方存在する場合', () => {
      // 両方のフィルター形式を設定
      const labeledFilters: LabeledFilters[] = [
        {
          label: 'NewAppを除外',
          filters: [{ property: 'kCGWindowOwnerName', is: 'NewApp' }]
        }
      ]

      const legacyFilters = [[{ property: 'kCGWindowOwnerName', is: 'OldApp' }]]

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
        testHelpers.generateRandomWindow({
          kCGWindowOwnerName: 'NewApp',
          kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
        }),
        testHelpers.generateRandomWindow({
          kCGWindowOwnerName: 'OldApp',
          kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
        }),
        testHelpers.generateRandomWindow({
          kCGWindowOwnerName: 'ValidApp',
          kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
        })
      ]

      const result = filterProcesses(windows as MacWindow[])

      // NewAppとOldAppの両方が除外され、ValidAppのみ残る
      expect(result).toHaveLength(1)
      expect(result[0].kCGWindowOwnerName).toBe('ValidApp')
    })
  })

  describe('Edge cases', () => {
    it('undefinedプロパティを持つウィンドウを適切に処理する', () => {
      const windowWithUndefined = {
        ...testHelpers.generateRandomWindow(),
        kCGWindowOwnerName: undefined as any
      }

      // undefinedプロパティではフィルターマッチしないので残る（サイズ条件は満たす）
      const result = filterProcesses([windowWithUndefined] as MacWindow[])

      expect(result).toHaveLength(1)
    })

    it('複数の条件すべてに一致する場合のみ除外する', () => {
      // 部分的にのみ一致するFinderウィンドウ
      const partialMatchWindow = testHelpers.generateRandomWindow({
        kCGWindowOwnerName: 'Finder',
        kCGWindowName: 'Documents', // 空ではない
        kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
      })

      const result = filterProcesses([partialMatchWindow] as MacWindow[])

      // Finderかつ空でないウィンドウなので、複合条件に一致せず残る
      expect(result).toHaveLength(1)
    })

    it('ストアからのデータ取得エラーを適切に処理する', () => {
      vi.mocked(store.get).mockImplementation(() => {
        throw new Error('Store access error')
      })

      // エラーが発生してもアプリがクラッシュしない
      expect(() => {
        filterProcesses(sampleAppWindows as MacWindow[])
      }).not.toThrow()
    })
  })

  describe('Performance considerations', () => {
    it('大量のウィンドウを効率的に処理する', () => {
      // 1000個のランダムウィンドウを生成
      const largeWindowSet: MacWindow[] = Array.from({ length: 1000 }, () =>
        testHelpers.generateRandomWindow({
          kCGWindowOwnerName: 'TestApp',
          kCGWindowBounds: { Height: 100, Width: 200, X: 0, Y: 0 }
        })
      ) as MacWindow[]

      const startTime = performance.now()
      const result = filterProcesses(largeWindowSet)
      const endTime = performance.now()

      // パフォーマンス確認（1秒以内に完了）
      expect(endTime - startTime).toBeLessThan(1000)

      // 結果が正しいことを確認
      expect(result).toHaveLength(1000) // どのフィルターにも該当しないので全て残る
    })
  })
})
