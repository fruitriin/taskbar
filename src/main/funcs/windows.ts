import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BrowserWindow, ipcMain, screen, Display } from 'electron'
import { store } from '@/funcs/store'
import console from 'riinlogger'

type LayoutType = 'right' | 'left' | 'bottom'

type Taskbar = BrowserWindow
type displayId = Display['id']
export const taskbars: Record<displayId, Taskbar> = {}
export type Taskbars = typeof taskbars

export function initializeDisplayEvents(): void {
  // ディスプレイ構成が変わったら全部作り直し
  const recreateAllWindows = (): void => {
    // 既存のウィンドウを全て閉じる
    for (const key in taskbars) {
      // think: このコード追加すれば解決するだろうか？
      // taskbars[key].close()
      taskbars[key].destroy()
      delete taskbars[key]
    }
    const allBrowserWindow = BrowserWindow.getAllWindows()
    allBrowserWindow.forEach((window) => {
      window.close()
    })
    // 新しくウィンドウを作り直す
    createAllWindows()
  }

  // 各種ディスプレイイベントで全ウィンドウを作り直し
  screen.on('display-removed', recreateAllWindows)
  screen.on('display-added', recreateAllWindows)
  screen.on('display-metrics-changed', recreateAllWindows)
}

export function createAllWindows(): void {
  const allDisplays = screen.getAllDisplays()
  allDisplays.forEach((display) => {
    createWindow(display)
  })
  console.log('[NEW]', {
    displays: allDisplays.map((d) => {
      return { id: d.id, label: d.label }
    }),
    taskbars: taskbars
  })
}

export function createWindow(display: Display): void {
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
    ...windowPosition(display, store.store.options.layout as LayoutType)
  })

  // ウィンドウを閉じるときのイベントを設定
  taskbarWindow.on('close', () => {
    taskbarWindow.destroy()
    // ウィンドウが閉じられたらtaskbarsから削除
    delete taskbars[display.id]
  })

  // ウィンドウを閉じるサンプル
  // taskbarWindow.close() // 通常の閉じる処理
  // taskbarWindow.destroy() // 強制的に閉じる

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

  // windowReadyイベントのリスナーを設定
  const windowReadyListener = (): void => {
    if (!taskbarWindow.isDestroyed()) {
      taskbarWindow.webContents.send('displayInfo', {
        label: display.label,
        id: display.id,
        workArea: display.workArea
      })
    }
  }
  ipcMain.on('windowReady', windowReadyListener)

  // ウィンドウが閉じられたときにイベントリスナーを削除
  taskbarWindow.on('closed', (): void => {
    ipcMain.removeListener('windowReady', windowReadyListener)
  })
}

export function windowPosition(
  display: Electron.Display,
  type: LayoutType
): { width: number; height: number; x: number; y: number } {
  return {
    // 右のときは 画面右端から - 210ピクセル
    x: type === 'right' ? display.workArea.x + display.workArea.width - 210 : display.workArea.x,
    y: type === 'bottom' ? display.workArea.height + display.workArea.y - 60 : display.workArea.y,
    width: type === 'bottom' ? display.workArea.width : 210,
    height: type !== 'bottom' ? display.workArea.height : 60
  }
}
