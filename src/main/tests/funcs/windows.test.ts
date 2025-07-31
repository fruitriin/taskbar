import { describe, it, expect } from 'vitest'
import { windowPosition } from '@/funcs/windows'

describe('windows', () => {
  describe('windowPosition', () => {
    const mockDisplay = {
      id: 1,
      label: 'Display 1',
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    }

    it('右レイアウトで正しい位置を返す', () => {
      const result = windowPosition(mockDisplay, 'right')

      expect(result).toEqual({
        x: 1710, // 1920 - 210
        y: 0,
        width: 210,
        height: 1080
      })
    })

    it('左レイアウトで正しい位置を返す', () => {
      const result = windowPosition(mockDisplay, 'left')

      expect(result).toEqual({
        x: 0,
        y: 0,
        width: 210,
        height: 1080
      })
    })

    it('下レイアウトで正しい位置を返す', () => {
      const result = windowPosition(mockDisplay, 'bottom')

      expect(result).toEqual({
        x: 0,
        y: 1020, // 1080 - 60
        width: 1920,
        height: 60
      })
    })

    it('異なるディスプレイサイズでも正しく動作する', () => {
      const smallDisplay = {
        id: 2,
        label: 'Display 2',
        workArea: { x: 100, y: 100, width: 1366, height: 768 }
      }

      const result = windowPosition(smallDisplay, 'right')

      expect(result).toEqual({
        x: 1256, // 100 + 1366 - 210
        y: 100,
        width: 210,
        height: 768
      })
    })
  })
})
