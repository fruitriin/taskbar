// IPC の薄い抽象化レイヤー（リアーキ Phase 1 スライス 1-A）
// Phase 1 では Electron IPC（window.electron）を実装とする。Phase 3 で Tauri に差し替える。
// window.electron 経由を維持することで、ブラウザ用モック（mocks/electron-mocks.ts）と
// テストのモック注入がそのまま機能する。
export async function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.electron.ipcRenderer.invoke(channel, ...args) as Promise<T>
}

// 解除関数を返す。コンポーネントの onUnmounted で必ず呼ぶこと
export function ipcListen<T>(channel: string, handler: (payload: T) => void): () => void {
  // 第1引数は IpcRendererEvent だが、@electron-toolkit/preload が型を export していないため unknown
  const listener = (_event: unknown, ...args: unknown[]): void => {
    handler(args[0] as T)
  }
  window.electron.ipcRenderer.on(channel, listener)
  return (): void => {
    window.electron.ipcRenderer.removeListener(channel, listener)
  }
}

export function ipcSend(channel: string, ...args: unknown[]): void {
  // Vue の reactivity proxy を IPC 境界で剥がす（utils.ts の Electron.send と同じ理由）
  window.electron.ipcRenderer.send(channel, ...JSON.parse(JSON.stringify(args)))
}
