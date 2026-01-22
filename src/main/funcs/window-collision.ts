import { exec } from 'child_process'
import { Display } from 'electron'
import { store } from './store'

type LayoutType = 'right' | 'left' | 'bottom'

type Rectangle = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * タスクバーの矩形領域を取得
 */
export function getTaskbarBounds(display: Display, layout: LayoutType): Rectangle {
  const { workArea } = display

  switch (layout) {
    case 'right':
      return {
        x: workArea.x + workArea.width - 210,
        y: workArea.y,
        width: 210,
        height: workArea.height
      }
    case 'left':
      return {
        x: workArea.x,
        y: workArea.y,
        width: 210,
        height: workArea.height
      }
    case 'bottom':
      return {
        x: workArea.x,
        y: workArea.height + workArea.y - 60,
        width: workArea.width,
        height: 60
      }
  }
}

/**
 * 2つの矩形が重なっているかチェック
 */
export function isOverlapping(rect1: Rectangle, rect2: Rectangle): boolean {
  return !(
    rect1.x + rect1.width <= rect2.x ||
    rect2.x + rect2.width <= rect1.x ||
    rect1.y + rect1.height <= rect2.y ||
    rect2.y + rect2.height <= rect1.y
  )
}

/**
 * ウィンドウの矩形領域を取得
 */
export function getWindowBounds(window: MacWindow): Rectangle {
  return {
    x: window.kCGWindowBounds.X,
    y: window.kCGWindowBounds.Y,
    width: window.kCGWindowBounds.Width,
    height: window.kCGWindowBounds.Height
  }
}

/**
 * タスクバーと重ならないようにウィンドウを調整
 */
export function adjustWindowToAvoidTaskbar(
  window: MacWindow,
  taskbarBounds: Rectangle,
  layout: LayoutType
): { newX: number; newY: number; newWidth: number; newHeight: number } | null {
  const windowBounds = getWindowBounds(window)

  if (!isOverlapping(windowBounds, taskbarBounds)) {
    return null // 重なっていない場合は調整不要
  }

  let newX = windowBounds.x
  let newY = windowBounds.y
  let newWidth = windowBounds.width
  let newHeight = windowBounds.height

  switch (layout) {
    case 'right':
      // タスクバーが右側にある場合、ウィンドウの幅を調整
      if (windowBounds.x + windowBounds.width > taskbarBounds.x) {
        newWidth = taskbarBounds.x - windowBounds.x
      }
      break

    case 'left':
      // タスクバーが左側にある場合、ウィンドウを右に移動
      if (windowBounds.x < taskbarBounds.x + taskbarBounds.width) {
        const shift = taskbarBounds.x + taskbarBounds.width - windowBounds.x
        newX = windowBounds.x + shift
        newWidth = Math.max(windowBounds.width - shift, 100) // 最小幅を100に設定
      }
      break

    case 'bottom':
      // タスクバーが下側にある場合、ウィンドウの高さを調整
      if (windowBounds.y + windowBounds.height > taskbarBounds.y) {
        newHeight = taskbarBounds.y - windowBounds.y
      }
      break
  }

  // サイズや位置が変わらない場合は調整不要
  if (
    newX === windowBounds.x &&
    newY === windowBounds.y &&
    newWidth === windowBounds.width &&
    newHeight === windowBounds.height
  ) {
    return null
  }

  return { newX, newY, newWidth, newHeight }
}

/**
 * AppleScriptでウィンドウの位置とサイズを変更
 */
export function resizeAndMoveWindow(
  window: MacWindow,
  newX: number,
  newY: number,
  newWidth: number,
  newHeight: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = `tell application "System Events"
    set targetProcess to first application process whose unix id is ${window.kCGWindowOwnerPID}
    set targetAppWindows to windows of targetProcess
    set frontmost of targetProcess to false

    repeat with currentWindow in targetAppWindows
      if name of currentWindow contains "${window.kCGWindowName || ''}" then
        try
          set position of currentWindow to {${Math.round(newX)}, ${Math.round(newY)}}
          set size of currentWindow to {${Math.round(newWidth)}, ${Math.round(newHeight)}}
        on error errMsg
          -- エラーは無視（リサイズできないウィンドウもある）
        end try
        exit repeat
      end if
    end repeat
end tell`

    exec(`osascript -e '${script}'`, (error, _stdout, _stderr) => {
      if (error) {
        console.error(`Error executing AppleScript for window adjustment: ${error}`)
        reject(error)
        return
      }
      resolve()
    })
  })
}

/**
 * タスクバーと重なっているすべてのウィンドウを調整
 */
export async function adjustAllOverlappingWindows(
  windows: MacWindow[],
  display: Display
): Promise<void> {
  const layout = store.store.options.layout as LayoutType
  const taskbarBounds = getTaskbarBounds(display, layout)

  console.log(`Checking ${windows.length} windows for overlap with taskbar`)

  for (const window of windows) {
    const adjustment = adjustWindowToAvoidTaskbar(window, taskbarBounds, layout)

    if (adjustment) {
      console.log(
        `Adjusting window: ${window.kCGWindowOwnerName} - ${window.kCGWindowName || 'untitled'}`
      )
      console.log(`  From: (${window.kCGWindowBounds.X}, ${window.kCGWindowBounds.Y}, ${window.kCGWindowBounds.Width}, ${window.kCGWindowBounds.Height})`)
      console.log(
        `  To: (${adjustment.newX}, ${adjustment.newY}, ${adjustment.newWidth}, ${adjustment.newHeight})`
      )

      try {
        await resizeAndMoveWindow(
          window,
          adjustment.newX,
          adjustment.newY,
          adjustment.newWidth,
          adjustment.newHeight
        )
      } catch (error) {
        console.error(
          `Failed to adjust window: ${window.kCGWindowOwnerName} - ${window.kCGWindowName}`,
          error
        )
      }
    }
  }
}
