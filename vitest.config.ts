import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['tests/close-grants.test.ts'],
    environment: 'node',
    hookTimeout: 10000,
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
