import { mock } from 'bun:test'

// @electron-toolkit/utilsのモック
mock.module('@electron-toolkit/utils', () => ({
  is: {
    dev: false
  }
}))

// Electron APIのモック
mock.module('electron', () => ({
  BrowserWindow: mock(() => ({
    isDestroyed: mock(() => false),
    destroy: mock(),
    close: mock(),
    show: mock(),
    setBounds: mock(),
    setWindowButtonVisibility: mock(),
    webContents: {
      send: mock()
    },
    on: mock()
  })),
  ipcMain: {
    on: mock(),
    removeListener: mock()
  },
  screen: {
    getAllDisplays: mock(),
    on: mock(),
    getCursorScreenPoint: mock()
  },
  app: {
    quit: mock(),
    relaunch: mock(),
    isPackaged: false,
    getPath: mock((name: string) => {
      if (name === 'userData') return '/mock/userData'
      return '/mock/path'
    })
  },
  Menu: mock(() => ({
    append: mock()
  })),
  MenuItem: mock(() => ({
    label: '',
    click: mock()
  }))
}))

// ネイティブプロセスのモック
mock.module('child_process', () => ({
  spawn: mock(() => ({
    stdout: {
      on: mock(),
      [Symbol.asyncIterator]: mock()
    },
    stderr: { on: mock() },
    on: mock()
  })),
  exec: mock()
}))

// ファイルシステムのモック
mock.module('fs', () => ({
  default: {
    existsSync: mock(),
    readFileSync: mock(),
    writeFileSync: mock(),
    appendFileSync: mock(),
    mkdirSync: mock(),
    watch: mock()
  },
  existsSync: mock(),
  readFileSync: mock(),
  writeFileSync: mock(),
  appendFileSync: mock(),
  mkdirSync: mock(),
  watch: mock()
}))

// electron-storeのモック
mock.module('electron-store', () => ({
  default: class {
    get = mock()
    set = mock()
    clear = mock()
    store = {
      options: {
        layout: 'bottom',
        windowSortByPositionInApp: false,
        headers: [],
        footers: []
      },
      filters: [
        [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
        [{ property: 'kCGWindowOwnerName', is: 'Finder' }],
        [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }],
        [{ property: 'kCGWindowName', is: 'taskbar.fm' }],
        [{ property: 'kCGWindowOwnerName', is: 'Spotlight' }]
      ]
    }
  }
}))

// just-diffのモック
mock.module('just-diff', () => ({
  diff: mock()
}))

mock.module('just-diff-apply', () => ({
  diffApply: mock()
}))
