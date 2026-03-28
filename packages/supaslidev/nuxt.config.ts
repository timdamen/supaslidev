import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const dir = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));

// When running via `supaslidev dev`, the Nuxt CWD is the package root inside
// node_modules. Place the build cache in the user's project root instead so
// it persists correctly across restarts and doesn't pollute node_modules.
const projectRoot = process.env.SUPASLIDEV_PROJECT_ROOT || process.cwd();

export default defineNuxtConfig({
  buildDir: join(projectRoot, '.nuxt'),

  // SPA mode: the dashboard is a local dev tool that doesn't need SSR.
  // With SSR, Vue hydration timing causes e2e tests to interact with
  // server-rendered elements before they become interactive.
  ssr: false,

  modules: ['@nuxt/ui', join(dir, 'src/module.ts')],

  css: [join(dir, 'app/assets/css/main.css')],

  devtools: { enabled: false },

  // Disable external font providers — the dashboard is a local dev tool
  // and should work offline without fetching from remote font services
  fonts: {
    defaults: {
      weights: [400, 500, 600, 700],
    },
    providers: {
      bunny: false,
      fontshare: false,
      fontsource: false,
      google: false,
      googleicons: false,
    },
  },

  runtimeConfig: {
    supaslidev: {
      projectRoot: '',
      presentationsDir: '',
    },
    public: {
      supaslidevVersion: pkg.version,
      deployMode: false,
    },
  },

  compatibilityDate: '2025-05-01',
});
