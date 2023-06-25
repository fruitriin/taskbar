import { ElectronAPI, IpcRendererEvent } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

export const Electron = {
  listen(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
    window.electron.ipcRenderer.on(channel, listener)
  },
  send(channel: string, ...args: any[]): void {
    window.electron.ipcRenderer.send(channel, ...args)
  }
}
