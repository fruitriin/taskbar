import { app, BrowserWindow } from 'electron'
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

export function getAndSubmitProcesses(win: BrowserWindow): void {
  let rawData = ''
  try {
    const taskbarHelper = spawn(binaryPath, ["list"])
    // console.log("tick")
    taskbarHelper.stdout.on('data', (raw) => {
      rawData += raw
      // console.log(raw)
    })
    // taskbarHelper.on("data", console.info)
    taskbarHelper.stderr.on('data', (raw) => {
      console.error(raw)
    })
    taskbarHelper.on('close', async (code) => {
      await { result: code === 0 ? 'success' : 'failed' }
      win.webContents.send('process', new Buffer(rawData).toString('utf-8'))
      rawData = ''
    })
  } catch (e) {
    console.log(e)
  }
}

export function grantPermission(): void{
  spawn(binaryPath, ["grant"])
}

// ウィンドウをアクティブにする関数
export function activateWindow(window: MacWindow): void {
  const script = "" +
`tell application "System Events"
    set targetProcess to first application process whose unix id is ${window.kCGWindowOwnerPID}
    set targetAppWindows to windows of targetProcess
    set frontmost of targetProcess to true
    repeat with currentWindow in targetAppWindows
       if name of currentWindow contains "${window.kCGWindowName}" then
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
