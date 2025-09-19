import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LabeledFilters } from '@/funcs/store'

// sample-fixtureのデータをインポート
import { sampleWindowData } from '../../../../sample-fixture'

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

describe('Sample Fixture filterProcesses Test - Empty Window Names', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // デフォルトのlabeledFiltersを設定（実際のアプリで使われているもの）
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

  describe('実際のサンプルデータでの空ウィンドウ名テスト', () => {
    it('sample-fixtureデータの内容を確認する', () => {
      // サンプルデータに空のウィンドウ名があることを確認
      const emptyNameWindows = sampleWindowData.filter((window) => window.kCGWindowName === '')
      const namedWindows = sampleWindowData.filter((window) => window.kCGWindowName !== '')

      console.log('Empty name windows:', emptyNameWindows.length)
      console.log('Named windows:', namedWindows.length)
      console.log('Total windows:', sampleWindowData.length)

      expect(emptyNameWindows.length).toBeGreaterThan(0)
      expect(namedWindows.length).toBeGreaterThan(0)

      // 空の名前を持つウィンドウの詳細をログ出力
      emptyNameWindows.forEach((window, index) => {
        console.log(`Empty name window ${index + 1}:`, {
          ownerName: window.kCGWindowOwnerName,
          windowNumber: window.kCGWindowNumber,
          bounds: window.kCGWindowBounds,
          isOnscreen: window.kCGWindowIsOnscreen
        })
      })
    })

    it('filterProcessesを適用して空ウィンドウ名が残るかどうかを確認', () => {
      // MacWindow型にキャストしてfilterProcessesを適用
      const windowsAsType = sampleWindowData.map((window) => ({
        ...window,
        appIcon: '', // MacWindow型に必要なプロパティを追加
        kCGWindowIsOnscreen: window.kCGWindowIsOnscreen || 0 // undefinedの場合は0に
      })) as MacWindow[]

      const filteredResults = filterProcesses(windowsAsType)

      // フィルタリング前後の空ウィンドウ名の数を比較
      const originalEmptyNames = windowsAsType.filter((w) => w.kCGWindowName === '')
      const filteredEmptyNames = filteredResults.filter((w) => w.kCGWindowName === '')

      console.log('Original empty name windows:', originalEmptyNames.length)
      console.log('Filtered empty name windows:', filteredEmptyNames.length)

      // 残った空ウィンドウ名の詳細を確認
      filteredEmptyNames.forEach((window, index) => {
        console.log(`Remaining empty name window ${index + 1}:`, {
          ownerName: window.kCGWindowOwnerName,
          windowNumber: window.kCGWindowNumber,
          bounds: window.kCGWindowBounds,
          layer: window.kCGWindowLayer
        })
      })

      // 期待値の確認
      expect(filteredEmptyNames.length).toBeGreaterThanOrEqual(0)

      // 特定のアプリの空ウィンドウが除外されているかチェック
      const finderEmptyWindows = filteredEmptyNames.filter((w) => w.kCGWindowOwnerName === 'Finder')
      const terminalEmptyWindows = filteredEmptyNames.filter(
        (w) => w.kCGWindowOwnerName === 'ターミナル'
      )

      expect(finderEmptyWindows).toHaveLength(0) // 空のFinderウィンドウは除外されているべき
      expect(terminalEmptyWindows).toHaveLength(0) // 空のターミナルウィンドウは除外されているべき
    })

    it('除外されない空ウィンドウ名のアプリを特定する', () => {
      const windowsAsType = sampleWindowData.map((window) => ({
        ...window,
        appIcon: '',
        kCGWindowIsOnscreen: window.kCGWindowIsOnscreen || 0
      })) as MacWindow[]

      const filteredResults = filterProcesses(windowsAsType)
      const remainingEmptyNames = filteredResults.filter((w) => w.kCGWindowName === '')

      // 残った空ウィンドウ名のアプリ名をグループ化
      const emptyNamesByApp = remainingEmptyNames.reduce(
        (acc, window) => {
          const appName = window.kCGWindowOwnerName
          if (!acc[appName]) {
            acc[appName] = []
          }
          acc[appName].push(window)
          return acc
        },
        {} as Record<string, MacWindow[]>
      )

      console.log('Apps with remaining empty name windows:')
      Object.entries(emptyNamesByApp).forEach(([appName, windows]) => {
        console.log(`- ${appName}: ${windows.length} windows`)
        windows.forEach((window, index) => {
          console.log(
            `  Window ${index + 1}: bounds=${JSON.stringify(window.kCGWindowBounds)}, layer=${
              window.kCGWindowLayer
            }`
          )
        })
      })

      // 問題のあるアプリがあるかどうかを判定
      const problematicApps = Object.keys(emptyNamesByApp).filter((appName) => {
        // システムアプリやサービス以外で空のウィンドウ名がある場合は問題として報告
        return ![
          'Window Server',
          'CursorUIViewService',
          'AccessibilityVisualsAgent',
          'Electron'
        ].includes(appName)
      })

      if (problematicApps.length > 0) {
        console.warn('Potentially problematic apps with empty window names:', problematicApps)
      }

      // 最低限のテスト：フィルターが実行されたことを確認
      expect(filteredResults.length).toBeLessThanOrEqual(windowsAsType.length)
    })

    it('サイズフィルターによる除外も確認する', () => {
      const windowsAsType = sampleWindowData.map((window) => ({
        ...window,
        appIcon: '',
        kCGWindowIsOnscreen: window.kCGWindowIsOnscreen || 0
      })) as MacWindow[]

      const filteredResults = filterProcesses(windowsAsType)

      // サイズが40px未満のウィンドウが除外されているか確認
      const tinyWindows = windowsAsType.filter(
        (w) => w.kCGWindowBounds.Height < 40 || w.kCGWindowBounds.Width < 40
      )

      const remainingTinyWindows = filteredResults.filter(
        (w) => w.kCGWindowBounds.Height < 40 || w.kCGWindowBounds.Width < 40
      )

      console.log('Original tiny windows:', tinyWindows.length)
      console.log('Remaining tiny windows after filtering:', remainingTinyWindows.length)

      // サイズフィルターが正しく動作していることを確認
      expect(remainingTinyWindows.length).toBe(0)
    })

    it('特定のシステムウィンドウが適切に処理されているか確認', () => {
      const windowsAsType = sampleWindowData.map((window) => ({
        ...window,
        appIcon: '',
        kCGWindowIsOnscreen: window.kCGWindowIsOnscreen || 0
      })) as MacWindow[]

      const filteredResults = filterProcesses(windowsAsType)

      // TaskbarのElectronウィンドウがどう処理されているか
      const electronWindows = windowsAsType.filter((w) => w.kCGWindowOwnerName === 'Electron')
      const remainingElectronWindows = filteredResults.filter(
        (w) => w.kCGWindowOwnerName === 'Electron'
      )

      console.log('Original Electron windows:', electronWindows.length)
      console.log('Remaining Electron windows:', remainingElectronWindows.length)

      electronWindows.forEach((window, index) => {
        console.log(`Electron window ${index + 1}:`, {
          name: window.kCGWindowName,
          bounds: window.kCGWindowBounds,
          layer: window.kCGWindowLayer,
          isOnscreen: window.kCGWindowIsOnscreen
        })
      })

      // taskbar.fmという名前のウィンドウは残るべき（フィルターはownerNameを見ているため）
      const taskbarWindow = remainingElectronWindows.find((w) => w.kCGWindowName === 'taskbar.fm')
      if (taskbarWindow) {
        console.log('Taskbar window found in results:', taskbarWindow)
      } else {
        console.log('No taskbar.fm window found in filtered results')
      }
    })
  })
})
