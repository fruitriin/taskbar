<script setup lang="ts">
import { defineAsyncComponent, onErrorCaptured, ref } from 'vue'
import { Electron } from './utils'
import { resolveViewName } from './view-router'
import type { ViewName } from './view-router'
import type { Component } from 'vue'

// ?view= でビューを切り替える単一エントリーのホスト（リアーキ Phase 1 スライス 1-B）。
// 各ビューは動的 import なので、そのウィンドウに必要なモジュールとスタイルだけが
// 読み込まれる。menu は bulma 非依存（独自リセット）のため、この分離が見た目の維持に必要
const views: Record<ViewName, Component> = {
  taskbar: defineAsyncComponent(() => import('./pages/index.vue')),
  option: defineAsyncComponent(() => import('./pages/option.vue')),
  menu: defineAsyncComponent(() => import('./pages/menu.vue')),
  fullWindowList: defineAsyncComponent(() => import('./pages/fullWindowList.vue'))
}

const viewComponent = views[resolveViewName(window.location.search)]

const hasError = ref<unknown>(false)
onErrorCaptured((error) => {
  hasError.value = error
  return false
})
</script>

<template>
  <div v-if="hasError" class="app-error">
    <button class="app-error-button" @click="Electron.send('clearSetting')">設定を消す</button>
    Err: {{ hasError }}
  </div>
  <component :is="viewComponent" v-else />
</template>

<style scoped>
/* エラー表示は全ビュー共通のフォールバック。menu ビューは bulma を読み込まないため、
   フレームワーク非依存の最小スタイルで自立させる */
.app-error {
  padding: 1rem;
  color: #fff;
}
.app-error-button {
  padding: 0.5rem 1rem;
  margin-right: 0.5rem;
  border: 1px solid #fff;
  border-radius: 4px;
  background: #3273dc;
  color: #fff;
  cursor: pointer;
}
</style>
