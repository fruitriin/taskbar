import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BrowserWindow, ipcMain, screen, Display } from 'electron'
import { store } from './store'

type LayoutType = 'right' | 'left' | 'bottom'

type Taskbar = BrowserWindow
type displayId = Display['id']
export const taskbars: Record<displayId, Taskbar> = {}
export type Taskbars = typeof taskbars

export function createAllWindows() {
  const allDisplays = screen.getAllDisplays()
  allDisplays.forEach((display) => {
    createWindow(display)
  })
}

export function createWindow(display: Display) {
  const taskbarWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    // resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    ...windowPosition(display, store.get('options').layout as LayoutType)
  })

  // 準備ができたら表示
  taskbarWindow.on('ready-to-show', () => {
    taskbarWindow.show()
  })
  // 閉じるボタンなどを消す
  taskbarWindow.setWindowButtonVisibility(false)

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    taskbarWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    taskbarWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  taskbars[display.id] = taskbarWindow
  ipcMain.on('windowReady', () => {
    taskbarWindow.webContents.send('displayInfo', {
      label: display.label,
      id: display.id,
      workArea: display.workArea
    })
  })
}

export let optionWindow: BrowserWindow
export function createOptionWindow() {
  // すでにウィンドウを開いているならそれをアクティブにする
  if (optionWindow && !optionWindow.isDestroyed()) {
    optionWindow.show()
    return
  }
  optionWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    optionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/option.html')
  } else {
    optionWindow.loadFile(join(__dirname, '../renderer/option.html'))
  }
  optionWindow.on('ready-to-show', () => {
    optionWindow.show()
  })
}

export function windowPosition(
  display: Electron.Display,
  type: LayoutType
): { width: number; height: number; x: number; y: number } {
  // なんかこの返り値だいぶ怪しそう

  return {
    // 右のときは 画面右端から - 210ピクセル
    x: type === 'right' ? display.workArea.x + display.workArea.width - 210 : display.workArea.x,
    y: type === 'bottom' ? display.workArea.height + display.workArea.y - 60 : display.workArea.y,
    width: type === 'bottom' ? display.workArea.width : 210,
    height: type !== 'bottom' ? display.workArea.height : 60
  }
}
