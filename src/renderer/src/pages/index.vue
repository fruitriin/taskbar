<template>
  <div :class="options.layout">
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

export default defineComponent({
  components: {
    Debug
  },
  data() {
    return {
      icon,
      windows: [] as MacWindow[] | null,
      debug: true,
      options: window.store.options,
      granted: window.store.granted,
      filters: window.store.filters
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
          if (win.kCGWindowBounds?.Height < 40) return false
          if (win.kCGWindowBounds?.Width < 40) return false

          for (const filter of this.filters) {
            for (const filterElement of filter) {
              if (win[filterElement.property] === undefined) return false
              if (win[filterElement.property] == filterElement.is) return false
            }
          }
          return true
        })
        .sort((win1, win2) => {
          // プロセスID順ソート
          if (win1.kCGWindowOwnerPID !== win2.kCGWindowOwnerPID)
            return win1.kCGWindowOwnerPID - win2.kCGWindowOwnerPID

          // ウィンドウの座標順ソート
          if (this.options.windowSortByPositionInApp)
            return win1.kCGWindowBounds.X - win2.kCGWindowBounds.X

          return 0
        })
    }
  },
  watch: {},
  mounted() {
    Electron.listen('updateOptions', (event, value) => {
      console.log('[taskbar]updated:', value)
      this.options = value
    })
    Electron.listen('process', (event, value) => {
      this.windows.splice(0, this.windows.length, ...JSON.parse(value))
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
      Electron.send('activeWindow', win)
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
.left,
.right {
  .icon {
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
    display: flex;
    flex-wrap: wrap;
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
    max-width: 200px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    word-break: break-all;
    text-align: left;
  }
}
</style>
