import { defineConfig, devices } from "@playwright/test";

/**
 * Projetos:
 *  - fixture: app com o arranjo de teste (e2e/fixtures) — rápido e estável; a maior parte dos testes
 *  - mobile:  mesmos dados, tela de celular
 *  - real:    fumaça com os arranjos publicados de verdade (public/arranjos)
 *  - shots:   só com SHOTS=1 — salva capturas de todas as telas em test-results/shots para revisão visual
 */
const CI = !!process.env.CI;
const FIXTURE = "http://localhost:5179";
const REAL = "http://localhost:5178";
const use = {
  // local: Chrome do sistema; CI: Chromium do Playwright
  ...(CI ? {} : { channel: "chrome" as const }),
  launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  trace: "retain-on-failure" as const,
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  webServer: [
    {
      command: "npx vite --mode e2e --port 5179 --strictPort",
      url: FIXTURE,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    { command: "npx vite --port 5178 --strictPort", url: REAL, reuseExistingServer: !CI, timeout: 60_000 },
  ],
  projects: [
    {
      name: "fixture",
      testMatch: /(home|arrangement|part|calendar|smells|print|games|menu|quarteto|studies)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], ...use, baseURL: FIXTURE },
    },
    {
      name: "mobile",
      testMatch: /(mobile|games|studies)\.spec\.ts/,
      use: { ...devices["Pixel 7"], ...use, baseURL: FIXTURE },
    },
    {
      name: "real",
      testMatch: /real\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], ...use, baseURL: REAL },
    },
    ...(process.env.SHOTS
      ? [
          {
            name: "shots",
            testMatch: /shots\.spec\.ts/,
            use: { ...devices["Desktop Chrome"], ...use, baseURL: REAL },
          },
        ]
      : []),
  ],
});
