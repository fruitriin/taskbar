<script lang="ts">
import { defineComponent } from 'vue'
import { Electron } from './utils'

export default defineComponent({
  data() {
    return {
      hasError: false
    }
  },
  computed: {
    Electron() {
      return Electron
    }
  },
  errorCaptured(e) {
    this.hasError = e

    return false
  }
})
</script>

<template>
  <div v-if="hasError">
    <button class="is-primary button" @click="Electron.send('clearSetting')">設定を消す</button>
    Err: {{ hasError }}
  </div>
  <router-view v-else />
</template>

<style lang="sass">
/*! bulma.io v0.9.4 | MIT License | github.com/jgthms/bulma */
@import 'bulma/css/bulma.css'
</style>
