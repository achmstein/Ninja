import { defineConfig, devices } from '@playwright/test';

// The control-plane spec against an AppHost that is already running (dotnet run --project src/Ninja.AppHost).
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/ControlPlane.spec.ts'],
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5177',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
