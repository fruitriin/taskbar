import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import { ElectronAPI } from '@electron-toolkit/preload'

declare global{
  // eslint-disable-next-line no-var
  var electron: ElectronAPI;
}


if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
}
