import { defineConfig } from '@playwright/test'

const port = Number(process.env.BERRYMARK_STUDIO_TEST_PORT || 4174)
const origin = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './test-browser',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: {
      executablePath: process.env.BERRYMARK_CHROMIUM_PATH || undefined
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `node src/studio/studio-cli.js --port ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
})
