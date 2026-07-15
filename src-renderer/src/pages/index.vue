<template>
  <div :class="options.layout">
    <div style="display: flex">
      <div class="icon-area" @click="openMenu">
        <img :src="icon" style="height: 40px" />
      </div>
      <div class="permissions">
        <MainPermissionStatus />
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
      :style="{ gridTemplateColumns: taskColumnWeights.map((n) => `${n}fr`).join(' ') }"
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
      <!-- グループ wrapper 自体を入れ子の TransitionGroup にする（外側の flip-list とは
           独立したインスタンス）。plain div にすると、グループ内ウィンドウの増減時に
           内部ボタンの FLIP アニメーションが効かなくなる（レビュー指摘）。
           name は外側と別にする（flip-list-inner）— 同名だと CSS クラスが衝突し、
           外側のグループ並び替えアニメーションまで効かなくなることがオーナー実機確認で判明 -->
      <TransitionGroup
        v-for="group in centerGroups"
        :key="`group:${group.app}`"
        tag="div"
        name="flip-list-inner"
        class="task-group"
        :class="{ 'drag-source': dragApp === group.app }"
        :data-app="group.app"
        @pointerdown="onGroupPointerDown($event, group)"
      >
        <button
          v-for="win in group.windows"
          :key="win.kCGWindowOwnerPID + win.kCGWindowNumber"
          class="button task"
          @click="onTaskClick(win)"
          @click.right.prevent="test(win)"
        >
          <img class="icon" :src="win.appIcon" />
          <div v-if="win.kCGWindowName" class="name">
            {{ win.kCGWindowName }} - {{ win.kCGWindowOwnerName }}
          </div>
          <div v-else class="name">{{ win.kCGWindowOwnerName }}</div>
        </button>
      </TransitionGroup>
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
      v-if="ghostGroup"
      class="task-group ghost-task"
      :style="[ghostStyle, { transform: ghostTransform }]"
    >
      <button
        v-for="win in ghostGroup.windows"
        :key="win.kCGWindowOwnerPID + win.kCGWindowNumber"
        class="button task"
      >
        <img class="icon" :src="win.appIcon" />
        <div v-if="win.kCGWindowName" class="name">
          {{ win.kCGWindowName }} - {{ win.kCGWindowOwnerName }}
        </div>
        <div v-else class="name">{{ win.kCGWindowOwnerName }}</div>
      </button>
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
import icon from '../assets/icon.png'
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import { createNewSortInstance } from 'fast-sort'
import { buildAppOrder, chunkIntoGroups, groupWindowsByApp } from '../utils'
import type { WindowGroup, Rect } from '../utils'
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
// 押下したグループ（ゴーストの表示内容に使用。矩形は session が保持）
// グループ単位でドラッグを扱う（group-drag-swap-fix.md: 判定単位はアプリ＝グループのため、
// ゴーストや当たり判定もグループ単位の矩形に揃える）
const pressedGroup = ref<WindowGroup | null>(null)
// ドラッグ中のアプリ名（drag-source の減光に使用）
const dragApp = ref<string | null>(null)
// ドラッグ中のみ使う一時的なアプリ順。centerWindows がこれを優先する
const dragOrder = ref<string[] | null>(null)
// ドラッグ直後の click 合成を1回だけ握りつぶす
const didDrag = ref(false)
// ゴースト表示（グループ全体を表示するため WindowGroup を保持）
const ghostGroup = ref<WindowGroup | null>(null)
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

// centerWindows（同一アプリが隣接済みのフラット配列）をグループ単位に束ねる。
// D&D の当たり判定・ゴースト・wrapper 描画は全てこのグループ単位で行う
const centerGroups = computed<WindowGroup[]>(() => chunkIntoGroups(centerWindows.value))

// grid レイアウト（bottom）の列幅比率。ヘッダー/フッターは1、センターはグループ内の
// ウィンドウ数分の重みを与え、複数ウィンドウのグループが見た目上も相応の幅を持つようにする
// （group-drag-swap-fix.md: グループの表示幅と当たり判定の矩形を一致させる対応の一部）
const taskColumnWeights = computed<number[]>(() => [
  ...headerWindows.value.map(() => 1),
  ...centerGroups.value.map((group) => group.windows.length),
  ...footerWindows.value.map(() => 1)
])

// 状態機械に DOM 依存（hitTest）と副作用（ゴースト・永続化）を注入する
// （script setup 直下の const は reactive 化されないため markRaw は実質 no-op だが、
// 将来 data 構造へ移す変更に備えた明示として残置）
const session = markRaw(
  createDragSession({
    getBaseOrder: () => buildAppOrder(options.value.appOrder ?? [], centerWindows.value),
    hitTest: (x, y) => {
      // グループ wrapper 単位で当たり判定する（個別ボタンではない）。判定単位（アプリ）と
      // 幾何情報取得単位を一致させることでフリッカーを解消する
      const toResult = (el: HTMLElement): { app: string; rect: Rect } | null => {
        const app = el.dataset.app
        if (!app) return null
        const rect = el.getBoundingClientRect()
        return {
          app,
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
        }
      }
      const direct = document.elementFromPoint(x, y)?.closest<HTMLElement>('.task-group[data-app]')
      if (direct) return toResult(direct)

      // タスクバーのウィンドウ領域からはみ出した場合（縦にはみ出した・末尾を通り過ぎた等）も
      // 進行軸の座標だけでグループを解決する（Y/X がずれていても無視する）。タスクバーは
      // 専用ウィンドウで他パネルと同居しないため、帯制限は設けなくてよい
      // （そこまで正確に戻さないと入れ替えられない問題への対応。オーナー実機確認で追加）
      const groups = Array.from(
        document.querySelectorAll<HTMLElement>('.tasks .task-group[data-app]')
      ).map((el) => ({ el, rect: el.getBoundingClientRect() }))
      if (groups.length === 0) return null
      const horizontal = (options.value.layout ?? 'bottom') === 'bottom'
      // 進行軸の座標がどのグループの範囲に入っているかを探す（列の途中から縦にはみ出した
      // ケースに対応。先頭/末尾の二択だけだと途中のグループを飛び越してしまう）
      const inRange = groups.find(({ rect: r }) =>
        horizontal ? x >= r.left && x <= r.right : y >= r.top && y <= r.bottom
      )
      if (inRange) return toResult(inRange.el)

      // どのグループの範囲にも入らない（先頭より前・末尾より後ろ）場合は端にフォールバックする
      const first = groups[0]
      const last = groups[groups.length - 1]
      const beforeFirst = horizontal ? x < first.rect.left : y < first.rect.top
      return toResult(beforeFirst ? first.el : last.el)
    },
    isHorizontal: () => (options.value.layout ?? 'bottom') === 'bottom',
    onDragStart: (app, rect) => {
      didDrag.value = true
      dragApp.value = app
      ghostGroup.value = pressedGroup.value
      ghostStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.right - rect.left}px`,
        height: `${rect.bottom - rect.top}px`
      }
    },
    onGhostMove: (dx, dy) => {
      // 並び替えは1軸（水平タスクバーなら横、垂直なら縦）でしか起きないため、
      // ゴーストも進行軸のみに追従させる（オーナー実機確認で「縦にも動いてしまう」指摘）
      const horizontal = (options.value.layout ?? 'bottom') === 'bottom'
      ghostTransform.value = horizontal ? `translate(${dx}px, 0px)` : `translate(0px, ${dy}px)`
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

function onGroupPointerDown(event: PointerEvent, group: WindowGroup): void {
  // リスナーはグループ wrapper に張られているため currentTarget は常にグループ全体の矩形
  // （グループ内のどのウィンドウを押しても、そのグループ全体をドラッグ対象にする）
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
    group.app,
    pressedRect
  )
  if (!accepted) return
  pressedGroup.value = group
  // TransitionGroup の DOM 並び替えで Pointer Capture は暗黙解放されうるため、
  // capture は使わず document でリッスンする
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointercancel', onPointerCancel)
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('keydown', onDragKeyDown)
  window.addEventListener('blur', onWindowBlur)
}

// rAF 間引きは撤回済み（group-drag-swap-fix.md フェーズ3で導入したが、Vue の
// TransitionGroup が FLIP に内部で使う rAF ベースの measure/apply シーケンスと競合し、
// ドラッグ中だけ FLIP アニメーションが効かなくなる副作用がオーナー実機確認で判明した。
// 振動対策は shouldSwap の2段ヒステリシス＋blockedApp の完全分離待ちで足りているため、
// rAF 間引きなしの同期呼び出しに戻す）
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
  pressedGroup.value = null
  ghostGroup.value = null
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
    // 入れ替え判定や pressedGroup が崩れるため、反映を保留する
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
    // 横一列レイアウトではスクロールは不要（複数行にならず、横方向は grid の
    // トラック幅で吸収する設計）。auto のままだと、FLIP の transform アニメーション中に
    // 一時的な描画範囲がコンテナの overflow 判定に含まれ、スワップ中だけ
    // スクロールバーが出ることがある（オーナー実機確認で発見。縦横とも発生したため
    // 両軸を hidden にする。詳細は group-drag-swap-fix.md）
    overflow: hidden;
  }
  // グループ wrapper は横並びにし、内側のボタンでトラック幅（ゴースト表示時は押下時矩形の幅）
  // を均等に分ける。.tasks の外側にあるゴースト要素にも適用されるよう .bottom 直下に置く
  // （group-drag-swap-fix.md: グループの表示幅を当たり判定の矩形と一致させるための構造）
  .task-group {
    display: flex;
    flex-direction: row;
    min-width: 0;
    .task {
      flex: 1;
      min-width: 0;
    }
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
    // 縦レイアウトはタスク数が多いと画面高を超えうるため縦スクロールが必要
    // （bottom と異なり、こちらは元々の overflow-y: auto の用途）
    overflow-y: auto;
    .task {
      justify-content: start;
    }
  }
  // 縦レイアウトではグループ内ウィンドウも縦に積む（外側の並びと同じ向き）。
  // ゴースト要素（.tasks の外側）にも適用されるよう .left/.right 直下に置く
  .task-group {
    display: flex;
    flex-direction: column;
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
// duration は入れ替えクールダウン（REORDER_COOLDOWN_MS = 800ms）以内に完走させる。
// これより長いと連続で避けるときに完走前へ次の入れ替えが割り込み、等速で流れて見える
// （オーナー実機確認で 150ms→220ms でも「まだ早い」との指摘があり 800ms に調整）
.flip-list-move {
  transition: transform 0.8s cubic-bezier(0.2, 0, 0, 1);
}

// グループ内部（同一アプリの複数ウィンドウ）の増減時の FLIP。外側の .flip-list-move と
// 同名にすると CSS クラスが衝突するため name="flip-list-inner" に分離している
.flip-list-inner-move {
  transition: transform 0.8s cubic-bezier(0.2, 0, 0, 1);
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
