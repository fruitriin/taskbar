// レンダラープロセスからのメッセージを受信する
import { createOptionWindow, mainWindow, windowPosition } from './windows'
import { activateWindow, grantPermission } from './helper'
import { ipcMain, screen } from 'electron'
import { Options, store } from './store'

export function setEventHandlers() {
  ipcMain.on('activeWindow', (_event, windowId) => {
    activateWindow(windowId)
  })
  ipcMain.on('openOption', () => {
    createOptionWindow()
  })

  ipcMain.on('setOptions', (_event, value: Options) => {
    const layout = store.get('options.layout')
    store.set('options', value)
    mainWindow.webContents.send('updateOptions', value)

    // メインプロセスに作用するものを別途処理
    if (layout != value.layout) {
      const primaryDisplay = screen.getPrimaryDisplay()
      const position = windowPosition(primaryDisplay, value.layout)
      mainWindow.setBounds(position)
    }
  })

  ipcMain.on('grantPermission', () => {
    grantPermission()
    store.set('granted', true)
  })
  ipcMain.on('clearSetting', () => {
    store.clear()
  })
}
