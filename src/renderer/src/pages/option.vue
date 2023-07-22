<template>
  <h1>Taskbar.fm 設定</h1>
  <div class="field is-horizontal">
    <div class="field-label is-normal">
      <label class="label">表示位置</label>
    </div>
    <div class="field-body">
      <div class="select">
        <select v-model="options.layout">
          <option value="left">left</option>
          <option value="bottom">bottom</option>
          <option value="right">right</option>
        </select>
      </div>
    </div>
  </div>
  <div class="field is-horizontal">
    <div class="field-label is-normal">
      <label class="label">並び順</label>
    </div>
    <div class="field-body">
      <div class="select">
        <select v-model="options.windowSortByPositionInApp">
          <option :value="false">起動順</option>
          <option :value="true">座標順</option>
        </select>
      </div>
    </div>
  </div>
  <div class="field is-horizontal">
    <div class="field-label">
      <label class="label">フィルター </label>
    </div>
    <div class="field-body">
      <div>
        <div class="" v-for="(filterElements, i) in filters" :key="i" style="display: flex">
          <div class="" v-for="(filter, k) in filterElements" :key="k">
            {{ filter.property }} - {{ filter.is }}
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="field is-horizontal">
    <div class="field-label">
      <label class="label">設定の初期化</label>
    </div>
    <div class="field-body">
      <button class="button is-danger">初期化</button>
    </div>
  </div>
</template>

<script lang="ts">
import { Electron } from '../utils'

type LayoutType = 'right' | 'left' | 'bottom'
export default {
  data() {
    return {
      options: {
        layout: window.store.options.layout,
        windowSortByPositionInApp: window.store.options.windowSortByPositionInApp
      },
      filters: window.store.filters
    }
  },
  methods: {
    clearSetting() {
      Electron.send('clearSetting')
    }
  },
  watch: {
    options: {
      deep: true,
      handler(value) {
        Electron.send('setOptions', value)
      }
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
@import "bulma/sass/elements/_all"
</style>
