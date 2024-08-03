import { app } from 'electron'
import path from 'path'
const { spawn, exec } = require('child_process')
import { MacWindow } from '@/type'

let binaryPath
if (app.isPackaged) {
  // packaged (e.g., using electron-builder)
  binaryPath = path.join(process.resourcesPath, 'TaskbarHelper')
} else {
  // development
  binaryPath = path.join(__dirname, '../../resources', 'TaskbarHelper')
}

export const macWindowProcesses: MacWindow[] = []

export async function getAndSubmitProcesses(): Promise<void> {
  let rawData = ''
  try {
    const taskbarHelper = spawn(binaryPath, ['list'])

    for await (const chunk of taskbarHelper.stdout) {
      rawData += chunk.toString()
      if (rawData.endsWith(']')) {
        console.log('Received data:', rawData)
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
        resolve()
      })
    })
  } catch (error) {
    console.error('Error in getAndSubmitProcesses:', error);
    throw error // Re-throw the error for upper-level error handling
  }
}

export function grantPermission(): void {
  spawn(binaryPath, ['grant'])
}

import { diff } from 'just-diff'
import { diffApply } from 'just-diff-apply'

function applyProcessChange(newProcesses: typeof macWindowProcesses) {
  const result = diff(macWindowProcesses, filterProcesses(newProcesses))

  if (result.length > 0) {
    diffApply(macWindowProcesses, result)
    for (const taskbarKey in taskbars) {
      taskbars[taskbarKey].webContents.send('process', macWindowProcesses)
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
  const script = `tell application "System Events"
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

/**
 * 高さ・幅が低すぎるものと、store.filters から条件に一致するものを除外する
 */
function filterProcesses(windows: MacWindow[]) {
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
