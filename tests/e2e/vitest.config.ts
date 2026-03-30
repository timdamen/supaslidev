import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isCI = !!process.env.CI;

export default defineConfig({
  test: {
    root: __dirname,
    globals: true,
    testTimeout: isCI ? 120000 : 60000,
    hookTimeout: isCI ? 180000 : 90000,
    globalSetup: './setup/global-setup.ts',
    include: ['**/*.e2e.test.ts'],
    fileParallelism: !isCI,
    maxWorkers: isCI ? 1 : 10,
    teardownTimeout: isCI ? 10000 : 1000,
  },
});
