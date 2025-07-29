import { vi } from 'vitest'

// @electron-toolkit/utilsのモック
vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: false
  }
}))

// Electron APIのモック
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => ({
    isDestroyed: vi.fn(() => false),
    destroy: vi.fn(),
    close: vi.fn(),
    show: vi.fn(),
    setBounds: vi.fn(),
    setWindowButtonVisibility: vi.fn(),
    webContents: {
      send: vi.fn()
    },
    on: vi.fn()
  })),
  ipcMain: {
    on: vi.fn(),
    removeListener: vi.fn()
  },
  screen: {
    getAllDisplays: vi.fn(),
    on: vi.fn(),
    getCursorScreenPoint: vi.fn()
  },
  app: {
    quit: vi.fn(),
    relaunch: vi.fn(),
    isPackaged: false
  },
  Menu: vi.fn(() => ({
    append: vi.fn()
  })),
  MenuItem: vi.fn(() => ({
    label: '',
    click: vi.fn()
  }))
}))

// ネイティブプロセスのモック
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: {
      on: vi.fn(),
      [Symbol.asyncIterator]: vi.fn()
    },
    stderr: { on: vi.fn() },
    on: vi.fn()
  })),
  exec: vi.fn()
}))

// ファイルシステムのモック
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}))

// electron-storeのモック
vi.mock('electron-store', () => ({
  default: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    store: {
      options: {
        layout: 'bottom'
      },
      filters: [
        [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
        [{ property: 'kCGWindowOwnerName', is: 'Finder' }],
        [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }],
        [{ property: 'kCGWindowName', is: 'taskbar.fm' }],
        [{ property: 'kCGWindowOwnerName', is: 'Spotlight' }]
      ]
    }
  }))
}))

// just-diffのモック
vi.mock('just-diff', () => ({
  diff: vi.fn()
}))

vi.mock('just-diff-apply', () => ({
  diffApply: vi.fn()
})) 