import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BrowserWindow, screen } from 'electron'
import { getAndSubmitProcesses } from './helper'
import { store } from './store'

type LayoutType = 'right' | 'left' | 'bottom'

export let mainWindow: BrowserWindow
export function createWindow() {
  // Create the browser window.

  const primaryDisplay = screen.getPrimaryDisplay()

  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    // resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    ...windowPosition(primaryDisplay, store.get('layout') as LayoutType)
  })

  // 準備ができたら表示
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  // 閉じるボタンなどを消す
  mainWindow.setWindowButtonVisibility(false)

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 1秒ごとにプロセスのリストを取得
  setInterval(() => {
    getAndSubmitProcesses(mainWindow)
  }, 1000)
}

export let optionWindow: BrowserWindow
export function createOptionWindow() {
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
    optionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#option')
  } else {
    optionWindow.loadFile(join(__dirname, '../renderer/index.html#option'))
  }
  optionWindow.on('ready-to-show', () => {
    optionWindow.show()
  })
}

export function windowPosition(
  display: Electron.Display,
  type: LayoutType
): { width: number; height: number; x: number; y: number } {
  return {
    width: type === 'bottom' ? display.workArea.width : 210,
    height: type !== 'bottom' ? display.workArea.height : 60,
    x: type === 'right' ? display.workArea.width - 210 : 0,
    y: type === 'bottom' ? display.workArea.height - 30 : 0
  }
}
