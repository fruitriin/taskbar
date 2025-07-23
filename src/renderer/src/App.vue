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
@import "bulma/sass/utilities/_all"
//@import "bulma/sass/base/_all"
//@import "bulma/sass/elements/_all"
@import "bulma/sass/form/_all"
@import "bulma/sass/components/_all"
//@import "bulma/sass/grid/_all"
//@import "bulma/sass/helpers/_all"
//@import "bulma/sass/layout/_all"
</style>
