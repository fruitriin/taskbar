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
    <div
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
        draggable="true"
        @click="acticveWindow(win)"
        @click.right.prevent="test(win)"
        @dragstart="onDragStart($event, win)"
        @dragover.prevent
        @drop="onDropOnApp($event, win)"
        @dragend="onDragEnd"
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
import { Electron, buildAppOrder, groupWindowsByApp, moveApp } from '../utils'
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
      // ドラッグ中のアプリ名
      dragApp: null as string | null,
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
        appOrder: this.options?.appOrder ?? [],
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
      this.trackAppearance(value)
      if (this.windows == null) {
        this.windows = value
        return
      }
      this.windows.splice(0, this.windows.length, ...value)
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
    onDragStart(event: DragEvent, win: MacWindow): void {
      this.dragApp = win.kCGWindowOwnerName
      // 別ディスプレイのタスクバーへのドロップでも動くよう dataTransfer にも載せる
      event.dataTransfer?.setData('application/x-taskbar-app', win.kCGWindowOwnerName)
    },
    onDragEnd(): void {
      this.dragApp = null
    },
    // ドロップ先アプリの位置にドラッグ元アプリのグループを移動し、appOrder として永続化する
    onDropOnApp(event: DragEvent, win: MacWindow): void {
      const target = win.kCGWindowOwnerName
      const dragged = event.dataTransfer?.getData('application/x-taskbar-app') || this.dragApp
      this.dragApp = null
      if (!dragged || dragged === target) return

      // 既存 appOrder の並びを温存しつつ表示中アプリを補完してから移動する
      const baseOrder = buildAppOrder(this.options?.appOrder ?? [], this.centerWindows)
      Electron.send('setOptions', {
        ...this.options,
        appOrder: moveApp(baseOrder, dragged, target)
      })
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
