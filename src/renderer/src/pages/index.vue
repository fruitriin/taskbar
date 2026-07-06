<template>
  <div :class="options.layout">
    <div style="display: flex">
      <div class="icon-area" @click="openMenu">
        <img :src="icon" style="height: 40px" />
      </div>
      <div class="permissions">
        <MainPermissionStatus />
      </div>
      <div v-if="visibleWindows.length == 0" class="helper-restart">
        <button class="button is-small" @click="restartHelper()">Helper再起動</button>
      </div>
      <div v-if="visibleWindows.length == 0" style="width: 100%">
        What display call this bar: {{ displayInfo }}
        <button class="button" @click="dumpTaskbarInfo">dumpTaskbarInfo</button>
      </div>
    </div>
    <TransitionGroup
      tag="div"
      name="flip-list"
      class="tasks"
      :style="{ gridTemplateColumns: visibleWindows.map(() => '1fr').join(' ') }"
      style="overflow-y: auto"
    >
      <button
        v-for="win in headerWindows"
        :key="win.kCGWindowOwnerPID + win.kCGWindowNumber"
        class="button task"
        @click="acticveWindow(win)"
        @click.right.prevent="test(win)"
      >
        <img class="icon" :src="win.appIcon" />
        <div v-if="win.kCGWindowName" class="name">
          {{ win.kCGWindowName }} - {{ win.kCGWindowOwnerName }}
        </div>
        <div v-else class="name">{{ win.kCGWindowOwnerName }}</div>
      </button>
      <button
        v-for="win in centerWindows"
        :key="win.kCGWindowOwnerPID + win.kCGWindowNumber"
        class="button task"
        :class="{ 'drag-source': dragApp === win.kCGWindowOwnerName }"
        :data-app="win.kCGWindowOwnerName"
        @click="onTaskClick(win)"
        @click.right.prevent="test(win)"
        @pointerdown="onTaskPointerDown($event, win)"
      >
        <img class="icon" :src="win.appIcon" />
        <div v-if="win.kCGWindowName" class="name">
          {{ win.kCGWindowName }} - {{ win.kCGWindowOwnerName }}
        </div>
        <div v-else class="name">{{ win.kCGWindowOwnerName }}</div>
      </button>
      <button
        v-for="win in footerWindows"
        :key="win.kCGWindowOwnerPID + win.kCGWindowNumber"
        class="button task"
        @click="acticveWindow(win)"
        @click.right.prevent="test(win)"
      >
        <img class="icon" :src="win.appIcon" />
        <div v-if="win.kCGWindowName" class="name">
          {{ win.kCGWindowName }} - {{ win.kCGWindowOwnerName }}
        </div>
        <div v-else class="name">{{ win.kCGWindowOwnerName }}</div>
      </button>
    </TransitionGroup>
    <div
      v-if="ghostWindow"
      class="button task ghost-task"
      :style="[ghostStyle, { transform: ghostTransform }]"
    >
      <img class="icon" :src="ghostWindow.appIcon" />
      <div v-if="ghostWindow.kCGWindowName" class="name">
        {{ ghostWindow.kCGWindowName }} - {{ ghostWindow.kCGWindowOwnerName }}
      </div>
      <div v-else class="name">{{ ghostWindow.kCGWindowOwnerName }}</div>
    </div>
  </div>
  <div style="height: calc(100% - 56px); overflow-y: auto">
    <hr />
    <pre>{{ options }}</pre>
    <pre>{{ displayInfo }}</pre>

    <h2 class="block">見えているもの</h2>
    <Debug v-if="debug" :windows="visibleWindows" />
    <hr />
    visibleWindows
  </div>
</template>

<script setup lang="ts">
// このビューは bulma に依存する（旧ルートコンポーネントから移設。ビュー単位の動的 import でスタイル分離）
import 'bulma/css/bulma.css'
import icon from '../assets/icon.png'
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import { createNewSortInstance } from 'fast-sort'
import { buildAppOrder, groupWindowsByApp } from '../utils'
import { createDragSession } from '../drag-session'
import { ipcListen, ipcSend } from '../composables/ipc'
import { useOptions } from '../composables/useOptions'
import Debug from '../components/Debug.vue'
import MainPermissionStatus from '../components/MainPermissionStatus.vue'

// 永続化オプション。updateOptions イベントの受信・楽観反映・setOptions 送信は composable が担う
// （旧実装の自前 updateOptions リスナーはこれに置き換え。echo ループなし: この画面は
// options の deep watch 送信をしない）
const { options, updateOptions } = useOptions()

const windows = ref<MacWindow[] | null>([])
// セッション内でタスクバーに出現したアプリの順序（appOrder 未指定アプリのフォールバック）
const appearanceOrder = ref<string[]>([])
// --- Pointer Events ドラッグセッション ---
// 押下したボタンのウィンドウ（ゴーストの表示内容に使用。矩形は session が保持）
const pressedWindow = ref<MacWindow | null>(null)
// ドラッグ中のアプリ名（drag-source の減光に使用）
const dragApp = ref<string | null>(null)
// ドラッグ中のみ使う一時的なアプリ順。centerWindows がこれを優先する
const dragOrder = ref<string[] | null>(null)
// ドラッグ直後の click 合成を1回だけ握りつぶす
const didDrag = ref(false)
// ゴースト表示
const ghostWindow = ref<MacWindow | null>(null)
const ghostStyle = ref<Record<string, string>>({})
const ghostTransform = ref('')
// ドラッグ中に届いた process 更新の保留分（dragend で反映）
const pendingWindows = ref<MacWindow[] | null>(null)
const debug = ref(true)
const displayInfo = ref<{
  workArea?: { x: number; y: number; width: number; height: number }
}>({})

// ディスプレイの中のウィンドウだけに絞り込む
const visibleWindows = computed<MacWindow[]>(() => {
  if (windows.value === null) return []
  const displayConrner = {
    left: displayInfo.value.workArea?.x as number,
    right:
      (displayInfo.value.workArea?.x as number) + (displayInfo.value.workArea?.width as number),
    top: displayInfo.value.workArea?.y as number,
    bottom:
      (displayInfo.value.workArea?.y as number) + (displayInfo.value.workArea?.height as number)
  }
  return [...windows.value].filter((win) => {
    if (displayConrner.left > win.kCGWindowBounds.X + win.kCGWindowBounds.Width) return false
    if (win.kCGWindowBounds.X > displayConrner.right) return false

    if (displayConrner.top > win.kCGWindowBounds.Y + win.kCGWindowBounds.Height) return false
    if (win.kCGWindowBounds.Y > displayConrner.bottom) return false

    return true
  })
})

function sortArea(arr: MacWindow[], area: 'headers' | 'footers'): MacWindow[] {
  const orderRule = {
    Headers: 'desc',
    Footers: 'asc'
  } as const

  // 既存バグの疑い（挙動同一原則に従い旧実装のまま複製）: キーが大文字のため
  // 引数 'headers'/'footers' とは一致せず、order は常に undefined → 常に desc 分岐。
  // 実害: headers は偶然 desc の意図と一致、footers は呼び出し側が返り値を捨てるため
  // 二重に不可視。Feedback.md（2026-07-07）にバグ候補として記録済み
  const order = (orderRule as Record<string, string>)[area]

  const rule: Record<string, number> = {}
  options.value[area]?.forEach((e, i) => {
    rule[e] = i
  })

  const ruleSorter = createNewSortInstance({
    comparer: (a, b) => (rule[a] || 0) - (rule[b] || 0)
  })

  return ruleSorter(arr).by([
    { asc: (u: MacWindow): string => u.kCGWindowOwnerName },
    order === 'asc'
      ? { asc: (u: MacWindow): number => u.kCGWindowBounds.X }
      : { desc: (u: MacWindow): number => u.kCGWindowBounds.X }
  ])
}

const headerWindows = computed<MacWindow[]>(() => {
  const headers = visibleWindows.value.filter((w) =>
    options.value.headers.includes(w.kCGWindowOwnerName)
  )
  return sortArea(headers, 'headers')
})

const footerWindows = computed<MacWindow[]>(() => {
  const footers = visibleWindows.value.filter((w) =>
    options.value.footers.includes(w.kCGWindowOwnerName)
  )
  // 旧実装のまま複製: sortArea の返り値（新配列）を捨てており、実質未ソートで返る
  sortArea(footers, 'footers')
  return footers
})

const centerWindows = computed<MacWindow[]>(() => {
  const centers = visibleWindows.value.filter(
    (w) =>
      !options.value.headers.includes(w.kCGWindowOwnerName) &&
      !options.value.footers.includes(w.kCGWindowOwnerName)
  )
  return groupWindowsByApp(centers, {
    sortByPosition: options.value.windowSortByPositionInApp ?? false,
    layout: options.value.layout ?? 'bottom',
    // ドラッグ中はセッション内の一時順序が最優先（確定は pointerup 時の updateOptions）
    appOrder: dragOrder.value ?? options.value.appOrder ?? [],
    appearanceOrder: appearanceOrder.value
  })
})

// 状態機械に DOM 依存（hitTest）と副作用（ゴースト・永続化）を注入する
// （script setup 直下の const は reactive 化されないため markRaw は実質 no-op だが、
// 将来 data 構造へ移す変更に備えた明示として残置）
const session = markRaw(
  createDragSession({
    getBaseOrder: () => buildAppOrder(options.value.appOrder ?? [], centerWindows.value),
    hitTest: (x, y) => {
      const button = document.elementFromPoint(x, y)?.closest<HTMLElement>('button[data-app]')
      const app = button?.dataset.app
      if (!button || !app) return null
      const rect = button.getBoundingClientRect()
      return {
        app,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
      }
    },
    isHorizontal: () => (options.value.layout ?? 'bottom') === 'bottom',
    onDragStart: (app, rect) => {
      didDrag.value = true
      dragApp.value = app
      ghostWindow.value = pressedWindow.value
      ghostStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.right - rect.left}px`,
        height: `${rect.bottom - rect.top}px`
      }
    },
    onGhostMove: (dx, dy) => {
      ghostTransform.value = `translate(${dx}px, ${dy}px)`
    },
    onOrderChange: (order) => {
      dragOrder.value = order
    },
    // 楽観反映＋setOptions 送信は useOptions.updateOptions が行う（IPC 往復待ちの表示揺れ防止）
    onCommit: (order) => updateOptions({ appOrder: order }),
    onEnd: () => cleanupDrag()
  })
)

function applyWindows(value: MacWindow[]): void {
  trackAppearance(value)
  if (windows.value == null) {
    windows.value = value
    return
  }
  windows.value.splice(0, windows.value.length, ...value)
}

// 新しく出現したアプリを出現順リストの末尾に追加する
// 同時に複数現れた場合は最小 kCGWindowNumber 昇順で追加し、
// どのディスプレイのタスクバーでも同じ順序に収束させる
function trackAppearance(newWindows: MacWindow[]): void {
  const minNumbers = new Map<string, number>()
  for (const win of newWindows) {
    const app = win.kCGWindowOwnerName
    const current = minNumbers.get(app)
    if (current === undefined || win.kCGWindowNumber < current) {
      minNumbers.set(app, win.kCGWindowNumber)
    }
  }
  const newApps = [...minNumbers.keys()]
    .filter((app) => !appearanceOrder.value.includes(app))
    .sort((a, b) => (minNumbers.get(a) as number) - (minNumbers.get(b) as number))
  appearanceOrder.value.push(...newApps)
}

// --- Pointer Events ドラッグ（参考: fruitriin/misskey MkDraggable のエッセンス移植） ---
function onTaskClick(win: MacWindow): void {
  // ドラッグ後に合成される click を1回だけ無視する
  if (didDrag.value) return
  acticveWindow(win)
}

function onTaskPointerDown(event: PointerEvent, win: MacWindow): void {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const pressedRect = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
  const accepted = session.pointerDown(
    {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      buttons: event.buttons,
      button: event.button
    },
    win.kCGWindowOwnerName,
    pressedRect
  )
  if (!accepted) return
  pressedWindow.value = win
  // TransitionGroup の DOM 並び替えで Pointer Capture は暗黙解放されうるため、
  // capture は使わず document でリッスンする
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointercancel', onPointerCancel)
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('keydown', onDragKeyDown)
  window.addEventListener('blur', onWindowBlur)
}

function onPointerMove(event: PointerEvent): void {
  session.pointerMove({
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    buttons: event.buttons
  })
}

function onPointerUp(event: PointerEvent): void {
  session.pointerUp({
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    buttons: event.buttons
  })
}

function onPointerCancel(event: PointerEvent): void {
  // 確定せず破棄 → centerWindows が元の並びへ戻り、FLIP が戻りをアニメーション化。
  // 別ポインタ由来の pointercancel で正当なセッションを打ち切らないよう id を渡す
  session.cancel(event.pointerId)
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') session.cancel()
}

// Esc キーでドラッグをキャンセルする（確定せず元の並びへ戻る）
function onDragKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') session.cancel()
}

// 他アプリへのフォーカス移動中に pointerup を取りこぼした場合の保険
function onWindowBlur(): void {
  session.cancel()
}

// 状態機械の onEnd から呼ばれる後片付け（確定・キャンセル共通）
function cleanupDrag(): void {
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('pointercancel', onPointerCancel)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  document.removeEventListener('keydown', onDragKeyDown)
  window.removeEventListener('blur', onWindowBlur)
  dragApp.value = null
  dragOrder.value = null
  pressedWindow.value = null
  ghostWindow.value = null
  ghostStyle.value = {}
  ghostTransform.value = ''
  // click はこの pointerup の直後に同期発火するため、次のマクロタスクで解除する
  window.setTimeout(() => {
    didDrag.value = false
  }, 0)
  // ドラッグ中に保留した process 更新を反映する
  if (pendingWindows.value) {
    const pending = pendingWindows.value
    pendingWindows.value = null
    applyWindows(pending)
  }
}

function test(ev: MacWindow): void {
  ipcSend('contextTask', ev)
}

function dumpTaskbarInfo(): void {
  ipcSend('dumpTaskbarInfo')
}

function openMenu(): void {
  ipcSend('contextLogo')
}

function acticveWindow(win: MacWindow): void {
  ipcSend('activeWindow', win)
}

function restartHelper(delay?: number): void {
  ipcSend('restartHelper', delay)
}

// アイコン更新処理。ref の深いリアクティビティにより代入だけで再描画される
// （旧実装の $forceUpdate は不要になったため排除 — Phase 1 完了条件）
function updateWindowIcons(icons: Record<string, string>): void {
  if (!windows.value) return

  windows.value.forEach((win) => {
    const owner = (win.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')

    if (icons[owner] && !win.appIcon) {
      win.appIcon = `data:image/png;base64,${icons[owner]}`
    }
  })
}

let unlistenProcess: (() => void) | undefined
let unlistenIcons: (() => void) | undefined
let unlistenDisplayInfo: (() => void) | undefined

onMounted(() => {
  // process はドラッグ中の保留ガードが必要なため useWindows（シングルトン）ではなく
  // 自前リスナーを維持する（統合は保留ガードの composable 化とセットで将来検討）
  unlistenProcess = ipcListen<MacWindow[]>('process', (value) => {
    // ポインタ押下中（閾値未満のプレドラッグ含む）は並びの土台が動くと
    // 入れ替え判定や pressedWindow が崩れるため、反映を保留する
    if (session.isActive) {
      pendingWindows.value = value
      return
    }
    applyWindows(value)
  })

  // アイコン更新イベントをリスン
  unlistenIcons = ipcListen<Record<string, string>>('iconUpdate', (icons) => {
    updateWindowIcons(icons)
  })

  unlistenDisplayInfo = ipcListen<{
    workArea: { x: number; y: number; width: number; height: number }
  }>('displayInfo', (value) => {
    displayInfo.value = value
  })

  ipcSend('windowReady')
})

onBeforeUnmount(() => {
  // ドラッグ途中でアンマウントされた場合の document リスナーのリーク防止
  session.cancel()
  unlistenProcess?.()
  unlistenIcons?.()
  unlistenDisplayInfo?.()
})
</script>

<style lang="scss" scoped>
.icon-area {
  display: flex;
  align-items: center;
  margin: 8px;
  margin-right: 0;
}

.left,
.right {
  .icon-area {
    display: flex;
    justify-content: center;
    margin: 8px;
  }
}

.permissions {
  display: flex;
  align-items: center;
  justify-content: center;
}

.helper-restart {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 8px;
}

.checkbox:hover {
  color: white;
}

.bottom {
  display: flex;
  justify-content: space-between;
  width: fit-content;
  .tasks {
    width: 100%;
    display: grid;
  }
  .submenu {
    display: flex;
    align-items: center;
  }
}

.left,
.right {
  display: flex;
  flex-direction: column;
  height: 100%;

  .tasks {
    display: flex;
    flex-direction: column;
    .task {
      justify-content: start;
    }
  }

  .submenu {
    align-items: flex-end;
    height: 100%;
    display: flex;
    justify-content: center;

    .select,
    .select select {
      width: 100%;
    }
  }
}

// TransitionGroup(name="flip-list") の FLIP: 並び替え時に各ボタンが滑って移動する
// duration は入れ替えクールダウン（REORDER_COOLDOWN_MS = 150ms）以内に完走させる。
// これより長いと連続で避けるときに完走前へ次の入れ替えが割り込み、等速で流れて見える
.flip-list-move {
  transition: transform 0.15s cubic-bezier(0.2, 0, 0, 1);
}

// ドラッグ元グループの減光
.drag-source {
  opacity: 0.4;
}

// ドラッグ追従ゴースト（elementFromPoint に拾われないよう pointer-events: none 必須）
.ghost-task {
  position: fixed;
  margin: 0;
  pointer-events: none;
  opacity: 0.85;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.task {
  max-width: 200px;
  overflow: hidden;
  white-space: initial;
  margin: 8px 4px;
  user-select: none;
  display: flex;
  vertical-align: center;
  align-items: center;
  line-height: 1.5;
  font-size: 1rem;
  height: 2.5em;
  color: #fff;
  cursor: pointer;
  justify-content: start;

  padding: calc(0.5em - 1px) 1em;
  white-space: nowrap;
  background-color: hsl(0, 0%, 21%);
  border: solid 2px hsl(0, 0%, 71%);
  border-radius: 4px;

  .icon {
    margin-left: calc(-0.5em - 1px);
    margin-right: 0.25em;
    height: 1.5em;
    width: 1.5em;
    align-items: center;
    display: inline-flex;
    justify-content: center;
  }

  .name {
    max-width: fit-content;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    word-break: break-all;
    text-align: left;
  }
}
</style>
