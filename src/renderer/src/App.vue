<script setup lang="ts">
import Versions from './components/Versions.vue'
</script>

<template>
  <div  style="display: flex;">
    <button class="ui button task" @click="acticveWindow( win)" v-for="win in filteredWindows" :key="win.kCGWindowOwnerPID + win.kCGWindowNumber">
      <div v-if="win.kCGWindowName" >{{win.kCGWindowName}}</div>
      <div v-if="win.kCGWindowName"> - </div>
      <div>{{win.kCGWindowOwnerName}}</div>
    </button>
  </div>
  <table>
    <tr>
      <th>WindowOwner</th>
      <th>OwnerPID</th>
      <th>WindowNumber</th>
      <th>WindowLayer</th>
      <th>WindowName</th>
      <th> WindowOnScreen</th>
    </tr>
    <tr v-for="win in filteredWindows" @click="acticveWindow( win)">
      <td >{{win.kCGWindowOwnerName}}</td>
      <td>{{win.kCGWindowOwnerPID}}</td>
      <td>{{win.kCGWindowNumber}}</td>
      <td>{{ win.kCGWindowLayer }}</td>
      <td>{{win.kCGWindowName}}</td>
      <td>{{win.kCGWindowIsOnscreen}}</td>

    </tr>
  </table>
  <Versions></Versions>
</template>


<script lang="ts">
import { Window } from "../../type";
declare global {
  interface Window {
    electronAPI: any;
  }
}

export default {
  data(){
    return {
      windows: null as Window[] | null
    }
  },
  mounted() {
    window.electronAPI.process((event, value) => {
      console.log(value)
      this.windows = JSON.parse(value)
    })
  },
  methods: {
    acticveWindow(win: Window){
      window.electronAPI.sendActiveWindow({...win})
    }
  },
  computed: {
    filteredWindows(){
      return this.windows?.filter(win => {
        if(win.kCGWindowName === "Item-0") return false
        if(win.kCGWindowOwnerName === "Window Server") return false
        if(win.kCGWindowOwnerName === "コントロールセンター") return false
        if(win.kCGWindowName === "Spotlight") return false
        if(win.kCGWindowOwnerName === "GoogleJapaneseInputRenderer") return false
        return  true
      }).sort((win1, win2) => {
        return win1.kCGWindowOwnerPID - win2.kCGWindowOwnerPID
      })
    }
  }
}
</script>

<style lang="sass">
@import "bulma/bulma"

</style>
