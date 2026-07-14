<template>
  <table>
    <thead>
      <tr>
        <th>WindowOwner</th>
        <th>OwnerPID</th>
        <th>WindowNumber</th>
        <th>WindowLayer</th>
        <th>WindowName</th>
        <th>WindowOnScreen</th>
        <th>kCGWindowSharingState</th>
        <th>WindowBounds</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="win in windows" :key="win.kCGWindowOwnerName">
        <td>{{ win.kCGWindowOwnerName }}</td>
        <td>{{ win.kCGWindowOwnerPID }}</td>
        <td>{{ win.kCGWindowNumber }}</td>
        <td>{{ win.kCGWindowLayer }}</td>
        <td>{{ win.kCGWindowName }}</td>
        <td>{{ win.kCGWindowIsOnscreen }}</td>
        <td>{{ win.kCGWindowSharingState }}</td>
        <td>{{ win.kCGWindowBounds }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ windows?: MacWindow[] }>(), {
  windows: () => []
})
</script>
