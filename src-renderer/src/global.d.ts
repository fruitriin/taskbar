// MacWindow のグローバル型（旧 src/main/type.d.ts。Phase 3 の Electron 削除で renderer へ移設）
// Rust 側の window_manager.rs（serde rename）とキー名を一致させている
declare global {
  type MacWindow = {
    kCGWindowLayer: number
    kCGWindowName?: string
    kCGWindowMemoryUsage: number
    kCGWindowIsOnscreen?: number
    kCGWindowSharingState: number
    kCGWindowOwnerPID: number
    kCGWindowOwnerName: string
    kCGWindowNumber: number
    kCGWindowStoreType?: number
    kCGWindowBounds: {
      X: number
      Height: number
      Y: number
      Width: number
    }
    appIcon: string
  }
}

export {}
