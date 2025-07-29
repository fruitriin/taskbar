import { vi } from 'vitest'

// Electron APIのモック (renderer側)
vi.mock('@electron-toolkit/preload', () => ({
  ElectronAPI: {},
  IpcRendererEvent: {}
}))

// window.electron のモック
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      on: vi.fn(),
      send: vi.fn(),
      removeListener: vi.fn()
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