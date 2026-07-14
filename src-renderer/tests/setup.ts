import { mock } from 'bun:test'
import { createElectronMock, createStoreMock } from '../src/mocks/electron-mocks'

// グローバルwindowオブジェクトの作成（テスト環境用）
if (typeof window === 'undefined') {
  // @ts-ignore テスト環境には window が無いため globalThis で代用する
  globalThis.window = globalThis
}

// window.electron のモック（テスト用にmock()でラップ）
const electronMock = createElectronMock()
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      on: mock(electronMock.ipcRenderer.on),
      send: mock(electronMock.ipcRenderer.send),
      removeListener: mock(electronMock.ipcRenderer.removeListener),
      invoke: mock(electronMock.ipcRenderer.invoke)
    }
  },
  writable: true
})

// window.store のモック
Object.defineProperty(window, 'store', {
  value: createStoreMock(),
  writable: true
})
