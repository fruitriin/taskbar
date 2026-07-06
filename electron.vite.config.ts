import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      sourcemap: true,
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
      sourcemap: true,
      watch: {},
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload.ts')
        }
      }
    }
  },
  renderer: {
    server: {
      port: 10234
    },
    build: {
      sourcemap: true,
      watch: {},
      rollupOptions: {
        input: {
          // 単一エントリー。ビューは ?view= パラメータで切り替える（App.vue 参照）
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [UnoCSS(), vue()]
  }
})
