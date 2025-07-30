import { app, BrowserWindow, powerMonitor } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import { createAllWindows, initializeDisplayEvents } from '@/funcs/windows'
import { setEventHandlers } from '@/funcs/events'
import { getAndSubmitProcesses, restartHelperAfterSleep } from '@/funcs/helper'

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
})

// プロセスを取得するプロセスを起動
getAndSubmitProcesses()
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
