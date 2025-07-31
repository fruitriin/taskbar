import { app } from 'electron'
import path from 'path'
const { spawn, exec } = require('child_process')
import { iconCache } from '@/funcs/icon-cache'

let cachedIcons: Record<string, string>
function loadIconCache(): Record<string, string> {
  if (!cachedIcons) {
    cachedIcons = iconCache.loadIcons()
  }
  return cachedIcons
}

let binaryPath
if (app.isPackaged) {
  // packaged (e.g., using electron-builder)
  binaryPath = path.join(process.resourcesPath, 'TaskbarHelper')
} else {
  // development
  binaryPath = path.join(__dirname, '../../resources', 'TaskbarHelper')
}

// taskbar-helperプロセスの管理用変数
let isHelperRunning = false
let helperRestartTimeout: NodeJS.Timeout | null = null

export const macWindowProcesses: MacWindow[] = []

export async function getAndSubmitProcesses(): Promise<void> {
  if (isHelperRunning) {
    console.log('TaskbarHelper is already running, skipping start')
    return
  }

  let rawData = ''
  try {
    isHelperRunning = true
    console.log('Starting TaskbarHelper process')

    const taskbarHelper = spawn(binaryPath, ['list'], {
      env: {
        ...process.env,
        ICON_CACHE_DIR: iconCache.getCacheDirForSwift()
      }
    })

    for await (const chunk of taskbarHelper.stdout) {
      rawData += chunk.toString()
      if (rawData.endsWith(']')) {
        try {
          const jsoned = JSON.parse(rawData)
          await applyProcessChange(jsoned)
          rawData = ''
        } catch (parseError) {
          console.error('Failed to parse JSON:', parseError)
          rawData = '' // Reset rawData to avoid accumulating invalid data
        }
      }
    }

    taskbarHelper.stderr.on('data', (data) => {
      console.error(`TaskbarHelper error: ${data.toString()}`)
    })

    await new Promise<void>((resolve) => {
      taskbarHelper.on('close', (code) => {
        console.log(`TaskbarHelper process exited with code ${code}`)
        isHelperRunning = false

        // プロセスが予期せず終了した場合は3秒後に再起動
        if (code !== 0) {
          console.log('TaskbarHelper crashed, scheduling restart in 3 seconds')
          scheduleHelperRestart()
        }

        resolve()
      })
    })
  } catch (error) {
    console.error('Error in getAndSubmitProcesses:', error)
    isHelperRunning = false

    // エラーが発生した場合も再起動をスケジュール
    console.log('TaskbarHelper error occurred, scheduling restart in 5 seconds')
    scheduleHelperRestart(5000)

    throw error // Re-throw the error for upper-level error handling
  }
}

// taskbar-helperの再起動をスケジュールする関数
function scheduleHelperRestart(delay: number = 3000): void {
  // 既存のタイムアウトがあればクリア
  if (helperRestartTimeout) {
    clearTimeout(helperRestartTimeout)
  }

  helperRestartTimeout = setTimeout(() => {
    console.log('Restarting TaskbarHelper...')
    getAndSubmitProcesses().catch((error) => {
      console.error('Failed to restart TaskbarHelper:', error)
      // 再起動に失敗した場合は10秒後に再試行
      scheduleHelperRestart(10000)
    })
  }, delay)
}

// スリープ復帰時にtaskbar-helperを再起動する関数
export function restartHelperAfterSleep(): void {
  console.log('System resumed from sleep, restarting TaskbarHelper')

  // 現在のプロセスを強制終了
  isHelperRunning = false

  // 既存のタイムアウトをクリア
  if (helperRestartTimeout) {
    clearTimeout(helperRestartTimeout)
    helperRestartTimeout = null
  }

  // 少し待ってから再起動
  scheduleHelperRestart(2000)
}

export function grantPermission(): void {
  spawn(binaryPath, ['grant'], {
    env: {
      ...process.env,
      ICON_CACHE_DIR: iconCache.getCacheDirForSwift()
    }
  })
}

import { diff } from 'just-diff'
import { diffApply } from 'just-diff-apply'

//  なんかごきげん斜め ウィンドウの増減で動かなくなる
export function applyProcessChange(newProcesses: typeof macWindowProcesses): void {
  const result = diff(macWindowProcesses, filterProcesses(newProcesses))

  if (result.length > 0) {
    diffApply(macWindowProcesses, result)

    // icon_cache/icons.jsonからbase64をセット
    // キャッシュをクリアして最新のアイコンを読み込み
    cachedIcons = {}
    const icons = loadIconCache()
    for (const proc of macWindowProcesses) {
      if (!proc.appIcon) {
        const owner = (proc.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')
        if (icons[owner]) {
          proc.appIcon = `data:image/png;base64,${icons[owner]}`
        }
      }
    }

    for (const taskbarKey in taskbars) {
      if (!taskbars[taskbarKey].isDestroyed()) {
        taskbars[taskbarKey].webContents.send('process', macWindowProcesses)
      }
    }
  }
}

import { escape } from 'html-escaper'
import { store } from './store'
import { taskbars } from './windows'

// ウィンドウをアクティブにする関数
export function activateWindow(window: MacWindow): void {
  const script = `tell application "System Events"
    set targetProcess to first application process whose unix id is ${window.kCGWindowOwnerPID}
    set targetAppWindows to windows of targetProcess
    set frontmost of targetProcess to true

    repeat with currentWindow in targetAppWindows
       if name of currentWindow contains "${escape(window.kCGWindowName)}" then
          perform action "AXRaise" of currentWindow
       end if

    end repeat
end tell
`
  exec(`osascript -e '${script}'`, (error, _stdout, _stderr) => {
    if (error) {
      console.error(`Error executing AppleScript: ${error}`)
      return
    }
    // console.log(_stderr);
    // console.log(_stdout);
  })
}

// ウィンドウを閉じるにする関数
export function closeWindow(window: MacWindow): void {
  let script = ''
  if (window.kCGWindowOwnerName !== 'Finder') {
    // 通常処理
    script = `tell application "System Events"
    set targetProcess to first application process whose unix id is ${window.kCGWindowOwnerPID}
    set targetAppWindows to windows of targetProcess

    repeat with currentWindow in targetAppWindows
      if name of currentWindow contains "${escape(window.kCGWindowName)}" then
        try
          perform action "AXPress" of (first button of currentWindow whose subrole is "AXCloseButton")
          exit repeat  -- ウィンドウを閉じたらリピートから抜ける
        on error
          display dialog "閉じるボタンが見つかりません。"
          exit repeat  -- エラーが発生した場合もリピートから抜ける
        end try
        end try
      end if
    end repeat
end tell`
  } else {
    activateWindow(window)
    // Finderを殺す処理
    script = `
tell application "Finder"
  if (count of Finder windows) > 0 then
    close front Finder window
  end if
end tell`
  }

  exec(`osascript -e '${script}'`, (error, _stdout, _stderr) => {
    if (error) {
      console.error(`Error executing AppleScript: ${error}`)
      return
    }
    // console.log(_stderr);
    // console.log(_stdout);
  })
}

/**
 * 高さ・幅が低すぎるものと、store.filters から条件に一致するものを除外する
 */
export function filterProcesses(windows: MacWindow[]): MacWindow[] {
  return windows.filter((win) => {
    if (win.kCGWindowBounds?.Height < 40) return false
    if (win.kCGWindowBounds?.Width < 40) return false

    for (const filter of store.store.filters) {
      const match: boolean[] = []
      for (const filterElement of filter) {
        if (win[filterElement.property] === undefined) return false
        if (win[filterElement.property] == filterElement.is) {
          match.push(true)
        } else {
          match.push(false)
        }
      }
      if (match.every((elem) => elem)) return false
    }

    return true
  })
}
