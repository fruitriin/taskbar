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
