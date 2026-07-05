// @ts-ignore - Import type compatibility
import { ElectronAPI, IpcRendererEvent } from '@electron-toolkit/preload'
declare global {
  interface Window {
    electron: ElectronAPI
    store: Store
  }
}

type NumberFilter = {
  property:
    | 'X'
    | 'Y'
    | 'Height'
    | 'Width'
    | 'kCGWindowMemoryUsage'
    | 'kCGWindowOwnerPID'
    | 'kCGWindowNumber'
  is: number
}
type StringFilter = {
  property: 'kCGWindowOwnerName' | 'kCGWindowName'
  is: string
}
type BooleanFilter = {
  property: 'kCGWindowStoreType' | 'kCGWindowIsOnscreen'
  is: boolean
}

type Filter = NumberFilter | StringFilter | BooleanFilter

type LabeledFilters = {
  label: string
  filters: Filter[]
}

export type Store = {
  granted: boolean
  options: {
    layout: string
    windowSortByPositionInApp: boolean
    appOrder?: string[]
    headers: string[]
    footers: string[]
  }
  filters?: unknown[]
  labeledFilters: LabeledFilters[]
}

export type WindowSortOptions = {
  /** false: 起動順（kCGWindowNumber 昇順）/ true: 座標順 */
  sortByPosition: boolean
  /** タスクバーの表示位置。left/right は縦レイアウトのため座標順のキーに Y を使う */
  layout: string
}

export type WindowGroupSortOptions = WindowSortOptions & {
  /** ユーザーが D&D で決めたアプリ順。先頭が最優先 */
  appOrder: string[]
  /** セッション内でタスクバーに出現した順。appOrder に無いアプリのフォールバック */
  appearanceOrder?: string[]
}

// アプリ内のウィンドウを「起動順」または「座標順」で並べる
export function sortWindowsInApp(windows: MacWindow[], options: WindowSortOptions): MacWindow[] {
  const key = (win: MacWindow): number => {
    if (!options.sortByPosition) return win.kCGWindowNumber
    return options.layout === 'left' || options.layout === 'right'
      ? win.kCGWindowBounds.Y
      : win.kCGWindowBounds.X
  }
  return [...windows].sort((a, b) => key(a) - key(b))
}

// 同一アプリのウィンドウを隣接させる。グループ順は appOrder → appearanceOrder →
// グループ内最小 kCGWindowNumber 昇順。最後のフォールバックを Helper の送信順ではなく
// 決定的なルールにすることで、複数ディスプレイのタスクバーが同じ順序に収束する
export function groupWindowsByApp(
  windows: MacWindow[],
  options: WindowGroupSortOptions
): MacWindow[] {
  const groups = new Map<string, MacWindow[]>()
  for (const win of windows) {
    const group = groups.get(win.kCGWindowOwnerName)
    if (group) {
      group.push(win)
    } else {
      groups.set(win.kCGWindowOwnerName, [win])
    }
  }

  const minWindowNumber = (app: string): number =>
    Math.min(...(groups.get(app) ?? []).map((win) => win.kCGWindowNumber))
  const fallbackApps = [...groups.keys()].sort((a, b) => minWindowNumber(a) - minWindowNumber(b))

  const priority = [...options.appOrder, ...(options.appearanceOrder ?? []), ...fallbackApps]
  const orderedApps: string[] = []
  for (const app of priority) {
    if (groups.has(app) && !orderedApps.includes(app)) orderedApps.push(app)
  }

  return orderedApps.flatMap((app) => sortWindowsInApp(groups.get(app) ?? [], options))
}

// D&D 永続化用のアプリ順リストを組み立てる。既存の appOrder の並びを温存し、
// そこに無い表示中アプリを末尾に追加する（非表示アプリの位置を失わないため）
export function buildAppOrder(previousOrder: string[], windows: MacWindow[]): string[] {
  const result = [...previousOrder]
  for (const win of windows) {
    if (!result.includes(win.kCGWindowOwnerName)) result.push(win.kCGWindowOwnerName)
  }
  return result
}

// D&D の並び替え: dragged を target の位置に移動した新しい配列を返す
// 前方から後方へのドラッグは target の後ろに、後方から前方へは target の前に挿入する
export function moveApp(apps: string[], dragged: string, target: string): string[] {
  const from = apps.indexOf(dragged)
  const to = apps.indexOf(target)
  if (dragged === target || from === -1 || to === -1) return [...apps]
  const result = apps.filter((app) => app !== dragged)
  result.splice(result.indexOf(target) + (from < to ? 1 : 0), 0, dragged)
  return result
}

export const Electron = {
  listen(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
    window.electron.ipcRenderer.on(channel, listener)
  },
  send(channel: string, ...args: any[]): void {
    window.electron.ipcRenderer.send(channel, ...JSON.parse(JSON.stringify(args)))
  }
}
