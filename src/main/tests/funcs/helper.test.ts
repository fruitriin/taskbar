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

// MacWindowの型定義をモック
const mockMacWindow: MacWindow = {
  kCGWindowLayer: 0,
  kCGWindowName: 'TestWindow',
  kCGWindowMemoryUsage: 1024,
  kCGWindowIsOnscreen: 1,
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
  appIcon: ''
}

describe('helper', () => {
  describe('filterProcesses', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      
      // デフォルトのlabeledFiltersを設定
      const defaultLabeledFilters: LabeledFilters[] = [
        {
          label: 'Dockを除外',
          filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
        },
        {
          label: 'Spotlightを除外',
          filters: [{ property: 'kCGWindowOwnerName', is: 'Spotlight' }]
        },
        {
          label: 'Taskbar.fmアプリを除外',
          filters: [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }]
        },
        {
          label: 'Taskbar.fmウィンドウを除外',
          filters: [{ property: 'kCGWindowName', is: 'taskbar.fm' }]
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

    it('通常のウィンドウはフィルタリングされない', () => {
      const windows = [
        { ...mockMacWindow, kCGWindowOwnerName: 'Safari' },
        { ...mockMacWindow, kCGWindowOwnerName: 'Chrome' }
      ]

      const result = filterProcesses(windows)

      expect(result).toEqual(windows)
    })

    it('Dockはフィルタリングされる', () => {
      const windows = [
        { ...mockMacWindow, kCGWindowOwnerName: 'Safari' },
        { ...mockMacWindow, kCGWindowOwnerName: 'Dock' },
        { ...mockMacWindow, kCGWindowOwnerName: 'Chrome' }
      ]

      const result = filterProcesses(windows)

      expect(result).toHaveLength(2)
      expect(result).not.toContainEqual(expect.objectContaining({ kCGWindowOwnerName: 'Dock' }))
    })

    it('taskbar.fmはフィルタリングされる', () => {
      const windows = [
        { ...mockMacWindow, kCGWindowOwnerName: 'Safari' },
        { ...mockMacWindow, kCGWindowOwnerName: 'taskbar.fm' },
        { ...mockMacWindow, kCGWindowName: 'taskbar.fm' }
      ]

      const result = filterProcesses(windows)

      expect(result).toHaveLength(1)
      expect(result).not.toContainEqual(
        expect.objectContaining({ kCGWindowOwnerName: 'taskbar.fm' })
      )
      expect(result).not.toContainEqual(expect.objectContaining({ kCGWindowName: 'taskbar.fm' }))
    })

    it('複数のフィルタ条件が正しく適用される', () => {
      const windows = [
        { ...mockMacWindow, kCGWindowOwnerName: 'Safari' },
        { ...mockMacWindow, kCGWindowOwnerName: 'Dock' },
        { ...mockMacWindow, kCGWindowOwnerName: 'Spotlight' },
        { ...mockMacWindow, kCGWindowOwnerName: 'Chrome' }
      ]

      const result = filterProcesses(windows)

      expect(result).toHaveLength(2)
      expect(result).toContainEqual(expect.objectContaining({ kCGWindowOwnerName: 'Safari' }))
      expect(result).toContainEqual(expect.objectContaining({ kCGWindowOwnerName: 'Chrome' }))
    })

    it('空の配列が渡された場合は空の配列を返す', () => {
      const result = filterProcesses([])

      expect(result).toEqual([])
    })
  })
})
