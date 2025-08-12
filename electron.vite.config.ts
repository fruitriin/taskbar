import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import VueRouter from 'unplugin-vue-router/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      watch: {},
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/main.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src/main/')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      watch: {},
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload.ts'),
          option: resolve(__dirname, 'src/preload.ts')
        }
      }
    }
  },
  renderer: {
    server: {
      port: 6234
    },
    build: {
      watch: {},
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          option: resolve(__dirname, 'src/renderer/option.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      VueRouter({
        routesFolder: 'src/renderer/src/pages',
        dts: 'src/renderer/typed-router.d.ts'
      }),
      vue()
    ]
  }
})
