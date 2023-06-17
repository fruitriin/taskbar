<script setup lang="ts">
import Versions from './components/Versions.vue'
</script>

<template>
  <div class="container has-text-white has-background-dark" style="height: 100%">
    <div :style="buttonContainerStyle" class="">
      <button class="button task is-dark" @click="acticveWindow( win)" v-for="win in filteredWindows" :key="win.kCGWindowOwnerPID + win.kCGWindowNumber">
        <img class="icon" :src="win.appIcon">
        <div v-if="win.kCGWindowName" >{{win.kCGWindowName}}</div>
        <div v-else>{{win.kCGWindowOwnerName}}</div>
      </button>
    </div>
    <hr>
    <div class="debug-control-container" v-if="debug">
      <label class="checkbox"><input type="checkbox" v-model="filters" value="isNotOnScreen" />画面に表示してないもの</label>
      <label class="checkbox"><input type="checkbox" v-model="filters" value="hiddenByTaskbar" />taskbarに隠れてしまうもの</label>
      <label class="checkbox"><input type="checkbox" v-model="filters" value="utilities" />Utility 系その他</label>
      <label class="checkbox"><input type="checkbox" v-model="filters" value="taskbar" />taskbar</label>
    </div>

    <Debug v-if="debug" :windows="filteredWindows" />
    <Debug v-if="debug" :windows="invertWindows" />
    <Versions></Versions>
  </div>

</template>


<script lang="ts">
import { Window } from "../../type";
import { defineComponent } from "vue";
import Debug from "./components/Debug.vue"
declare global {
  interface Window {
    electronAPI: any;
  }
}

export default defineComponent({
  components: {
    Debug
  },
  data(){
    return {
      debug: false,
      windows: null as Window[] | null,
      filters: []
    }
  },
  mounted() {
    window.electronAPI.process((event, value) => {
      this.windows = JSON.parse(value)
    })
  },
  methods: {
    acticveWindow(win: Window){
      console.log("call renderer")

      window.electronAPI.sendActiveWindow(JSON.parse(JSON.stringify(win)))
    }
  },
  computed: {
    buttonContainerStyle(): object {
      return {
        display: "flex",
        // FIXME: it should be controlled by layoutType, like: vertical-layout: column, horizontal-layout: row
        "flex-direction": "column",
      }
    },
    invertWindows(){
      return this.windows?.filter(win =>{
        return !this.filteredWindows.includes(win)
      })
    },
    filteredWindows(){
      return this.windows?.filter(win => {
        if (!this.filters.includes("isNotOnScreen") && !win.kCGWindowIsOnscreen) return false
        if (!this.filters.includes("hiddenByTaskbar") && win.kCGWindowBounds?.Height < 40) return false
        if (!this.filters.includes("hiddenByTaskbar") && win.kCGWindowBounds?.Width < 40) return false
        if (!this.filters.includes("utilities") && win.kCGWindowOwnerName === "Dock") return false
        if (!this.filters.includes("utilities") && win.kCGWindowOwnerName === "DockHelper") return false
        if (!this.filters.includes("utilities") && win.kCGWindowOwnerName === "screencapture") return false
        if (!this.filters.includes("utilities") && win.kCGWindowOwnerName === "スクリーンショット") return false
        if (!this.filters.includes("utilities") && win.kCGWindowName === "Item-0") return false
        if (!this.filters.includes("utilities") && win.kCGWindowOwnerName === "Window Server") return false
        if (!this.filters.includes("utilities") && win.kCGWindowOwnerName === "コントロールセンター") return false
        if (!this.filters.includes("utilities") && win.kCGWindowOwnerName === "Notification Center") return false
        if (!this.filters.includes("utilities") && win.kCGWindowName === "Spotlight") return false
        if (!this.filters.includes("utilities") && win.kCGWindowOwnerName === "GoogleJapaneseInputRenderer") return false
        if (!this.filters.includes("taskbar") && win.kCGWindowOwnerName === "taskbar.fm") return false
        if (!this.filters.includes("taskbar") && win.kCGWindowName === "taskbar.fm") return false
        return  true
      }).sort((win1, win2) => {
        return win1.kCGWindowOwnerPID - win2.kCGWindowOwnerPID
      })
    }
  }
})
</script>

<style lang="scss">
@import "bulma/bulma";

.button.is-dark {
  border: solid 2px;
  border-color: $grey-light !important;
  border-radius: 4px;
}

.checkbox:hover {
  color: white;
}

.task {
  width: 200px;
  white-space: initial;
  margin: 8px 4px;

  div {
    width: 200px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    word-break:break-all;
    text-align: left;
  }
}



</style>

