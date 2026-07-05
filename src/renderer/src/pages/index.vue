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

<script lang="ts">
import icon from '../assets/icon.png'
import { markRaw } from 'vue'
import { Electron, buildAppOrder, groupWindowsByApp } from '../utils'
import { createDragSession } from '../drag-session'
import type { DragSession } from '../drag-session'
import { defineComponent } from 'vue'
import Debug from '../components/Debug.vue'
import MainPermissionStatus from '../components/MainPermissionStatus.vue'
import { createNewSortInstance } from 'fast-sort'

export default defineComponent({
  components: {
    Debug,

    MainPermissionStatus
  },

  data() {
    return {
      icon,
      windows: [] as MacWindow[] | null,
      // セッション内でタスクバーに出現したアプリの順序（appOrder 未指定アプリのフォールバック）
      appearanceOrder: [] as string[],
      // --- Pointer Events ドラッグセッション ---
      // 状態機械の本体（drag-session.ts）。Vue のリアクティブ化は不要なので markRaw で保持
      session: null as DragSession | null,
      // 押下したボタンのウィンドウ（ゴーストの表示内容に使用。矩形は session が保持）
      pressedWindow: null as MacWindow | null,
      // ドラッグ中のアプリ名（drag-source の減光に使用）
      dragApp: null as string | null,
      // ドラッグ中のみ使う一時的なアプリ順。centerWindows がこれを優先する
      dragOrder: null as string[] | null,
      // ドラッグ直後の click 合成を1回だけ握りつぶす
      didDrag: false,
      // ゴースト表示
      ghostWindow: null as MacWindow | null,
      ghostStyle: {} as Record<string, string>,
      ghostTransform: '',
      // ドラッグ中に届いた process 更新の保留分（dragend で反映）
      pendingWindows: null as MacWindow[] | null,
      debug: true,
      options: window.store.options,
      granted: window.store.granted,
      headers: window.store.options?.headers,
      footers: window.store.options?.footers,
      displayInfo: {} as {
        workArea: {
          x: number
          y: number
          width: number
          height: number
        }
      }
    }
  },
  computed: {
    headerWindows() {
      const headers = this.visibleWindows.filter((w: MacWindow) => {
        if (this.options?.headers.includes(w.kCGWindowOwnerName)) {
          return true
        }
        return false
      })

      return this.sort(headers, 'headers')
    },
    footerWindows(): MacWindow[] {
      const footers = this.visibleWindows.filter((w: MacWindow) => {
        if (this.options?.footers.includes(w.kCGWindowOwnerName)) {
          return true
        }
        return false
      })
      this.sort(footers, 'footers')
      return footers
    },
    centerWindows(): MacWindow[] {
      const centers = this.visibleWindows.filter((w: MacWindow) => {
        if (
          !this.options?.headers.includes(w.kCGWindowOwnerName) &&
          !this.options?.footers.includes(w.kCGWindowOwnerName)
        ) {
          return true
        }
        return false
      })
      return groupWindowsByApp(centers, {
        sortByPosition: this.options?.windowSortByPositionInApp ?? false,
        layout: this.options?.layout ?? 'bottom',
        // ドラッグ中はセッション内の一時順序が最優先（確定は pointerup 時の setOptions）
        appOrder: this.dragOrder ?? this.options?.appOrder ?? [],
        appearanceOrder: this.appearanceOrder
      })
    },
    // ディスプレイの中にウィンドウだけに絞り込む
    visibleWindows(): MacWindow[] {
      if (this.windows === null) return []
      const displayConrner = {
        left: this.displayInfo.workArea?.x,
        right: this.displayInfo.workArea?.x + this.displayInfo.workArea?.width,
        top: this.displayInfo.workArea?.y,
        bottom: this.displayInfo?.workArea?.y + this.displayInfo.workArea?.height
      }
      return [...this.windows].filter((win) => {
        if (displayConrner.left > win.kCGWindowBounds.X + win.kCGWindowBounds.Width) return false
        if (win.kCGWindowBounds.X > displayConrner.right) return false

        if (displayConrner.top > win.kCGWindowBounds.Y + win.kCGWindowBounds.Height) return false
        if (win.kCGWindowBounds.Y > displayConrner.bottom) return false

        return true
      })
    }
  },

  mounted() {
    Electron.listen('updateOptions', (_event, value) => {
      console.log('[taskbar]updated:', value)
      this.options = value
    })
    Electron.listen('process', (_event, value: MacWindow[]) => {
      // ポインタ押下中（閾値未満のプレドラッグ含む）は並びの土台が動くと
      // 入れ替え判定や pressedWindow が崩れるため、反映を保留する
      if (this.session?.isActive) {
        this.pendingWindows = value
        return
      }
      this.applyWindows(value)
    })

    // アイコン更新イベントをリスン
    Electron.listen('iconUpdate', (_event, icons: Record<string, string>) => {
      this.updateWindowIcons(icons)
    })

    Electron.send('windowReady')
    Electron.listen('displayInfo', (_event, value) => {
      this.displayInfo = value
    })
  },
  created() {
    // 状態機械に DOM 依存（hitTest）と副作用（ゴースト・永続化）を注入する
    this.session = markRaw(
      createDragSession({
        getBaseOrder: () => buildAppOrder(this.options?.appOrder ?? [], this.centerWindows),
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
        isHorizontal: () => (this.options?.layout ?? 'bottom') === 'bottom',
        onDragStart: (app, rect) => {
          this.didDrag = true
          this.dragApp = app
          this.ghostWindow = this.pressedWindow
          this.ghostStyle = {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.right - rect.left}px`,
            height: `${rect.bottom - rect.top}px`
          }
        },
        onGhostMove: (dx, dy) => {
          this.ghostTransform = `translate(${dx}px, ${dy}px)`
        },
        onOrderChange: (order) => {
          this.dragOrder = order
        },
        onCommit: (order) => {
          // updateOptions の IPC 往復を待つと一瞬旧並びに戻るため、ローカルにも楽観反映する
          const newOptions = { ...this.options, appOrder: order }
          this.options = newOptions
          Electron.send('setOptions', newOptions)
        },
        onEnd: () => this.cleanupDrag()
      })
    )
  },
  beforeUnmount() {
    // ドラッグ途中でアンマウントされた場合の document リスナーのリーク防止
    this.session?.cancel()
  },
  methods: {
    sort(arr: MacWindow[], area: 'headers' | 'footers'): MacWindow[] {
      const orderRule = {
        Headers: 'desc',
        Footers: 'asc'
      } as const

      const order = orderRule[area]

      const rule = {}
      this.options[area]?.forEach((e, i) => {
        rule[e] = i
      })

      const ruleSorter = createNewSortInstance({
        comparer: (a, b) => (rule[a] || 0) - (rule[b] || 0)
      })

      return ruleSorter(arr).by([
        { asc: (u): string => u.kCGWindowOwnerName },
        order === 'asc'
          ? { asc: (u): number => u.kCGWindowBounds.X }
          : { desc: (u): number => u.kCGWindowBounds.X }
      ])
    },
    test(ev): void {
      Electron.send('contextTask', ev)
      console.log('test')
    },
    applyWindows(value: MacWindow[]): void {
      this.trackAppearance(value)
      if (this.windows == null) {
        this.windows = value
        return
      }
      this.windows.splice(0, this.windows.length, ...value)
    },
    // 新しく出現したアプリを出現順リストの末尾に追加する
    // 同時に複数現れた場合は最小 kCGWindowNumber 昇順で追加し、
    // どのディスプレイのタスクバーでも同じ順序に収束させる
    trackAppearance(windows: MacWindow[]): void {
      const minNumbers = new Map<string, number>()
      for (const win of windows) {
        const app = win.kCGWindowOwnerName
        const current = minNumbers.get(app)
        if (current === undefined || win.kCGWindowNumber < current) {
          minNumbers.set(app, win.kCGWindowNumber)
        }
      }
      const newApps = [...minNumbers.keys()]
        .filter((app) => !this.appearanceOrder.includes(app))
        .sort((a, b) => (minNumbers.get(a) as number) - (minNumbers.get(b) as number))
      this.appearanceOrder.push(...newApps)
    },
    // --- Pointer Events ドラッグ（参考: fruitriin/misskey MkDraggable のエッセンス移植） ---
    onTaskClick(win: MacWindow): void {
      // ドラッグ後に合成される click を1回だけ無視する
      if (this.didDrag) return
      this.acticveWindow(win)
    },
    onTaskPointerDown(event: PointerEvent, win: MacWindow): void {
      const el = event.currentTarget as HTMLElement
      const rect = el.getBoundingClientRect()
      const pressedRect = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
      const accepted = this.session?.pointerDown(
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
      this.pressedWindow = win
      // TransitionGroup の DOM 並び替えで Pointer Capture は暗黙解放されうるため、
      // capture は使わず document でリッスンする
      document.addEventListener('pointermove', this.onPointerMove)
      document.addEventListener('pointerup', this.onPointerUp)
      document.addEventListener('pointercancel', this.onPointerCancel)
      document.addEventListener('visibilitychange', this.onVisibilityChange)
      document.addEventListener('keydown', this.onDragKeyDown)
      window.addEventListener('blur', this.onWindowBlur)
    },
    onPointerMove(event: PointerEvent): void {
      this.session?.pointerMove({
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        buttons: event.buttons
      })
    },
    onPointerUp(event: PointerEvent): void {
      this.session?.pointerUp({
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        buttons: event.buttons
      })
    },
    onPointerCancel(event: PointerEvent): void {
      // 確定せず破棄 → centerWindows が元の並びへ戻り、FLIP が戻りをアニメーション化。
      // 別ポインタ由来の pointercancel で正当なセッションを打ち切らないよう id を渡す
      this.session?.cancel(event.pointerId)
    },
    onVisibilityChange(): void {
      if (document.visibilityState === 'hidden') this.session?.cancel()
    },
    // Esc キーでドラッグをキャンセルする（確定せず元の並びへ戻る）
    onDragKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') this.session?.cancel()
    },
    // 他アプリへのフォーカス移動中に pointerup を取りこぼした場合の保険
    onWindowBlur(): void {
      this.session?.cancel()
    },
    // 状態機械の onEnd から呼ばれる後片付け（確定・キャンセル共通）
    cleanupDrag(): void {
      document.removeEventListener('pointermove', this.onPointerMove)
      document.removeEventListener('pointerup', this.onPointerUp)
      document.removeEventListener('pointercancel', this.onPointerCancel)
      document.removeEventListener('visibilitychange', this.onVisibilityChange)
      document.removeEventListener('keydown', this.onDragKeyDown)
      window.removeEventListener('blur', this.onWindowBlur)
      this.dragApp = null
      this.dragOrder = null
      this.pressedWindow = null
      this.ghostWindow = null
      this.ghostStyle = {}
      this.ghostTransform = ''
      // click はこの pointerup の直後に同期発火するため、次のマクロタスクで解除する
      window.setTimeout(() => {
        this.didDrag = false
      }, 0)
      // ドラッグ中に保留した process 更新を反映する
      if (this.pendingWindows) {
        const pending = this.pendingWindows
        this.pendingWindows = null
        this.applyWindows(pending)
      }
    },
    dumpTaskbarInfo(): void {
      Electron.send('dumpTaskbarInfo')
    },
    grant(): void {
      Electron.send('grantPermission')
      this.granted = true
    },
    openMenu(): void {
      Electron.send('contextLogo')
    },
    openOption(): void {
      Electron.send('openOption')
    },
    async acticveWindow(win: MacWindow) {
      Electron.send('activeWindow', win)
    },
    restartHelper(delay?: number): void {
      Electron.send('restartHelper', delay)
    },

    // アイコン更新処理
    updateWindowIcons(icons: Record<string, string>): void {
      if (!this.windows) return

      console.log(`Updating ${Object.keys(icons).length} icons`)

      // 既存のウィンドウリストのアイコンを更新
      this.windows.forEach((window) => {
        const owner = (window.kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')

        if (icons[owner] && !window.appIcon) {
          window.appIcon = `data:image/png;base64,${icons[owner]}`
          console.log(`Updated icon for ${window.kCGWindowOwnerName}`)
        }
      })

      // リアクティブ更新を強制
      this.$forceUpdate()
    }
  }
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
