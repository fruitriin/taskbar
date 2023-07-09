import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { activateWindow, getAndSubmitProcesses } from '@/funcs/helper'

import Store from 'electron-store'
import { grantPermission } from './funcs/helper'

const store = new Store({
  defaults: {
    layout: 'bottom',
    filters: [
      [{ property: 'kCGWindowIsOnscreen', is: false }],
      [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
      [{ property: 'kCGWindowOwnerName', is: 'DockHelper' }],
      [{ property: 'kCGWindowOwnerName', is: 'screencapture' }],
      [{ property: 'kCGWindowOwnerName', is: 'スクリーンショット' }],
      [{ property: 'kCGWindowName', is: 'Notification Center' }],
      [{ property: 'kCGWindowName', is: 'Item-0' }],
      [{ property: 'kCGWindowOwnerName', is: 'Window Server' }],
      [{ property: 'kCGWindowOwnerName', is: 'コントロールセンター' }],
      [
        { property: 'kCGWindowOwnerName', is: 'Finder' },
        { property: 'kCGWindowName', is: '' }
      ],
      [{ property: 'kCGWindowName', is: 'Spotlight' }],
      [{ property: 'kCGWindowOwnerName', is: 'GoogleJapaneseInputRenderer' }],
      [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }],
      [{ property: 'kCGWindowName', is: 'taskbar.fm' }]
    ]
  }
})

type LayoutType = 'right' | 'left' | 'bottom'

let mainWindow: BrowserWindow

function windowPosition(
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

let optionWindow: BrowserWindow
function createOptionWindow() {
  // すでにウィンドウを開いているならそれをアクティブにする
  if (optionWindow) {
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

function createWindow() {
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  mainWindow.setWindowButtonVisibility(false)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  setInterval(() => {
    getAndSubmitProcesses(mainWindow)
  }, 1000)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.setAccessibilitySupportEnabled(true)
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // レンダラープロセスからのメッセージを受信する
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
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
