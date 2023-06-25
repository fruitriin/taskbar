<script setup lang="ts">
import Versions from './components/Versions.vue'
</script>

<template>
  <div class="container is-fluid has-text-white has-background-dark" style="height: 100%">

  <div  style="display: flex;" class="">
    <button class="button task is-dark" @click="acticveWindow( win)" v-for="win in filteredWindows" :key="win.kCGWindowOwnerPID + win.kCGWindowNumber">
      <img class="icon" :src="win.appIcon">
      <div v-if="win.kCGWindowName" >{{win.kCGWindowName}}</div>
      <div v-else>{{win.kCGWindowOwnerName}}</div>
    </button>
  </div>
  <hr>
  <div class="debug-control-container">
    <label class="checkbox"><input type="checkbox" v-model="filters" value="isNotOnScreen" />画面に表示してないもの</label>
    <label class="checkbox"><input type="checkbox" v-model="filters" value="hiddenByTaskbar" />taskbarに隠れてしまうもの</label>
    <label class="checkbox"><input type="checkbox" v-model="filters" value="utilities" />Utility 系その他</label>
    <label class="checkbox"><input type="checkbox" v-model="filters" value="taskbar" />taskbar</label>
  </div>
  <table>
    <tr>
      <td>WindowOwner</td>
      <td>OwnerPID</td>
      <td>WindowNumber</td>
      <td>WindowLayer</td>
      <td>WindowName</td>
      <td> WindowOnScreen</td>
      <td>kCGWindowSharingState</td>
      <td>WindowBounds</td>
    </tr>
    <tr v-for="win in filteredWindows" @click="acticveWindow( win)">
      <td >{{win.kCGWindowOwnerName}}</td>
      <td>{{win.kCGWindowOwnerPID}}</td>
      <td>{{win.kCGWindowNumber}}</td>
      <td>{{ win.kCGWindowLayer }}</td>
      <td>{{win.kCGWindowName}}</td>
      <td>{{win.kCGWindowIsOnscreen}}</td>
      <td>{{win.kCGWindowSharingState}}</td>
      <td>{{win.kCGWindowBounds}}</td>

    </tr>
  </table>
  <Versions></Versions>
  </div>

</template>


<script lang="ts">
import { ElectronAPI } from '@electron-toolkit/preload'


declare global {
  interface Window {
    electron: ElectronAPI
  }
}
import { MacWindow } from "../../type";
import { defineComponent } from "vue";


export default defineComponent({
  data(){
    return {
      windows: null as MacWindow[] | null,
      filters: []
    }
  },
  mounted() {
    window.electron.ipcRenderer.on('process',(event, value) => {
      this.windows = JSON.parse(value)
    })
  },
  methods: {
    acticveWindow(win: Window){
      console.log("call renderer")

      window.electron.ipcRenderer.send('activeWindow', JSON.parse(JSON.stringify(win)))
    }
  },
  computed: {
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

