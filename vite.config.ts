// Tauri 用のフロントエンド dev/build 設定（リアーキ Phase 3）。
// Tauri のフロントエンドビルド（frontendDist: ../dist）兼、ブラウザ開発サーバー（bun run dev:web）。
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
