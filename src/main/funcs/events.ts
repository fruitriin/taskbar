// レンダラープロセスからのメッセージを受信する
import { taskbars, windowPosition, recreateAllWindows } from '@/funcs/windows'
import {
  createOptionWindow,
  createFullWindowListWindow,
  createMenuWindow,
  closeMenuWindow,
  fullWindowListWindow
} from '@/funcs/optionWindows'
import {
  activateWindow,
  closeWindow,
  grantPermission,
  macWindowProcesses,
  checkPermissions,
  scheduleHelperRestart,
  getExcludedProcesses,
  excludedProcesses
} from '@/funcs/helper'
import { app as App, ipcMain, screen as Screen, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { Options, store } from '@/funcs/store'
import { Menu, MenuItem } from 'electron'
import { applyProcessChange } from '@/funcs/helper'
import { iconCache } from '@/funcs/icon-cache'
// import console from 'riinlogger'

export function dumpTaskbarInfo(caller: string): void {
  if (!is.dev) return
  try {
    console.log({
      caller,
      taskbars: taskbars,
      browserWindows: BrowserWindow.getAllWindows().map((b) => {
        return {
          browserId: b.id
        }
      }),
      allScreens: Screen.getAllDisplays().map((d) => {
        return { id: d.id, label: d.label }
      })
    })
  } catch (e) {
    console.error(e)
  }
}

export function setEventHandlers(): void {
  // 各種ディスプレイイベントで全ウィンドウを作り直し
  Screen.on('display-removed', () => recreateAllWindows('display-removed'))
  Screen.on('display-added', () => recreateAllWindows('display-added'))
  Screen.on('display-metrics-changed', () => recreateAllWindows('display-metrics-changed'))

  ipcMain.on('activeWindow', (_event, windowId) => {
    activateWindow(windowId)
  })
  ipcMain.on('openOption', () => {
    createOptionWindow()
  })
  ipcMain.on('openFullWindowList', () => {
    createFullWindowListWindow()
  })

  ipcMain.on('dumpTaskbarInfo', () => {
    dumpTaskbarInfo('ui event')
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
    const displays = Screen.getAllDisplays()

    store.set('options', value)
    for (const browserId in taskbars) {
      if (!taskbars[browserId].browserWindow.isDestroyed()) {
        taskbars[browserId].browserWindow.webContents.send('updateOptions', value)

        // メインプロセスに作用するものを別途処理
        if (layout != value.layout) {
          const targetDisplay = displays.find(
            (display) => display.id === taskbars[browserId].displayId
          )
          if (targetDisplay)
            taskbars[browserId].browserWindow.setBounds(windowPosition(targetDisplay, value.layout))
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
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  })
  ipcMain.on('clearSetting', () => {
    store.clear()
    App.relaunch()
    App.quit()
  })
  ipcMain.on('restart', () => {
    App.relaunch()
    App.quit()
  }),
    ipcMain.on('exit', () => {
      App.quit()
    })

  ipcMain.on('restartHelper', (_event, delay?: number) => {
    recreateAllWindows('restartHelper')
    scheduleHelperRestart(delay)
  })

  // フィルター設定の保存
  ipcMain.on('setLabeledFilters', (_event, value) => {
    store.set('labeledFilters', value)
  })

  // フィルター設定の取得
  ipcMain.handle('getLabeledFilters', () => {
    return store.get('labeledFilters', [])
  })

  // 新しいフィルターグループを追加
  ipcMain.on('addFilter', (_event, data: { filter: any; label: string }) => {
    const currentFilters = store.get('labeledFilters', [])
    currentFilters.push({
      label: data.label,
      filters: [data.filter]
    })
    store.set('labeledFilters', currentFilters)

    // 全てのオプションウィンドウに更新を通知
    const optionWindows = BrowserWindow.getAllWindows().filter((win) => win.getTitle() === 'taskbar.fm')
    optionWindows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('labeledFiltersUpdated', currentFilters)
      }
    })
  })

  // 除外プロセスの取得
  ipcMain.on('getExcludeWindows', async () => {
    await getExcludedProcesses()

    // 除外プロセスが取得されたらFullWindowListに送信
    if (fullWindowListWindow && !fullWindowListWindow.isDestroyed()) {
      // アイコンキャッシュを取得
      const icons = iconCache.loadIcons()

      // 除外プロセスにアイコンを設定
      const excludedProcessesWithIcons = excludedProcesses.map((proc: any) => {
        if (!proc.appIcon) {
          const owner = (proc.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')
          if (icons[owner]) {
            return { ...proc, appIcon: `data:image/png;base64,${icons[owner]}` }
          }
        }
        return proc
      })

      fullWindowListWindow.webContents.send('catchExcludeWindow', excludedProcessesWithIcons)
    }
  })

  // ロゴをクリックしたときのメニューウィンドウを表示
  ipcMain.on('contextLogo', (event) => {
    // イベント送信元のタスクバーを特定
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    if (!senderWindow) {
      createMenuWindow()
      return
    }

    // タスクバーの位置とサイズを取得
    const taskbarBounds = senderWindow.getBounds()
    const layout = store.get('options.layout')

    createMenuWindow(taskbarBounds, layout)
  })

  // メニューウィンドウを閉じる
  ipcMain.on('closeMenu', () => {
    closeMenuWindow()
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
      const bounds = taskbar.browserWindow.getBounds()
      const cursorPos = Screen.getCursorScreenPoint()

      // タスクバーの範囲内にマウスカーソルがあるか確認
      if (
        cursorPos.x >= bounds.x &&
        cursorPos.x <= bounds.x + bounds.width &&
        cursorPos.y >= bounds.y &&
        cursorPos.y <= bounds.y + bounds.height
      ) {
        clickedTaskbar = taskbar.browserWindow
        break
      }
    }

    const cursorPoint = Screen.getCursorScreenPoint()
    const display = Screen.getDisplayNearestPoint(cursorPoint)
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
    if (!taskbars[taskbarsKey].browserWindow.isDestroyed()) {
      taskbars[taskbarsKey].browserWindow.webContents.send('updateOptions', store.store.options)
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
