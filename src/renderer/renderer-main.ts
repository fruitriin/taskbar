import { createApp } from 'vue'
import App from './src/App.vue'
import { routes } from 'vue-router/auto/routes'

import { createRouter, createWebHistory } from 'vue-router/auto'
const router = createRouter({
  history: createWebHistory('#'),
  routes
})
console.log(routes)

createApp(App).use(router).mount('#app')
