<template>
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
    <tr v-for="win in windows">
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
</template>

<script lang="ts">
export default {
  props: {
    windows: {
      type: Object,
      required: true
    }
  }
}
</script>
