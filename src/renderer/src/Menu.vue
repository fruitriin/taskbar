<script setup lang="ts">
import Menu from './pages/menu.vue'
</script>

<template>
  <Menu />
</template>

<style>
/* Bulmaを削除してシンプルに */
* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  overflow: hidden !important;
}
</style>
