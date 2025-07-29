import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'out', 'nativeSrc/**/*']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../..'),
      '@/main': resolve(__dirname, '.'),
      '@/type': resolve(__dirname, '../type')
    }
  }
})
