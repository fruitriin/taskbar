// レンダラープロセスからのメッセージを受信する
import { createOptionWindow, mainWindow, windowPosition } from './windows'
import { activateWindow, grantPermission } from './helper'
import { ipcMain, screen } from 'electron'
import { store } from './store'

type LayoutType = 'right' | 'left' | 'bottom'

export function setEventHandlers() {
  ipcMain.on('activeWindow', (_event, windowId) => {
    activateWindow(windowId)
  })
  ipcMain.on('openOption', () => {
    createOptionWindow()
  })

  ipcMain.on('setLayout', (_event, layout: LayoutType) => {
    store.set('layout', layout)
    const primaryDisplay = screen.getPrimaryDisplay()
    const position = windowPosition(primaryDisplay, layout)
    mainWindow.setBounds(position)
    mainWindow.webContents.send('setLayout', layout)
  })

  ipcMain.on('grantPermission', () => {
    grantPermission()
    store.set('granted', true)
  })
  ipcMain.on('clearSetting', () => {
    store.clear()
  })
}
