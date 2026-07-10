// Tauri 用のフロントエンド dev/build 設定（リアーキ Phase 3）。
// electron-vite（electron.vite.config.ts）は移行完了（3.5）まで併存し、その後削除する。
import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  root: 'src/renderer',
  plugins: [UnoCSS(), vue()],
  server: {
    port: 10234,
    strictPort: true
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
})
