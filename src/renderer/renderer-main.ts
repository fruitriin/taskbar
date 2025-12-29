import { createApp } from 'vue'
import App from './src/App.vue'
import { routes } from 'vue-router/auto/routes'
import { createRouter, createMemoryHistory } from 'vue-router'
import { injectElectronMocks } from './src/mocks/electron-mocks'

// ブラウザで開いた場合（Electron APIが存在しない場合）にモックを注入
if (import.meta.env.DEV) {
  injectElectronMocks()
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: routes
})
// @ts-ignore - Router plugin compatibility
createApp(App).use(router).mount('#app')
