import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/config.ts'],
    format: 'esm',
    dts: true,
    outDir: 'dist',
    clean: true,
    hash: false,
    outExtensions: () => ({ js: '.js' }),
  },
  {
    entry: ['src/module.ts'],
    format: 'esm',
    dts: true,
    outDir: 'dist',
    hash: false,
    deps: {
      neverBundle: ['@nuxt/kit', '@nuxt/schema', 'nuxt'],
    },
    outExtensions: () => ({ js: '.js' }),
  },
  {
    entry: ['src/cli/index.ts'],
    format: 'esm',
    outDir: 'dist/cli',
    hash: false,
    shims: true,
    banner: '#!/usr/bin/env node',
    outExtensions: () => ({ js: '.js' }),
  },
]);
