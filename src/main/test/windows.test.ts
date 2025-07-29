// tests/unit/main/windows.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWindow, windowPosition } from '@/main/funcs/windows'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  screen: { getAllDisplays: vi.fn() }
}))

describe('windows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('windowPosition', () => {
    it('右レイアウトで正しい位置を返す', () => {
      const mockDisplay = {
        id: 1,
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      }

      const result = windowPosition(mockDisplay, 'right')

      expect(result).toEqual({
        x: 1710, // 1920 - 210
        y: 0,
        width: 210,
        height: 1080
      })
    })
  })
})
