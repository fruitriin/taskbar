// レンダラープロセスからのメッセージを受信する
import { createOptionWindow, taskbars, windowPosition } from './windows'
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
  })
}
