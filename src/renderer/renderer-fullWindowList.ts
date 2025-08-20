import { createApp } from 'vue'
import App from './src/FullWindowList.vue'
import { routes } from 'vue-router/auto/routes'
import { createRouter } from 'vue-router/auto'
import { createMemoryHistory } from 'vue-router'
const router = createRouter({
  history: createMemoryHistory(),
  //@ts-ignore
  routes
})
//@ts-ignore
createApp(App).use(router).mount('#app')