import { exposeElectronAPI } from '@electron-toolkit/preload'
exposeElectronAPI()
import * as electron from "electron"

import * as Store from 'electron-store';

declare global {
  interface Window {
    store: Store
  }
}

if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld('store', () => new Store());
  }
  catch (error) {
    console.error(error);
  }
}
else {
  window.store = new Store();
}
