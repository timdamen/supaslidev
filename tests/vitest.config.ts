import { defineConfig } from 'vitest/config';
// @ts-expect-error - types not exported from @vitest/browser-playwright
import playwright from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['**/*.browser.test.ts'],
  },
});
