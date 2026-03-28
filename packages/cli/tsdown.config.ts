import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: 'esm',
    dts: true,
    outDir: 'dist',
    clean: true,
    hash: false,
    outExtensions: () => ({ js: '.js' }),
  },
  {
    entry: ['src/cli.ts'],
    format: 'esm',
    dts: true,
    outDir: 'dist',
    hash: false,
    shims: true,
    banner: '#!/usr/bin/env node',
    outExtensions: () => ({ js: '.js' }),
  },
]);
