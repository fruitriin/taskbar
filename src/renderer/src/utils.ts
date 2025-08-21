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

type Store = {
  granted: boolean
  options: {
    layout: string
    windowSortByPositionInApp: false
    headers: string[]
    footers: string[]
  }
  labeledFilters: LabeledFilters[]
}

export const Electron = {
  listen(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
    window.electron.ipcRenderer.on(channel, listener)
  },
  send(channel: string, ...args: any[]): void {
    window.electron.ipcRenderer.send(channel, ...JSON.parse(JSON.stringify(args)))
  }
}
