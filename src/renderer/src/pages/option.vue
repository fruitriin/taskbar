<template>
  <h1>Taskbar.fm 設定</h1>
  <div class="field is-horizontal">
    <label class="label">表示位置</label>
    <div class="select">
      <select v-model="layout">
        <option value="left">left</option>
        <option value="bottom">bottom</option>
        <option value="right">right</option>
      </select>
    </div>
  </div>
</template>

<script lang="ts">
import { Electron } from '../utils'

type LayoutType = 'right' | 'left' | 'bottom'
export default {
  data() {
    return {
      layout: 'bottom' as LayoutType
    }
  },
  mounted() {
    this.layout = window.store.layout
  },
  watch: {
    layout(value) {
      Electron.send('setLayout', value)
      this.layout = value
    }
  }
}
</script>

<style lang="scss" scoped>
.label {
  color: white !important;
}
</style>

<style lang="sass" scoped>
/*! bulma.io v0.9.4 | MIT License | github.com/jgthms/bulma */
@import 'bulma/sass/utilities/_all'
@import 'bulma/sass/form/_all'
@import 'bulma/sass/components/_all'
</style>
