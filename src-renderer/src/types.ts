// レンダラー共有のデータ型（リアーキ Phase 1 スライス 1-C で utils.ts から切り出し）
// Electron 非依存の純粋な型のみを置く。Phase 3（Tauri 移行）後もこのファイルは残る。

export type NumberFilter = {
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

export type StringFilter = {
  property: 'kCGWindowOwnerName' | 'kCGWindowName'
  is: string
}

export type BooleanFilter = {
  property: 'kCGWindowStoreType' | 'kCGWindowIsOnscreen'
  is: boolean
}

export type Filter = NumberFilter | StringFilter | BooleanFilter

export type LabeledFilters = {
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
    /** タスクバーと重なるウィンドウを自動で避けさせる（既定 true） */
    autoAvoidTaskbarOverlap: boolean
    /** 重なり回避の対象がフルスクリーンなら解除してから避ける（既定 false） */
    exitFullScreenToAvoidTaskbar: boolean
  }
  filters?: unknown[]
  labeledFilters: LabeledFilters[]
}
