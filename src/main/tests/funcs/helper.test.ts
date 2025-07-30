import { describe, it, expect, vi, beforeEach } from 'vitest'
import { filterProcesses } from '@/main/funcs/helper'

// MacWindowの型定義をモック
const mockMacWindow = {
  kCGWindowOwnerName: 'TestApp',
  kCGWindowName: 'TestWindow',
  kCGWindowOwnerPID: 12345,
  kCGWindowIsOnscreen: true,
  appIcon: null
}

describe('helper', () => {
  describe('filterProcesses', () => {
    beforeEach(() => {
      vi.clearAllMocks()
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
