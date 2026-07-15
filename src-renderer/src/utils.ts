import type { Store } from './types'
import { ipcSend } from './composables/ipc'

// Electron 本体は Phase 3 で削除済み。window.electron を注入するのは
// ブラウザ開発・テスト時のモック（mocks/electron-mocks.ts）のみ
type MockIpcRenderer = {
  invoke(channel: string, ...args: any[]): Promise<any>
  send(channel: string, ...args: any[]): void
  on(channel: string, listener: (event: unknown, ...args: any[]) => void): void
  removeListener(channel: string, listener: (event: unknown, ...args: any[]) => void): void
}

declare global {
  interface Window {
    // Tauri 実行時はどちらも存在しない（ipc.ts がランタイム判定する）ため optional。
    // 使う側にランタイムチェックを強制する
    electron?: { ipcRenderer: MockIpcRenderer }
    store?: Store
  }
}

// 互換のための再エクスポート（新規コードは './types' から直接 import すること）
export type { Store, Filter, LabeledFilters } from './types'

export type WindowSortOptions = {
  /** false: 起動順（kCGWindowNumber 昇順）/ true: 座標順 */
  sortByPosition: boolean
  /** タスクバーの表示位置。left/right は縦レイアウトのため座標順のキーに Y を使う */
  layout: string
}

export type WindowGroupSortOptions = WindowSortOptions & {
  /** ユーザーが D&D で決めたアプリ順。先頭が最優先 */
  appOrder: string[]
  /** セッション内でタスクバーに出現した順。appOrder に無いアプリのフォールバック */
  appearanceOrder?: string[]
}

// アプリ内のウィンドウを「起動順」または「座標順」で並べる
export function sortWindowsInApp(windows: MacWindow[], options: WindowSortOptions): MacWindow[] {
  const key = (win: MacWindow): number => {
    if (!options.sortByPosition) return win.kCGWindowNumber
    return options.layout === 'left' || options.layout === 'right'
      ? win.kCGWindowBounds.Y
      : win.kCGWindowBounds.X
  }
  return [...windows].sort((a, b) => key(a) - key(b))
}

// 同一アプリのウィンドウを隣接させる。グループ順は appOrder → appearanceOrder →
// グループ内最小 kCGWindowNumber 昇順。最後のフォールバックを Helper の送信順ではなく
// 決定的なルールにすることで、複数ディスプレイのタスクバーが同じ順序に収束する
export function groupWindowsByApp(
  windows: MacWindow[],
  options: WindowGroupSortOptions
): MacWindow[] {
  const groups = new Map<string, MacWindow[]>()
  for (const win of windows) {
    const group = groups.get(win.kCGWindowOwnerName)
    if (group) {
      group.push(win)
    } else {
      groups.set(win.kCGWindowOwnerName, [win])
    }
  }

  const minWindowNumber = (app: string): number =>
    Math.min(...(groups.get(app) ?? []).map((win) => win.kCGWindowNumber))
  const fallbackApps = [...groups.keys()].sort((a, b) => minWindowNumber(a) - minWindowNumber(b))

  const priority = [...options.appOrder, ...(options.appearanceOrder ?? []), ...fallbackApps]
  const orderedApps: string[] = []
  for (const app of priority) {
    if (groups.has(app) && !orderedApps.includes(app)) orderedApps.push(app)
  }

  return orderedApps.flatMap((app) => sortWindowsInApp(groups.get(app) ?? [], options))
}

/** 同一アプリのウィンドウをまとめた表示単位。D&D の当たり判定・幾何情報はこの単位で扱う */
export type WindowGroup = {
  app: string
  windows: MacWindow[]
}

// groupWindowsByApp の戻り値（同一アプリが隣接済み）を連続区間ごとにグループへ束ねる。
// D&D の判定単位（アプリ）と DOM 上の当たり判定単位を一致させるため、テンプレート側は
// 個別ウィンドウではなくこのグループ単位で wrapper 要素を描画する
// （group-drag-swap-fix.md: グループ矩形とサブボタン矩形のズレがフリッカーの原因だった）
export function chunkIntoGroups(windows: MacWindow[]): WindowGroup[] {
  const groups: WindowGroup[] = []
  for (const win of windows) {
    const last = groups[groups.length - 1]
    if (last && last.app === win.kCGWindowOwnerName) {
      last.windows.push(win)
    } else {
      groups.push({ app: win.kCGWindowOwnerName, windows: [win] })
    }
  }
  return groups
}

// D&D 永続化用のアプリ順リストを組み立てる。既存の appOrder の並びを温存し、
// そこに無い表示中アプリを末尾に追加する（非表示アプリの位置を失わないため）
export function buildAppOrder(previousOrder: string[], windows: MacWindow[]): string[] {
  const result = [...previousOrder]
  for (const win of windows) {
    if (!result.includes(win.kCGWindowOwnerName)) result.push(win.kCGWindowOwnerName)
  }
  return result
}

// --- ドラッグ中のリアルタイム入れ替え判定 ---
// 参考: fruitriin/misskey の MkDraggable（Pointer Events 実装）のエッセンス移植

// index.vue の .flip-list-move の transition duration と一致させる（この値以内に
// FLIP アニメーションを完走させる契約。オーナー実機確認で 150ms→220ms でも「まだ早い」
// との指摘があり 800ms に調整。変更する場合は両方を揃えて更新すること）
/** 入れ替え直後の再入れ替えを抑止するクールダウン（振動防止） */
export const REORDER_COOLDOWN_MS = 800
/** ゴーストがターゲットにこの比率以上重なったら入れ替える */
export const OVERLAP_RATIO = 0.3

export type Rect = {
  left: number
  right: number
  top: number
  bottom: number
}

export type SwapJudgeInput = {
  /** 現在の並び順でのドラッグ元アプリの位置 */
  fromIndex: number
  /** 現在の並び順でのターゲットアプリの位置 */
  toIndex: number
  /** ゴースト（ドラッグ追従要素）の矩形 */
  ghostRect: Rect
  /** ターゲットボタンの矩形 */
  targetRect: Rect
  /** 水平タスクバー（bottom）なら true、垂直（left/right）なら false */
  horizontal: boolean
  /** 前回入れ替えた時刻（ms） */
  lastSwapAt: number
  /** 現在時刻（ms） */
  now: number
}

// ドラッグ中にターゲットと入れ替えてよいか判定する。
// 進行方向側のゴースト端がターゲットに OVERLAP_RATIO 以上食い込んでいることと、
// クールダウン経過の両方を要求することで、入れ替え直後の振動（オシレーション）を防ぐ
export function shouldSwap(input: SwapJudgeInput): boolean {
  if (input.fromIndex === -1 || input.toIndex === -1 || input.fromIndex === input.toIndex) {
    return false
  }
  if (input.now - input.lastSwapAt < REORDER_COOLDOWN_MS) return false

  const size = (rect: Rect): number =>
    input.horizontal ? rect.right - rect.left : rect.bottom - rect.top
  const threshold = Math.min(size(input.ghostRect), size(input.targetRect)) * OVERLAP_RATIO

  // 前方→後方への移動はゴーストの後端がターゲット前端へ、逆は前端が後端へ食い込む量
  const overlap =
    input.fromIndex < input.toIndex
      ? input.horizontal
        ? input.ghostRect.right - input.targetRect.left
        : input.ghostRect.bottom - input.targetRect.top
      : input.horizontal
        ? input.targetRect.right - input.ghostRect.left
        : input.targetRect.bottom - input.ghostRect.top

  return overlap >= threshold
}

// 進行方向の主軸でゴーストとターゲットの矩形が完全に離れている（重なりがゼロ以下）かを判定する。
// 入れ替え直後、同じ相手と即座に逆方向へ再入れ替えされる振動（thrashing）を防ぐために使う:
// 一度重なって入れ替えた相手とは、ゴーストが完全に離れるまで再入れ替えを禁止する
// （クールダウン＋30%食い込みしきい値だけでは、入れ替え後もゴーストが相手の近くに
// 留まり続けるケースで往復してしまうことがある）
export function rectsSeparated(ghostRect: Rect, targetRect: Rect, horizontal: boolean): boolean {
  const overlap = horizontal
    ? Math.min(ghostRect.right, targetRect.right) - Math.max(ghostRect.left, targetRect.left)
    : Math.min(ghostRect.bottom, targetRect.bottom) - Math.max(ghostRect.top, targetRect.top)
  return overlap <= 0
}

// D&D の並び替え: dragged を target の位置に移動した新しい配列を返す
// 前方から後方へのドラッグは target の後ろに、後方から前方へは target の前に挿入する
export function moveApp(apps: string[], dragged: string, target: string): string[] {
  const from = apps.indexOf(dragged)
  const to = apps.indexOf(target)
  if (dragged === target || from === -1 || to === -1) return [...apps]
  const result = apps.filter((app) => app !== dragged)
  result.splice(result.indexOf(target) + (from < to ? 1 : 0), 0, dragged)
  return result
}

export const Electron = {
  // ipc.ts へ委譲（JSON クローンによるプロキシ剥がしの単一ソース化）。
  // listen は呼び出し元ゼロになったため削除済み — 新規コードは ipcListen を使うこと
  send(channel: string, ...args: any[]): void {
    ipcSend(channel, ...args)
  }
}
