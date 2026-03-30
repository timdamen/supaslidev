import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isCI = !!process.env.CI;

export default defineConfig({
  test: {
    root: __dirname,
    globals: true,
    testTimeout: 120000,
    hookTimeout: 180000,
    globalSetup: './setup/global-setup.ts',
    include: ['**/*.e2e.test.ts'],
    fileParallelism: isCI ? false : true,
    maxWorkers: isCI ? 1 : 10,
    retry: 1,
  },
});
