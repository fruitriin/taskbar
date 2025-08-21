import { createApp } from 'vue'
import App from './src/Option.vue'
import { routes } from 'vue-router/auto/routes'
import { createRouter, createMemoryHistory } from 'vue-router'
const router = createRouter({
  history: createMemoryHistory(),
  routes
})
createApp(App).use(router).mount('#app')
