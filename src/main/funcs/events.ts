// レンダラープロセスからのメッセージを受信する
import { createOptionWindow, createWindow, taskbars, windowPosition } from './windows'
import { activateWindow, grantPermission, macWindowProcesses } from './helper'
import { app, ipcMain, screen } from 'electron'
import { Options, store } from './store'

export function setEventHandlers() {
  ipcMain.on('activeWindow', (_event, windowId) => {
    activateWindow(windowId)
  })
  ipcMain.on('openOption', () => {
    createOptionWindow()
  })
  // ウィンドウの準備ができたらプロセスリストを破棄
  // ホットリロードフロントのdataが破棄されても
  // nodeプロセスがそのままなので差分なしになるのを防ぐ
  ipcMain.on('windowReady', () => {
    macWindowProcesses.splice(0, macWindowProcesses.length)
  })

  ipcMain.on('setOptions', (_event, value: Options) => {
    const layout = store.get('options.layout')
    const displays = screen.getAllDisplays()

    store.set('options', value)
    for (const displayId in taskbars) {
      taskbars[displayId].webContents.send('updateOptions', value)

      // メインプロセスに作用するものを別途処理
      if (layout != value.layout) {
        const targetDisplay = displays.find((display) => display.id.toString() === displayId)
        if (targetDisplay)
          taskbars[displayId].setBounds(windowPosition(targetDisplay, value.layout))
      }
    }
  })

  ipcMain.on('grantPermission', () => {
    grantPermission()
    store.set('granted', true)
  })
  ipcMain.on('clearSetting', () => {
    store.clear()
    app.relaunch()
    app.quit()
  })
  screen.on('display-added', (_, newDisplay) => {
    createWindow(newDisplay)
  })
  // TODO 動作確認
  screen.on('display-removed', (_, oldDisplay) => {
    delete taskbars[oldDisplay.id]
  })
}
