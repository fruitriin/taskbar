import { app, BrowserWindow} from "electron";
import path from "path";
const { spawn, exec } = require('child_process');
import { Window } from "../../type";
import TaskbarHelper from '../../../resources/TaskbarHelper?asset'
import { execFile } from "child_process";



export function getAndSubmitProcesses(win: BrowserWindow){
  let rawData = ""
  try {
    const taskbarHelper = execFile( TaskbarHelper);

    taskbarHelper.stdout.on("data",  (raw) => {
      rawData += raw
    });
    taskbarHelper.stderr.on("data", (raw) => {
      console.error(raw)
    })
    taskbarHelper.on("close", async (code) => {
      await({result: (code === 0 ? "success" : "failed")})
      win.webContents.send('process', rawData)
      rawData = ""
    })
  }catch (e) {
    console.log(e)
  }


}

// ウィンドウをアクティブにする関数
export function activateWindow(window : Window) {
  const script = `tell application "System Events" to set frontmost of (first application process whose unix id is ${window.kCGWindowOwnerPID}) to true\n` +
    `tell application "System Events" to perform action "AXRaise" of window ${window.kCGWindowNumber} of (first application process whose unix id is ${window.kCGWindowOwnerPID})`;
  exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing AppleScript: ${error}`);
      return;
    }
    // console.log(stdout);
  });
}
