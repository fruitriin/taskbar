// レンダラープロセスからのメッセージを受信する
import { createOptionWindow, createWindow, taskbars, windowPosition } from './windows'
import { activateWindow, closeWindow, grantPermission, macWindowProcesses } from './helper'
import { app, ipcMain, screen } from 'electron'
import { Options, store } from './store'
import { Menu, MenuItem } from 'electron'
import { MacWindow } from '../type'

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
  ipcMain.on('restart', () => {
    app.relaunch()
    app.quit()
  }),
    ipcMain.on('exit', () => {
      app.quit()
    })
  // タスクを右クリックしたときのコンテキストメニュー
  ipcMain.on('contextTask', (_event, value: MacWindow) => {
    const menu = new Menu()
    menu.append(moveAreaMenu(value.kCGWindowOwnerName, 'headers'))
    menu.append(moveAreaMenu(value.kCGWindowOwnerName, 'footers'))
    menu.append(
      new MenuItem({
        label: '閉じる',
        click() {
          activateWindow(value)
          closeWindow(value)
        }
      })
    )
    menu.append(
      new MenuItem({
        label: '強制終了',
        click() {
          process.kill(value.kCGWindowOwnerPID)
        }
      })
    )
    menu.popup({})
  })
  screen.on('display-added', (_, newDisplay) => {
    createWindow(newDisplay)
  })
  screen.on('display-removed', (_, oldDisplay) => {
    delete taskbars[oldDisplay.id]
  })
}

function moveAreaMenu(kCGWindowOwnerName: string, area: 'headers' | 'footers') {
  const position = store.store.options[area].indexOf(kCGWindowOwnerName)
  const oppositeArea = area === 'headers' ? 'footers' : 'headers';
  const labelName = {
    headers: '先頭',
    footers: '末尾'
  } as const

  return new MenuItem({
    click(_menuItem, _browserWindow) {
      if (position < 0) {
        store.set('options.' + area, [...store.store.options[area], kCGWindowOwnerName])

        // 先頭に追加している状態で末尾に追加する場合は先頭から削除 (逆も同様)
        const oppositePosition = store.store.options[oppositeArea].indexOf(kCGWindowOwnerName)
        if (oppositePosition >= 0) {
          const tmp = store.store.options[oppositeArea]
          tmp.splice(oppositePosition, 1)
          store.set('options.' + oppositeArea, tmp)
        }

      } else {
        const tmp = store.store.options[area]
        tmp.splice(position, 1)
        store.set('options.' + area, tmp)
      }
      updateOptions()
    },
    label: position < 0 ? `${labelName[area]}へ追加` : `${labelName[area]}から削除`
  })
}
function updateOptions() {
  for (const taskbarsKey in taskbars) {
    taskbars[taskbarsKey].webContents.send('updateOptions', store.store.options)
  }
}
