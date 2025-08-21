import { createApp } from 'vue'
import App from './src/FullWindowList.vue'
import { routes } from 'vue-router/auto/routes'
import { createMemoryHistory, createRouter } from 'vue-router'
const router = createRouter({
  history: createMemoryHistory(),
  routes
})
// @ts-ignore - Router plugin compatibility
createApp(App).use(router).mount('#app')
