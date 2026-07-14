// 単一エントリーポイント（リアーキ Phase 1 スライス 1-B）
// ビューの切り替えは URL の ?view= パラメータで行う（App.vue 参照）
import 'virtual:uno.css'
import { createApp } from 'vue'
import App from './App.vue'
import { injectElectronMocks } from './mocks/electron-mocks'

// ブラウザで開いた場合（Electron APIが存在しない場合）にモックを注入。
// tauri dev も vite の DEV だが、Tauri 実行時に注入するとモックの window.store が
// 実設定を隠してしまう（実機バグ: 設定画面の初期値が保存値を反映しない）ため除外する
if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
  injectElectronMocks()
}

createApp(App).mount('#app')
