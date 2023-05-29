<script setup lang="ts">
import Versions from './components/Versions.vue'
</script>

<template>
  <div class="container is-fluid has-text-white has-background-dark" style="height: 100%">

  <div  style="display: flex;" class="">
    <button class="button task is-dark" @click="acticveWindow( win)" v-for="win in filteredWindows" :key="win.kCGWindowOwnerPID + win.kCGWindowNumber">
      <div v-if="win.kCGWindowName" >{{win.kCGWindowName}}</div>
      <div v-if="win.kCGWindowName">&nbsp;-&nbsp;</div>
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
      <th>kCGWindowSharingState</th>
    </tr>
    <tr v-for="win in filteredWindows" @click="acticveWindow( win)">
      <td >{{win.kCGWindowOwnerName}}</td>
      <td>{{win.kCGWindowOwnerPID}}</td>
      <td>{{win.kCGWindowNumber}}</td>
      <td>{{ win.kCGWindowLayer }}</td>
      <td>{{win.kCGWindowName}}</td>
      <td>{{win.kCGWindowIsOnscreen}}</td>
      <td>{{win.kCGWindowSharingState}}</td>

    </tr>
  </table>
  <Versions></Versions>
  </div>

</template>


<script lang="ts">
import { Window } from "../../type";
import { defineComponent } from "vue";
declare global {
  interface Window {
    electronAPI: any;
  }
}

export default defineComponent({
  data(){
    return {
      windows: null as Window[] | null
    }
  },
  mounted() {
    window.electronAPI.process((event, value) => {
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
        if(win.kCGWindowOwnerName === "Notification Center") return false
        if(win.kCGWindowName === "Spotlight") return false
        if(win.kCGWindowOwnerName === "GoogleJapaneseInputRenderer") return false
        if(win.kCGWindowOwnerName === "taskbar") return false
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
.button {
  margin: 8px 3px;
}

.task {
  width: 200px;
  display: inline-flex;
  justify-content: left;
  white-space: initial;



  div {
    width: fit-content;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
    word-break:break-all
  }
}



</style>

