import { createApp } from 'vue'
import App from './src/App.vue'
// @ts-ignored
import { routes } from 'vue-router/auto/routes'

// @ts-ignore
import { createRouter } from 'vue-router/auto'
import { createMemoryHistory } from 'vue-router'
const router = createRouter({
  history: createMemoryHistory(),
  routes
})

createApp(App).use(router).mount('#app')
