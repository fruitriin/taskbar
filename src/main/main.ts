import { app, BrowserWindow, powerMonitor, globalShortcut } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import {
  createAllWindows,
  initializeDisplayEvents,
  createFullWindowListWindow
} from '@/funcs/windows'
import { setEventHandlers } from '@/funcs/events'
import {
  getAndSubmitProcesses,
  restartHelperAfterSleep,
  cleanupHelperProcess
} from '@/funcs/helper'

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.setAccessibilitySupportEnabled(true)

  // ディスプレイイベントの初期化
  initializeDisplayEvents()
  // ウィンドウの作成
  createAllWindows()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createAllWindows()
  })

  powerMonitor.on('resume', () => {
    setTimeout(() => {
      initializeDisplayEvents()
      restartHelperAfterSleep()
    }, 5000)
  })

  // イベントハンドラーを設定する
  setEventHandlers()

  // 開発時のみウィンドウ一覧のキーボードショートカットを追加
  if (is.dev) {
    globalShortcut.register('CommandOrControl+Shift+W', () => {
      createFullWindowListWindow()
    })
  }
})

// プロセスを取得するプロセスを起動
getAndSubmitProcesses()
// アプリ終了前にクリーンアップを実行
app.on('before-quit', () => {
  console.log('App is about to quit, cleaning up...')
  cleanupHelperProcess()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
