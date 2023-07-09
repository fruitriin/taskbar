<template>
  <div :class="layout">
    <div class="permissions">
      <button v-if="!granted" class="button" @click="grant">タイトルを取得</button>
    </div>
    <div class="tasks">
      <button
        v-for="win in filteredWindows"
        :key="win.kCGWindowOwnerPID + win.kCGWindowNumber"
        class="button task"
        @click="acticveWindow(win)"
      >
        <img class="icon" :src="win.appIcon" />
        <div v-if="win.kCGWindowName" class="name">{{ win.kCGWindowName }}</div>
        <div v-else class="name">{{ win.kCGWindowOwnerName }}</div>
      </button>
    </div>
  </div>

  <hr />
  <Debug v-if="debug" :windows="filteredWindows" />
  <Debug v-if="debug" :windows="invertWindows" />
  <Versions v-if="debug"></Versions>
  <div v-if="debug" class="debug-control-container">
    <label class="checkbox"
      ><input
        v-model="filters"
        type="checkbox"
        value="isNotOnScreen"
      />画面に表示してないもの</label
    >
    <label class="checkbox"
      ><input
        v-model="filters"
        type="checkbox"
        value="hiddenByTaskbar"
      />taskbarに隠れてしまうもの</label
    >
    <label class="checkbox"
      ><input v-model="filters" type="checkbox" value="utilities" />Utility 系その他</label
    >
    <label class="checkbox"
      ><input v-model="filters" type="checkbox" value="taskbar" />taskbar</label
    >
  </div>
</template>

<script lang="ts">
import { Electron } from '../utils'

import { MacWindow } from '../../../type'
import { defineComponent } from 'vue'
import Debug from '../components/Debug.vue'
type LayoutType = 'right' | 'left' | 'bottom'

export default defineComponent({
  components: {
    Debug
  },
  data() {
    return {
      windows: null as MacWindow[] | null,
      debug: true,
      filters: [],
      layout: 'bottom' as LayoutType,
      granted: window.store.granted
    }
  },
  computed: {
    invertWindows() {
      return this.windows?.filter((win) => {
        return !this.filteredWindows.includes(win)
      })
    },
    filteredWindows() {
      return this.windows
        ?.filter((win) => {
          if (!this.filters.includes('isNotOnScreen') && !win.kCGWindowIsOnscreen) return false
          if (!this.filters.includes('hiddenByTaskbar') && win.kCGWindowBounds?.Height < 40)
            return false
          if (!this.filters.includes('hiddenByTaskbar') && win.kCGWindowBounds?.Width < 40)
            return false
          if (!this.filters.includes('utilities') && win.kCGWindowOwnerName === 'Dock') return false
          if (!this.filters.includes('utilities') && win.kCGWindowOwnerName === 'DockHelper')
            return false
          if (!this.filters.includes('utilities') && win.kCGWindowOwnerName === 'screencapture')
            return false
          if (
            !this.filters.includes('utilities') &&
            win.kCGWindowOwnerName === 'スクリーンショット'
          )
            return false
          if (!this.filters.includes('utilities') && win.kCGWindowName === 'Item-0') return false
          if (!this.filters.includes('utilities') && win.kCGWindowOwnerName === 'Window Server')
            return false
          if (
            !this.filters.includes('utilities') &&
            win.kCGWindowOwnerName === 'コントロールセンター'
          )
            return false
          if (
            !this.filters.includes('utilities') &&
            win.kCGWindowOwnerName === 'Notification Center'
          )
            return false
          if (
            !this.filters.includes('utilities') &&
            win.kCGWindowOwnerName === 'Finder' &&
            win.kCGWindowName === ''
          )
            return false
          if (!this.filters.includes('utilities') && win.kCGWindowName === 'Spotlight') return false
          if (
            !this.filters.includes('utilities') &&
            win.kCGWindowOwnerName === 'GoogleJapaneseInputRenderer'
          )
            return false
          if (!this.filters.includes('taskbar') && win.kCGWindowOwnerName === 'taskbar.fm')
            return false
          if (!this.filters.includes('taskbar') && win.kCGWindowName === 'taskbar.fm') return false
          return true
        })
        .sort((win1, win2) => {
          return win1.kCGWindowOwnerPID - win2.kCGWindowOwnerPID
        })
    }
  },
  watch: {},
  mounted() {
    this.layout = window.store.layout
    Electron.listen('setLayout', (event, value) => {
      this.layout = value
    })
    Electron.listen('process', (event, value) => {
      this.windows = JSON.parse(value)
    })
  },
  methods: {
    grant() {
      Electron.send('grantPermission')
      this.granted = true
    },
    async acticveWindow(win: Window) {
      Electron.send('activeWindow', JSON.parse(JSON.stringify(win)))
    }
  }
})
</script>

<style lang="scss" scoped>
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
  width: 100%;
  max-width: 100%;
  .tasks {
    width: 100%;
    display: flex;
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
  white-space: initial;
  margin: 8px 4px;

  div {
    width: 200px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    word-break: break-all;
    text-align: left;
  }
}
</style>

<style lang="scss" scoped>
.button {
  user-select: none;
  display: flex;
  vertical-align: center;
  align-items: center;
  line-height: 1.5;
  font-size: 1rem;
  height: 2.5em;
  color: #fff;
  cursor: pointer;
  justify-content: center;
  padding: calc(0.5em - 1px) 1em;
  white-space: nowrap;
  background-color: hsl(0, 0%, 21%);
  border: solid 2px hsl(0, 0%, 71%);
  border-radius: 4px;

  .icon:first-child:not(:last-child) {
    margin-left: calc(-0.5em - 1px);
    margin-right: 0.25em;
    height: 1.5em;
    width: 1.5em;
    align-items: center;
    display: inline-flex;
    justify-content: center;
  }
}
</style>
