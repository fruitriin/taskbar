<template>
  <div :class="layout">
    <div class="icon" @click="openOption">
      <img :src="icon" style="height: 40px" />
    </div>
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
  <div>
    <hr />

    <h2 class="block">見えているもの</h2>
    <Debug v-if="debug" :windows="filteredWindows" />
    <hr />
    <h2 class="block">隠しているもの</h2>
    <Debug v-if="debug" :windows="invertWindows" />
  </div>
</template>

<script lang="ts">
import icon from '../assets/icon.png'
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
      icon,
      windows: null as MacWindow[] | null,
      debug: true,
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
          if (!win.kCGWindowIsOnscreen) return false
          if (win.kCGWindowBounds?.Height < 40) return false
          if (win.kCGWindowBounds?.Width < 40) return false
          if (win.kCGWindowOwnerName === 'Dock') return false
          if (win.kCGWindowOwnerName === 'DockHelper') return false
          if (win.kCGWindowOwnerName === 'screencapture') return false
          if (win.kCGWindowOwnerName === 'スクリーンショット') return false
          if (win.kCGWindowName == 'Notification Center') return false
          if (win.kCGWindowName === 'Item-0') return false
          if (win.kCGWindowOwnerName === 'Window Server') return false
          if (win.kCGWindowOwnerName === 'コントロールセンター') return false
          if (win.kCGWindowOwnerName === 'Notification Center') return false
          if (win.kCGWindowOwnerName === 'Finder' && win.kCGWindowName === '') return false
          if (win.kCGWindowName === 'Spotlight') return false
          if (win.kCGWindowOwnerName === 'GoogleJapaneseInputRenderer') return false
          if (win.kCGWindowOwnerName === 'taskbar.fm') return false
          if (win.kCGWindowName === 'taskbar.fm') return false
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
    openOption() {
      Electron.send('openOption')
    },
    async acticveWindow(win: Window) {
      Electron.send('activeWindow', JSON.parse(JSON.stringify(win)))
    }
  }
})
</script>

<style lang="scss" scoped>
.icon {
  display: flex;
  margin: 0 8px;
  align-items: center;
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
