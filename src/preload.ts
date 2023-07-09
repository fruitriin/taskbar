import { exposeElectronAPI } from '@electron-toolkit/preload'
exposeElectronAPI()
import * as electron from 'electron'

import Store from 'electron-store'

const store = new Store({
  defaults: {
    granted: false
  }
})

declare global {
  interface Window {
    store: typeof store
  }
}
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld('store', store.store)
  } catch (error) {
    console.error(error)
  }
} else {
  window.store = store
}
