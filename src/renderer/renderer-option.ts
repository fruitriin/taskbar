import { createApp } from 'vue'
import App from './src/Option.vue'
import { routes } from 'vue-router/auto/routes'
import { createRouter, createMemoryHistory } from 'vue-router'
import { injectElectronMocks } from './src/mocks/electron-mocks'

// ブラウザで開いた場合（Electron APIが存在しない場合）にモックを注入
if (import.meta.env.DEV) {
  injectElectronMocks()
}

const router = createRouter({
  history: createMemoryHistory(),
  routes
})
// @ts-ignore - Router plugin compatibility
createApp(App).use(router).mount('#app')
