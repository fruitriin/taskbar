export type MacWindow = {
  kCGWindowLayer: number
  kCGWindowName: string
  kCGWindowMemoryUsage: number
  kCGWindowIsOnscreen: number
  kCGWindowSharingState: number
  kCGWindowOwnerPID: number
  kCGWindowOwnerName: string
  kCGWindowNumber: number
  kCGWindowStoreType: number
  kCGWindowBounds: {
    X: number
    Height: number
    Y: number
    Width: number
  }
  appIcon: string
}
