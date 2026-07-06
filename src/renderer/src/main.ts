// 単一エントリーポイント（リアーキ Phase 1 スライス 1-B）
// ビューの切り替えは URL の ?view= パラメータで行う（App.vue 参照）
import 'virtual:uno.css'
import { createApp } from 'vue'
import App from './App.vue'
import { injectElectronMocks } from './mocks/electron-mocks'

// ブラウザで開いた場合（Electron APIが存在しない場合）にモックを注入
if (import.meta.env.DEV) {
  injectElectronMocks()
}

createApp(App).mount('#app')
