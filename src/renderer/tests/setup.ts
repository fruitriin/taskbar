import { mock } from 'bun:test'

// グローバルwindowオブジェクトの作成（テスト環境用）
if (typeof window === 'undefined') {
  // @ts-ignore
  globalThis.window = globalThis
}

// Electron APIのモック (renderer側)
mock.module('@electron-toolkit/preload', () => ({
  ElectronAPI: {},
  IpcRendererEvent: {}
}))

// window.electron のモック
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      on: mock(),
      send: mock(),
      removeListener: mock()
    }
  },
  writable: true
})

// window.store のモック
Object.defineProperty(window, 'store', {
  value: {
    granted: true,
    options: {
      layout: 'bottom',
      windowSortByPositionInApp: false,
      headers: [],
      footers: []
    },
    filters: []
  },
  writable: true
})
