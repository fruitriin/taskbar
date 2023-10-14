import { createApp } from 'vue'
import App from './src/App.vue'
// @ts-ignored
import { routes } from 'vue-router/auto/routes'

// @ts-ignore
import { createRouter } from 'vue-router/auto'
const router = createRouter({
  routes
})

createApp(App).use(router).mount('#app')
