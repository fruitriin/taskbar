import { app } from 'electron'
import path from 'path'
const { spawn, exec } = require('child_process')
import { iconCache } from '@/funcs/icon-cache'

// ここでいうキャッシュはswiftからみた場合なのでTypeScript的には頭の良い実装は特にないかも
function loadIconCache(): Record<string, string> {
  return iconCache.loadIcons()
}

let binaryPath = ''
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
let currentHelperProcess: any = null

export const macWindowProcesses: MacWindow[] = []

// アイコン更新通知を処理する関数
async function handleIconUpdate(iconUpdateData: {
  type: string
  icons: Record<string, string>
  timestamp: string
}): Promise<void> {
  console.log(`Received icon update: ${Object.keys(iconUpdateData.icons).length} icons`)

  // 既存のプロセスリストにアイコンを適用
  updateProcessIcons(iconUpdateData.icons)

  // レンダラープロセスに更新を通知
  for (const taskbarKey in taskbars) {
    if (!taskbars[taskbarKey].isDestroyed()) {
      taskbars[taskbarKey].webContents.send('iconUpdate', iconUpdateData.icons)
    }
  }

  // フルウィンドウリストにも通知
  if (fullWindowListWindow && !fullWindowListWindow.isDestroyed()) {
    fullWindowListWindow.webContents.send('iconUpdate', iconUpdateData.icons)
  }

  // アイコンキャッシュを更新
  iconCache.saveIcons(iconUpdateData.icons)
}

// 既存のプロセスリストにアイコンを適用する関数
function updateProcessIcons(icons: Record<string, string>): void {
  for (const proc of macWindowProcesses) {
    if (!proc.appIcon) {
      const owner = (proc.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')
      if (icons[owner]) {
        proc.appIcon = `data:image/png;base64,${icons[owner]}`
      }
    }
  }
}

// JSONラインを処理する関数
async function processJSONLine(line: string): Promise<void> {
  try {
    const jsoned = JSON.parse(line)

    // アイコン更新通知の処理
    if (jsoned.type === 'iconUpdate') {
      await handleIconUpdate(jsoned)
    } else {
      // 通常のウィンドウリスト処理
      await applyProcessChange(jsoned)
    }
  } catch (parseError) {
    console.error('Failed to parse JSON line:', parseError)
    console.log('Problematic line:', line)
    console.log('Line length:', line.length)
    console.log('First 100 chars:', line.substring(0, 100))
    console.log('Last 100 chars:', line.substring(Math.max(0, line.length - 100)))

    // JSONパースエラーが発生した場合、ヘルパーの再起動をスケジュール
    console.log('JSON parse error detected, scheduling helper restart in 3 seconds')
    scheduleHelperRestart(3000)
  }
}

// フィルター設定をSwiftに渡すためにJSONファイルに書き出す関数
function exportFiltersToSwift(): void {
  try {
    const labeledFilters = store.get('labeledFilters', []) as LabeledFilters[]
    const filtersJson = JSON.stringify(labeledFilters, null, 2)

    const filtersPath = path.join(iconCache.getCacheDirForSwift(), 'filters.json')
    require('fs').writeFileSync(filtersPath, filtersJson, 'utf8')

    console.log(`Exported ${labeledFilters.length} filter groups to ${filtersPath}`)
  } catch (error) {
    console.error('Failed to export filters to Swift:', error)
  }
}

export async function getAndSubmitProcesses(): Promise<void> {
  if (isHelperRunning) {
    console.log('TaskbarHelper is already running, skipping start')
    return
  }

  let rawData = ''
  try {
    isHelperRunning = true
    console.log('Starting TaskbarHelper process')

    // フィルター設定をエクスポート
    exportFiltersToSwift()

    const taskbarHelper = spawn(binaryPath, ['watch'], {
      env: {
        ...process.env,
        ICON_CACHE_DIR: iconCache.getCacheDirForSwift()
      }
    })

    // 現在のプロセスを保存
    currentHelperProcess = taskbarHelper

    for await (const chunk of taskbarHelper.stdout) {
      rawData += chunk.toString()

      // 完全なJSONライン（改行で終わる）のみを処理
      let newlineIndex = rawData.indexOf('\n')
      while (newlineIndex !== -1) {
        const line = rawData.substring(0, newlineIndex)
        rawData = rawData.substring(newlineIndex + 1)

        if (line.trim()) {
          await processJSONLine(line.trim())
        }

        newlineIndex = rawData.indexOf('\n')
      }
    }

    taskbarHelper.stderr.on('data', (data) => {
      console.error(`TaskbarHelper error: ${data.toString()}`)
    })

    await new Promise<void>((resolve) => {
      taskbarHelper.on('close', (code) => {
        console.log(`TaskbarHelper process exited with code ${code}`)
        isHelperRunning = false
        currentHelperProcess = null

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
export function scheduleHelperRestart(delay: number = 3000): void {
  // 既存のタイムアウトがあればクリア
  if (helperRestartTimeout) {
    clearTimeout(helperRestartTimeout)
  }

  helperRestartTimeout = setTimeout(() => {
    const date = new Date() // 現在時刻

    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', // 任意のタイムゾーン（例: 日本時間）
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })

    const parts = formatter.formatToParts(date)

    const formatMap = Object.fromEntries(parts.map((p) => [p.type, p.value]))

    const result = `${formatMap.year}/${formatMap.month}/${formatMap.day} ${formatMap.hour}:${formatMap.minute}:${formatMap.second}`

    console.log('Restarting TaskbarHelper... ', result)
    getAndSubmitProcesses().catch((error) => {
      console.error('Failed to restart TaskbarHelper:', error)
      // 再起動に失敗した場合は10秒後に再試行
      scheduleHelperRestart(10000)
    })
  }, delay)
}

// スリープ復帰時にtaskbar-helperを再起動する関数
export function restartHelperAfterSleep(): void {
  const date = new Date()
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', // 任意のタイムゾーン（例: 日本時間）
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const parts = formatter.formatToParts(date)

  const formatMap = Object.fromEntries(parts.map((p) => [p.type, p.value]))

  const result = `${formatMap.year}/${formatMap.month}/${formatMap.day} ${formatMap.hour}:${formatMap.minute}:${formatMap.second}`

  console.log('System resumed from sleep, restarting TaskbarHelper: detcted ', result)

  // 現在のプロセスを強制終了
  isHelperRunning = false

  // 既存のタイムアウトをクリア
  if (helperRestartTimeout) {
    clearTimeout(helperRestartTimeout)
    helperRestartTimeout = null
  }

  // 少し待ってから再起動
  scheduleHelperRestart(2000)
  scheduleHelperRestart(20000)
}

export function grantPermission(): void {
  spawn(binaryPath, ['grant'], {
    env: {
      ...process.env,
      ICON_CACHE_DIR: iconCache.getCacheDirForSwift()
    }
  })
}

export async function checkPermissions(): Promise<{
  accessibility: boolean
  screenRecording: boolean
} | null> {
  return new Promise((resolve) => {
    let rawData = ''

    const taskbarHelper = spawn(binaryPath, ['check-permissions'], {
      env: {
        ...process.env,
        ICON_CACHE_DIR: iconCache.getCacheDirForSwift()
      }
    })

    taskbarHelper.stdout.on('data', (chunk) => {
      rawData += chunk.toString()
    })

    taskbarHelper.stderr.on('data', (data) => {
      console.error(`Permission check error: ${data.toString()}`)
    })

    taskbarHelper.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(rawData)
          resolve({
            accessibility: result.accessibility,
            screenRecording: result.screenRecording
          })
        } catch (parseError) {
          console.error('Failed to parse permission status:', parseError)
          resolve(null)
        }
      } else {
        console.error(`Permission check process exited with code ${code}`)
        resolve(null)
      }
    })
  })
}

// アプリ終了時にTaskbarHelperプロセスをクリーンアップする関数
export function cleanupHelperProcess(): void {
  console.log('Cleaning up TaskbarHelper process...')

  // 再起動タイマーをクリア
  if (helperRestartTimeout) {
    clearTimeout(helperRestartTimeout)
    helperRestartTimeout = null
  }

  // 現在のプロセスを強制終了
  if (currentHelperProcess) {
    try {
      currentHelperProcess.kill('SIGTERM')
      console.log('TaskbarHelper process terminated')
    } catch (error) {
      console.error('Error terminating TaskbarHelper process:', error)
      // SIGTERMで終了できない場合はSIGKILLを試行
      try {
        currentHelperProcess.kill('SIGKILL')
        console.log('TaskbarHelper process killed')
      } catch (killError) {
        console.error('Error killing TaskbarHelper process:', killError)
      }
    }
    currentHelperProcess = null
  }

  isHelperRunning = false
}

import { diff } from 'just-diff'
import { diffApply } from 'just-diff-apply'

//  なんかごきげん斜め ウィンドウの増減で動かなくなる
export function applyProcessChange(newProcesses: typeof macWindowProcesses): void {
  // Swift側でフィルタリングが行われるため、TypeScript側のフィルタリングは無効化
  // const filteredProcesses = filterProcesses(newProcesses)
  const filteredProcesses = newProcesses

  // Swift側でフィルタリング済みのため、除外されたウィンドウは存在しない
  const excludedProcesses: typeof macWindowProcesses = []

  const result = diff(macWindowProcesses, filteredProcesses)

  // アイコンの設定は常に実行
  const icons = loadIconCache()

  if (result.length > 0) {
    diffApply(macWindowProcesses, result)
  }

  // アイコンを設定（フィルター済みプロセス）
  for (const proc of macWindowProcesses) {
    if (!proc.appIcon) {
      const owner = (proc.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')
      if (icons[owner]) {
        proc.appIcon = `data:image/png;base64,${icons[owner]}`
      }
    }
  }

  // 全プロセス（オリジナル）にもアイコンをセット
  const allProcessesWithIcons = newProcesses.map((proc) => {
    if (!proc.appIcon) {
      const owner = (proc.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')
      if (icons[owner]) {
        return { ...proc, appIcon: `data:image/png;base64,${icons[owner]}` }
      }
    }
    return proc
  })

  // 変更があった場合のみタスクバーに送信
  if (result.length > 0) {
    for (const taskbarKey in taskbars) {
      if (!taskbars[taskbarKey].isDestroyed()) {
        taskbars[taskbarKey].webContents.send('process', macWindowProcesses)
      }
    }
  }

  // FullWindowListウィンドウには全プロセス情報のみ送信
  if (fullWindowListWindow && !fullWindowListWindow.isDestroyed()) {
    fullWindowListWindow.webContents.send('allProcesses', {
      all: allProcessesWithIcons,
      filtered: macWindowProcesses,
      excluded: excludedProcesses.map((proc) => {
        const owner = (proc.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')
        return icons[owner] ? { ...proc, appIcon: `data:image/png;base64,${icons[owner]}` } : proc
      })
    })
  }
}

import { escape } from 'html-escaper'
import { store } from './store'
import type { LabeledFilters } from './store'
import { taskbars, fullWindowListWindow } from './windows'

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
 * 高さ・幅が低すぎるものと、labeledFilters から条件に一致するものを除外する
 */
export function filterProcesses(windows: MacWindow[]): MacWindow[] {
  const wins = windows.filter((win) => {
    // サイズフィルター（従来通り）
    if (win.kCGWindowBounds?.Height < 40) return false
    if (win.kCGWindowBounds?.Width < 40) return false

    try {
      // 新しいlabeledFilters形式での処理

      const labeledFilters = store.get('labeledFilters', []) as LabeledFilters[]

      if (Array.isArray(labeledFilters)) {
        for (const labeledFilter of labeledFilters) {
          const match: boolean[] = []

          for (const filterElement of labeledFilter.filters) {
            // ウィンドウのプロパティが存在しない場合はスキップ
            if (win[filterElement.property] === undefined) {
              match.push(false)
              continue
            }
            if (filterElement.property === 'kCGWindowName' && win[filterElement.property] == '') {
              console.log(win['kCGWindowOwnerName'], '-', win['kCGWindowName'])
              match.push(true)
            }

            // 値が一致するかチェック
            if (win[filterElement.property] == filterElement.is) {
              match.push(true)
            } else {
              match.push(false)
            }
          }

          // すべての条件が一致した場合はフィルタリング対象（除外）
          if (match.length > 0 && match.every((elem) => elem)) {
            return false
          }
        }
      }

      return true
    } catch (error) {
      // ストアアクセスエラーが発生した場合はフィルタリングせずに通す
      console.error('Filter processing error:', error)

      return true
    }
  })
  // console.log(windows)
  return wins
}
