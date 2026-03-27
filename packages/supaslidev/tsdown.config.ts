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
    dts: false,
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
    deps: {
      inline: ['create-supaslidev'],
    },
    outputOptions: {
      banner: '#!/usr/bin/env node\n',
    },
    outExtensions: () => ({ js: '.js' }),
  },
]);
