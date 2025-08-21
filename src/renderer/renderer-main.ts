import { createApp } from 'vue'
import App from './src/App.vue'
import { routes } from 'vue-router/auto/routes'
import { createRouter, createMemoryHistory } from 'vue-router'
const router = createRouter({
  history: createMemoryHistory(),
  routes: routes
})
createApp(App).use(router).mount('#app')
