import { createApp } from 'vue'
import App from './src/App.vue'
// @ts-ignored
import { routes } from 'vue-router/auto/routes'

// @ts-ignore
import { createRouter, createWebHistory } from 'vue-router/auto'
const router = createRouter({
  history: createWebHistory('#'),
  routes
})

createApp(App).use(router).mount('#app')
