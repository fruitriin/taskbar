<script setup lang="ts">
import Versions from './components/Versions.vue'
</script>

<template>
  <div :class="layout">
    <div class="permissions">
      <button v-if="!granted" @click="grant" class="button">タイトルを取得</button>
    </div>
    <div  class="tasks">
      <button
        class="button task"
        @click="acticveWindow(win)"
        v-for="win in filteredWindows"
        :key="win.kCGWindowOwnerPID + win.kCGWindowNumber"
      >
        <img class="icon" :src="win.appIcon" />
        <div v-if="win.kCGWindowName" class="name">{{ win.kCGWindowName }}</div>
        <div v-else class="name">{{ win.kCGWindowOwnerName }}</div>
      </button>
    </div>
    <div class="submenu">
      <div class="select">
        <select v-model="layout">
          <option value="left">left</option>
          <option value="bottom">bottom</option>
          <option value="right">right</option>
        </select>
      </div>


    </div>
  </div>

  <hr />
  <Debug v-if="debug" :windows="filteredWindows" />
  <Debug v-if="debug" :windows="invertWindows" />
  <Versions v-if="debug"></Versions>
  <div class="debug-control-container" v-if="debug">
    <label class="checkbox"
    ><input
      type="checkbox"
      v-model="filters"
      value="isNotOnScreen"
    />画面に表示してないもの</label
    >
    <label class="checkbox"
    ><input
      type="checkbox"
      v-model="filters"
      value="hiddenByTaskbar"
    />taskbarに隠れてしまうもの</label
    >
    <label class="checkbox"
    ><input type="checkbox" v-model="filters" value="utilities" />Utility 系その他</label
    >
    <label class="checkbox"
    ><input type="checkbox" v-model="filters" value="taskbar" />taskbar</label
    >
  </div>


</template>

<script lang="ts">
import { Electron } from './utils'

import { MacWindow } from '../../type'
import { defineComponent } from 'vue'
import Debug from './components/Debug.vue'
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
      layout: "bottom" as LayoutType,
      granted: window.store.granted,
    }
  },
  watch:{
    layout(value){
      Electron.send("setLayout", value)
    }
  },
  mounted() {
    this.layout = window.store.layout
    Electron.listen('process', (event, value) => {
      // 雰囲気はこう 今は setLayoutしたら再起動が必要
      this.windows = JSON.parse(value)
    })
  },
  methods: {
    grant(){
      Electron.send("grantPermission")
      this.granted = true
    },
    async acticveWindow(win: Window) {
      Electron.send('activeWindow', JSON.parse(JSON.stringify(win)))
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
            win.kCGWindowOwnerName === 'Finder' && win.kCGWindowName === ""
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
  }
})
</script>

<style lang="scss">
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

.left , .right {
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

    .select , .select select{
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

<style lang="scss">
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
  border: solid 2px  hsl(0, 0%, 71%);
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

.select {
  display: inline-block;
  max-width: 100%;
  position: relative;
  vertical-align: top;
  height: 2.5em;
  color: black;

  select {
    align-items: center;
    box-shadow: none;
    height: 2.5em;
    justify-content: flex-start;
    line-height: 1.5;
    position: relative;
    vertical-align: top;

    padding: calc(0.75em - 1px) calc(0.5em - 1px) 2.5em calc(0.5em - 1px);
    cursor: pointer;
    display: block;
    font-size: 1em;
    max-width: 100%;
    outline: none;
    background-color: hsl(0, 0%, 100%);
    border-color: hsl(0, 0%, 86%);
    border-radius: 4px;

  }
}
</style>

<style lang="sass">
/*! bulma.io v0.9.4 | MIT License | github.com/jgthms/bulma */
@import "bulma/sass/utilities/_all"
//@import "bulma/sass/base/_all"
//@import "bulma/sass/elements/_all"
@import "bulma/sass/form/_all"
@import "bulma/sass/components/_all"
//@import "bulma/sass/grid/_all"
//@import "bulma/sass/helpers/_all"
//@import "bulma/sass/layout/_all"

</style>
