/**
 * ブラウザでのUIテスト用モックデータ
 * 実際のTaskbarHelperから取得したデータ構造に基づいています
 */

export interface MacWindow {
  kCGWindowAlpha?: number
  kCGWindowBounds: {
    Height: number
    Width: number
    X: number
    Y: number
  }
  kCGWindowIsOnscreen?: boolean
  kCGWindowLayer: number
  kCGWindowMemoryUsage: number
  kCGWindowName?: string
  kCGWindowNumber: number
  kCGWindowOwnerName?: string
  kCGWindowOwnerPID: number
  kCGWindowSharingState: number
  kCGWindowStoreType?: number
  appIcon?: string
}

/**
 * サンプルウィンドウデータ（一般的なアプリケーション）
 */
export const sampleWindows: MacWindow[] = [
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: { Height: 800, Width: 1200, X: 100, Y: 100 },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2048000,
    kCGWindowName: 'Document1.txt',
    kCGWindowNumber: 12345,
    kCGWindowOwnerName: 'TextEdit',
    kCGWindowOwnerPID: 1234,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2,
    appIcon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: { Height: 900, Width: 1400, X: 200, Y: 150 },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 5120000,
    kCGWindowName: 'GitHub - Chrome',
    kCGWindowNumber: 12346,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowOwnerPID: 2345,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2,
    appIcon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: { Height: 700, Width: 1000, X: 300, Y: 200 },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 3072000,
    kCGWindowName: 'Taskbar.fm - Code - Visual Studio Code',
    kCGWindowNumber: 12347,
    kCGWindowOwnerName: 'Code',
    kCGWindowOwnerPID: 3456,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2,
    appIcon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg=='
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: { Height: 600, Width: 800, X: 400, Y: 250 },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 1536000,
    kCGWindowName: 'Terminal',
    kCGWindowNumber: 12348,
    kCGWindowOwnerName: 'Terminal',
    kCGWindowOwnerPID: 4567,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2,
    appIcon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKQAAAABJRU5ErkJggg=='
  }
]

/**
 * アイコンデータのサンプル
 */
export const sampleIcons: Record<string, string> = {
  '1234': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  '2345': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  '3456': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==',
  '4567': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKQAAAABJRU5ErkJggg=='
}

/**
 * ディスプレイ情報のサンプル
 */
export const sampleDisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 23, width: 1920, height: 1057 },
  scaleFactor: 2,
  rotation: 0
}
