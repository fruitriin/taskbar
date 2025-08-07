// レンダラープロセスからのメッセージを受信する
import { createOptionWindow, createWindow, taskbars, windowPosition } from '@/funcs/windows'
import { activateWindow, closeWindow, grantPermission, macWindowProcesses, checkPermissions } from '@/funcs/helper'
import { app, ipcMain, screen, BrowserWindow } from 'electron'
import { Options, store } from '@/funcs/store'
import { Menu, MenuItem } from 'electron'
import { applyProcessChange } from '@/funcs/helper'
import { iconCache } from '@/funcs/icon-cache'

export function setEventHandlers(): void {
  ipcMain.on('activeWindow', (_event, windowId) => {
    activateWindow(windowId)
  })
  ipcMain.on('openOption', () => {
    createOptionWindow()
  })

  ipcMain.on('windowReady', () => {
    // ウィンドウの準備ができたらプロセスリストを破棄
    // ホットリロードフロントのdataが破棄されても
    // nodeプロセスがそのままなので差分なしになるのを防ぐ
    macWindowProcesses.splice(0, macWindowProcesses.length)

    // iconの変化に追従
    watchIconsJson()
  })

  ipcMain.on('setOptions', (_event, value: Options) => {
    const layout = store.get('options.layout')
    const displays = screen.getAllDisplays()

    store.set('options', value)
    for (const displayId in taskbars) {
      if (!taskbars[displayId].isDestroyed()) {
        taskbars[displayId].webContents.send('updateOptions', value)

        // メインプロセスに作用するものを別途処理
        if (layout != value.layout) {
          const targetDisplay = displays.find((display) => display.id.toString() === displayId)
          if (targetDisplay)
            taskbars[displayId].setBounds(windowPosition(targetDisplay, value.layout))
        }
      }
    }
  })

  ipcMain.on('grantPermission', () => {
    grantPermission()
    store.set('granted', true)
  })

  ipcMain.handle('checkPermissions', async () => {
    return await checkPermissions()
  })

  ipcMain.on('openSystemPreferences', () => {
    const { shell } = require('electron')
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
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
  // index.vueの@click.right.preventでイベントが発火
  // しかしクリック位置の情報が送られていないため、画面上部に表示される
  // 修正するにはイベント発火時にマウス位置(event.x, event.y)をcontextTaskイベントに渡す必要がある
  ipcMain.on('contextTask', (_event, value: MacWindow) => {
    const menu = new Menu()
    menu.append(moveAreaMenu(value.kCGWindowOwnerName, 'headers'))
    menu.append(moveAreaMenu(value.kCGWindowOwnerName, 'footers'))
    menu.append(
      new MenuItem({
        label: '閉じる',
        click(): void {
          activateWindow(value)
          closeWindow(value)
        }
      })
    )
    menu.append(
      new MenuItem({
        label: '強制終了',
        click(): void {
          process.kill(value.kCGWindowOwnerPID)
        }
      })
    )
    // マウスの位置付近にメニューを表示するため、マウスの座標を取得
    // マルチディスプレイ環境でも正しい位置に表示されるよう、screen.getCursorScreenPointを使用
    // screen.getCursorScreenPointはプライマリディスプレイの左上を基準とした絶対座標を返す
    // メニューを表示するウィンドウと同じディスプレイ上に表示されるようにする
    // クリックされたタスクバーを特定
    let clickedTaskbar: BrowserWindow | undefined
    for (const taskbarId in taskbars) {
      const taskbar = taskbars[taskbarId]
      const bounds = taskbar.getBounds()
      const cursorPos = screen.getCursorScreenPoint()

      // タスクバーの範囲内にマウスカーソルがあるか確認
      if (
        cursorPos.x >= bounds.x &&
        cursorPos.x <= bounds.x + bounds.width &&
        cursorPos.y >= bounds.y &&
        cursorPos.y <= bounds.y + bounds.height
      ) {
        clickedTaskbar = taskbar
        break
      }
    }

    const cursorPoint = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursorPoint)
    const mousePosition = {
      x: cursorPoint.x + display.bounds.x,
      y: cursorPoint.y - display.bounds.y
    }
    console.log(display.bounds, cursorPoint, clickedTaskbar)
    menu.popup({
      window: clickedTaskbar,
      ...mousePosition
    })
  })
  screen.on('display-added', (_, newDisplay) => {
    createWindow(newDisplay)
  })
  screen.on('display-removed', (_, oldDisplay) => {
    if (taskbars[oldDisplay.id]) {
      taskbars[oldDisplay.id].close()
    }
  })
}

function moveAreaMenu(kCGWindowOwnerName: string, area: 'headers' | 'footers'): MenuItem {
  const position = store.store.options[area].indexOf(kCGWindowOwnerName)
  const oppositeArea = area === 'headers' ? 'footers' : 'headers'
  const oppositePosition = store.store.options[oppositeArea].indexOf(kCGWindowOwnerName)
  const labelName = {
    headers: '先頭',
    footers: '末尾'
  } as const

  return new MenuItem({
    click(_menuItem, _browserWindow): void {
      if (position < 0) {
        store.set('options.' + area, [...store.store.options[area], kCGWindowOwnerName])
        // 先頭に追加している状態で末尾に追加する場合は先頭から削除 (逆も同様)
        deleteFromAreaMenu(oppositeArea, oppositePosition)
      } else {
        deleteFromAreaMenu(area, position)
      }
      updateOptions()
    },
    label: position < 0 ? `${labelName[area]}へ追加` : `${labelName[area]}から削除`
  })
}
function updateOptions(): void {
  for (const taskbarsKey in taskbars) {
    if (!taskbars[taskbarsKey].isDestroyed()) {
      taskbars[taskbarsKey].webContents.send('updateOptions', store.store.options)
    }
  }
}

// 先頭または末尾から削除
function deleteFromAreaMenu(area: 'headers' | 'footers', position: number): void {
  if (position < 0) return
  const tmp = store.store.options[area]
  tmp.splice(position, 1)
  store.set('options.' + area, tmp)
}

// icons.json監視用関数
export function watchIconsJson(): void {
  iconCache.watchIcons((eventType) => {
    if (eventType === 'change') {
      // icons.jsonを再読込
      const icons = iconCache.loadIcons()
      // appIconが未設定またはicons.jsonの値と異なるウィンドウを抜き出す
      const needsUpdate = macWindowProcesses.filter((proc) => {
        const owner = (proc.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')
        const winName = (proc.kCGWindowName || 'unknown').replace(/\//g, '_').replace(/ /g, '')
        const key = `${owner}_${winName}`
        const iconBase64 = icons[key] ? `data:image/png;base64,${icons[key]}` : undefined
        return proc.appIcon !== iconBase64
      })
      if (needsUpdate.length > 0) {
        applyProcessChange(needsUpdate)
      }
    }
  })
}
