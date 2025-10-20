import { app as App, BrowserWindow, globalShortcut as GlobalShortcut } from 'electron'
import { electronApp as ElectronApp, optimizer as Optimizer, is } from '@electron-toolkit/utils'

import { recreateAllWindows } from '@/funcs/windows'
import { createFullWindowListWindow } from '@/funcs/optionWindows'
import { setEventHandlers } from '@/funcs/events'

import { getAndSubmitProcesses, cleanupHelperProcess } from '@/funcs/helper'

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
App.whenReady().then(() => {
  // Set app user model id for windows
  ElectronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  App.on('browser-window-created', (_, window) => {
    Optimizer.watchWindowShortcuts(window)
  })

  App.setAccessibilitySupportEnabled(true)

  // ディスプレイイベントの初期化
  recreateAllWindows('initial')

  App.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) recreateAllWindows('non-window')
  })

  // イベントハンドラーを設定する
  setEventHandlers()

  // 開発時のみウィンドウ一覧のキーボードショートカットを追加
  if (is.dev) {
    GlobalShortcut.register('CommandOrControl+Shift+W', () => {
      createFullWindowListWindow()
    })
  }
})

// プロセスを取得するプロセスを起動
getAndSubmitProcesses()
// アプリ終了前にクリーンアップを実行
App.on('before-quit', () => {
  console.log('App is about to quit, cleaning up...')
  cleanupHelperProcess()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
App.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    App.quit()
  }
})
