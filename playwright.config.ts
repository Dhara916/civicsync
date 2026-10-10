import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, reporter: [['list'], ['html', {open:'never'}]],
  use: {baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure'},
  projects: [{name:'chromium', use: {...devices['Desktop Chrome']}}],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1', url:'http://127.0.0.1:5173',
    reuseExistingServer: false, timeout: 120_000,
    env: {VITE_SUPABASE_URL:'', VITE_SUPABASE_PUBLISHABLE_KEY:'', VITE_SUPABASE_ANON_KEY:''},
  },
});
