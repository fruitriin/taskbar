import { describe, expect, it } from 'bun:test'
import { isOverlapping, getTaskbarBounds, adjustWindowToAvoidTaskbar } from '@/funcs/window-collision'
import type { Display } from 'electron'

describe('window-collision', () => {
  describe('isOverlapping', () => {
    it('重なっている矩形を検出する', () => {
      const rect1 = { x: 0, y: 0, width: 100, height: 100 }
      const rect2 = { x: 50, y: 50, width: 100, height: 100 }
      expect(isOverlapping(rect1, rect2)).toBe(true)
    })

    it('重なっていない矩形を検出する', () => {
      const rect1 = { x: 0, y: 0, width: 100, height: 100 }
      const rect2 = { x: 200, y: 200, width: 100, height: 100 }
      expect(isOverlapping(rect1, rect2)).toBe(false)
    })

    it('隣接している矩形は重なっていないと判定する', () => {
      const rect1 = { x: 0, y: 0, width: 100, height: 100 }
      const rect2 = { x: 100, y: 0, width: 100, height: 100 }
      expect(isOverlapping(rect1, rect2)).toBe(false)
    })
  })

  describe('getTaskbarBounds', () => {
    const mockDisplay: Display = {
      id: 1,
      label: 'Test Display',
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      size: { width: 1920, height: 1080 },
      workAreaSize: { width: 1920, height: 1080 },
      scaleFactor: 1,
      rotation: 0,
      touchSupport: 'unknown',
      monochrome: false,
      accelerometerSupport: 'unknown',
      colorSpace: '',
      colorDepth: 24,
      depthPerComponent: 8,
      displayFrequency: 60,
      internal: false,
      maximumCursorSize: { width: 64, height: 64 },
      nativeOrigin: { x: 0, y: 0 }
    }

    it('右側タスクバーの矩形を取得する', () => {
      const bounds = getTaskbarBounds(mockDisplay, 'right')
      expect(bounds).toEqual({
        x: 1710, // 1920 - 210
        y: 0,
        width: 210,
        height: 1080
      })
    })

    it('左側タスクバーの矩形を取得する', () => {
      const bounds = getTaskbarBounds(mockDisplay, 'left')
      expect(bounds).toEqual({
        x: 0,
        y: 0,
        width: 210,
        height: 1080
      })
    })

    it('下側タスクバーの矩形を取得する', () => {
      const bounds = getTaskbarBounds(mockDisplay, 'bottom')
      expect(bounds).toEqual({
        x: 0,
        y: 1020, // 1080 - 60
        width: 1920,
        height: 60
      })
    })
  })

  describe('adjustWindowToAvoidTaskbar', () => {
    const mockWindow: MacWindow = {
      kCGWindowLayer: 0,
      kCGWindowName: 'Test Window',
      kCGWindowMemoryUsage: 1000,
      kCGWindowIsOnscreen: 1,
      kCGWindowSharingState: 1,
      kCGWindowOwnerPID: 1234,
      kCGWindowOwnerName: 'TestApp',
      kCGWindowNumber: 1,
      kCGWindowBounds: {
        X: 1600,
        Y: 100,
        Width: 400,
        Height: 600
      },
      appIcon: ''
    }

    const taskbarBoundsRight = { x: 1710, y: 0, width: 210, height: 1080 }

    it('タスクバーと重なっているウィンドウを調整する（右側）', () => {
      const adjustment = adjustWindowToAvoidTaskbar(mockWindow, taskbarBoundsRight, 'right')
      expect(adjustment).not.toBeNull()
      expect(adjustment?.newWidth).toBe(110) // 1710 - 1600
      expect(adjustment?.newX).toBe(1600)
      expect(adjustment?.newY).toBe(100)
    })

    it('タスクバーと重なっていないウィンドウは調整しない', () => {
      const nonOverlappingWindow: MacWindow = {
        ...mockWindow,
        kCGWindowBounds: {
          X: 100,
          Y: 100,
          Width: 400,
          Height: 600
        }
      }
      const adjustment = adjustWindowToAvoidTaskbar(
        nonOverlappingWindow,
        taskbarBoundsRight,
        'right'
      )
      expect(adjustment).toBeNull()
    })

    it('下側タスクバーと重なっているウィンドウを調整する', () => {
      const taskbarBoundsBottom = { x: 0, y: 1020, width: 1920, height: 60 }
      const overlappingWindow: MacWindow = {
        ...mockWindow,
        kCGWindowBounds: {
          X: 100,
          Y: 900,
          Width: 800,
          Height: 200 // 900 + 200 = 1100, タスクバーの開始位置1020を超える
        }
      }
      const adjustment = adjustWindowToAvoidTaskbar(overlappingWindow, taskbarBoundsBottom, 'bottom')
      expect(adjustment).not.toBeNull()
      expect(adjustment?.newHeight).toBe(120) // 1020 - 900
      expect(adjustment?.newX).toBe(100)
      expect(adjustment?.newY).toBe(900)
    })
  })
})
