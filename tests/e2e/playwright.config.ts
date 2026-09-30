// Browser tests (Playwright). Local only: needs the local stack and the POC's dev server.
//   bun run test:e2e             (headless)
//   bun run test:e2e -- --headed (watch it)
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.e2e\.ts/, // not *.spec.ts: `bun test` would pick those up
  fullyParallel: false,
  workers: 1, // one shared local database
  retries: 0,
  timeout: 90_000, // the dev server compiles pages on first visit
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: './test-results', // traces of failed runs (git-ignored)
  globalTeardown: './teardown.ts',
  use: {
    baseURL: process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || '3002'}`,
    headless: true,
    trace: 'retain-on-failure',
  },
})
