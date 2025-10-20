import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BrowserWindow, ipcMain, screen as Screen, Display } from 'electron'
import { store } from '@/funcs/store'
// import console from 'riinlogger'
import { dumpTaskbarInfo } from '@/funcs/events'

type LayoutType = 'right' | 'left' | 'bottom'

type Taskbar = {
  browserWindowId: number
  displayId: number
  browserWindow: BrowserWindow
}
export let taskbars: Record<BrowserWindow['id'], Taskbar> = {}
export type Taskbars = typeof taskbars

// チェック項目
// 解像度を変えた
// モニターを増やした
// モニターを減らした
// Macがスリープした
// Macを長時間放置した = スタンバイ（なぜかモニターの電源が落ちると？変なモニターを識別する）
//
// Macの3種類のスリープモード
//  スリープ: hibernatemode=0,
//  セーフスリープ: hibernatemode=3
// ディープスリープ: hibernatemode=25

// 変更するには sudo pmset -a hibernatemode X
// 現在のモードの確認 sudo pmset -g
// スリープに入るには sudo  pmset sleepnow
//

/**
 * BrowserWindowで開いているものがあれば全部閉じて screenからBrowserWindowを作成し直す
 */
export function recreateAllWindows(ev: string): void {
  // Displayに対応したウィンドウを作る
  const newWindowIdPaiers: { browserId: number; displayId: number }[] = []
  const allDisplays = Screen.getAllDisplays()
  allDisplays.forEach((display) => {
    const newId = createWindow(display)
    newWindowIdPaiers.push({ browserId: newId, displayId: display.id })
  })

  const allBrowserWindows = BrowserWindow.getAllWindows()
  for (const browserWindow of allBrowserWindows) {
    // 作成したウィンドウが入った newWindowIds にないウィンドウが browserWindowにあればそれをすべて閉じる
    if (!newWindowIdPaiers.map((w) => w.browserId).includes(browserWindow.id)) {
      console.log('close window id:' + browserWindow.id)
      browserWindow.close()
      browserWindow.destroy()
      // taskbars変数も後始末する
      delete taskbars[browserWindow.id.toString()]
    }
  }

  // scheduleHelperRestart(100)
  dumpTaskbarInfo(ev)
}

export function createWindow(display: Display): number {
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

  taskbars[taskbarWindow.id] = {
    browserWindow: taskbarWindow,
    browserWindowId: taskbarWindow.id,
    displayId: display.id
  }

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

  return taskbarWindow.id
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
