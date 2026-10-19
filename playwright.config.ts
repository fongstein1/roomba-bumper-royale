import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 240000, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173', screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] } },
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run preview -- --host 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
