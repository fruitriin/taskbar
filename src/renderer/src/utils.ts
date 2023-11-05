import { ElectronAPI, IpcRendererEvent } from '@electron-toolkit/preload'
declare global {
  interface Window {
    electron: ElectronAPI
    store: Store
  }
}

type Store = {
  granted: boolean
  options: {
    layout: string
    windowSortByPositionInApp: false
    headers: string[]
    footers: string[]
  }
  filters: { property: string; is: string }[][]
}

export const Electron = {
  listen(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
    window.electron.ipcRenderer.on(channel, listener)
  },
  send(channel: string, ...args: any[]): void {
    window.electron.ipcRenderer.send(channel, ...JSON.parse(JSON.stringify(args)))
  }
}
