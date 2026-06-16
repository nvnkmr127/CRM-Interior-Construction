module.exports = {
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -w client',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
}
