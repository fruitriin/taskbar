import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getExcludedProcesses } from '@/funcs/helper'

// オプション画面
export let optionWindow: BrowserWindow
export function createOptionWindow(): void {
  // すでにウィンドウを開いているならそれをアクティブにする
  if (optionWindow && !optionWindow.isDestroyed()) {
    optionWindow.show()
    return
  }
  optionWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    optionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/option.html')
  } else {
    optionWindow.loadFile(join(__dirname, '../renderer/option.html'))
  }
  optionWindow.on('ready-to-show', () => {
    optionWindow.show()
  })
}

// 全タスク確認ウィンドウ - フィルター作成用の補助画面
export let fullWindowListWindow: BrowserWindow
export async function createFullWindowListWindow(): Promise<void> {
  // すでにウィンドウを開いているならそれをアクティブにする
  if (fullWindowListWindow && !fullWindowListWindow.isDestroyed()) {
    fullWindowListWindow.show()
    return
  }
  fullWindowListWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Taskbar.fm - ウィンドウ一覧',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  fullWindowListWindow.webContents.send(
    'catchExcludeWindow',
    setTimeout(async () => {
      JSON.stringify(await getExcludedProcesses())
    }, 2000)
  )
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    fullWindowListWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/fullWindowList.html')
  } else {
    fullWindowListWindow.loadFile(join(__dirname, '../renderer/fullWindowList.html'))
  }
  fullWindowListWindow.on('ready-to-show', () => {
    fullWindowListWindow.show()
  })
}

// メニューウィンドウ
export let menuWindow: BrowserWindow
const MENU_WIDTH = 300
const MENU_HEIGHT = 260

// メニューウィンドウを初期化（アプリ起動時に一度だけ呼ばれる想定）
export function initMenuWindow(): void {
  if (menuWindow && !menuWindow.isDestroyed()) {
    return
  }

  menuWindow = new BrowserWindow({
    width: 0,
    height: 0,
    resizable: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    title: 'Taskbar.fm - メニュー',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    menuWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/menu.html')
  } else {
    menuWindow.loadFile(join(__dirname, '../renderer/menu.html'))
  }

  // フォーカスを失ったら非表示にする
  menuWindow.on('blur', () => {
    closeMenuWindow()
  })
}

// メニューウィンドウを非表示にする
export function closeMenuWindow(): void {
  if (menuWindow && !menuWindow.isDestroyed()) {
    menuWindow.setSize(0, 0)
    menuWindow.hide()
  }
}

// メニューウィンドウを表示（リサイズで表示）
export function createMenuWindow(
  taskbarBounds?: { x: number; y: number; width: number; height: number },
  layout?: 'bottom' | 'left' | 'right'
): void {
  // まだ初期化されていなければ初期化
  if (!menuWindow || menuWindow.isDestroyed()) {
    initMenuWindow()
  }

  let x = 0
  let y = 0

  if (taskbarBounds && layout) {
    // Taskbarの位置に応じてメニューを配置
    switch (layout) {
      case 'bottom':
        // メインメニューの左下とTaskbarの左上が接するように
        x = taskbarBounds.x
        y = taskbarBounds.y - MENU_HEIGHT
        break
      case 'left':
        // Taskbarの右上とメインメニューの左上が接するように
        x = taskbarBounds.x + taskbarBounds.width
        y = taskbarBounds.y
        break
      case 'right':
        // Taskbarの左上とメインメニューの右上が接するように
        x = taskbarBounds.x - MENU_WIDTH
        y = taskbarBounds.y
        break
    }
  } else {
    // フォールバック: カーソル位置に表示
    const { screen } = require('electron')
    const cursorPoint = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursorPoint)

    x = cursorPoint.x
    y = cursorPoint.y

    // 右端チェック
    if (x + MENU_WIDTH > display.bounds.x + display.bounds.width) {
      x = display.bounds.x + display.bounds.width - MENU_WIDTH
    }

    // 下端チェック
    if (y + MENU_HEIGHT > display.bounds.y + display.bounds.height) {
      y = display.bounds.y + display.bounds.height - MENU_HEIGHT
    }
  }

  // サイズと位置を設定してから表示
  menuWindow.setBounds({
    x,
    y,
    width: MENU_WIDTH,
    height: MENU_HEIGHT
  })
  menuWindow.show()
  menuWindow.focus()
}
