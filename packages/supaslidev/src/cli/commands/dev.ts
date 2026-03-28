import { spawn, ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findProjectRoot } from '../utils.js';

export function findSupaslidevPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));

  while (dir !== dirname(dir)) {
    const packageJsonPath = join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (pkg.name === 'supaslidev') {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = dirname(dir);
  }

  throw new Error('Could not find supaslidev package root');
}

export async function dev(): Promise<void> {
  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    console.error('Error: Could not find a Supaslidev project.');
    console.error('Make sure you are in a directory with a "presentations" folder.');
    process.exit(1);
  }

  const presentationsDir = join(projectRoot, 'presentations');

  if (!existsSync(presentationsDir)) {
    console.error(`Error: No "presentations" folder found at ${presentationsDir}`);
    process.exit(1);
  }

  console.log(`Starting Supaslidev for project: ${projectRoot}`);
  console.log(`Presentations directory: ${presentationsDir}`);

  process.env.SUPASLIDEV_PROJECT_ROOT = projectRoot;
  process.env.SUPASLIDEV_PRESENTATIONS_DIR = presentationsDir;

  // Run Nuxt from the supaslidev package root so its nuxt.config.ts,
  // app/, server/, and public/ directories are used directly — this avoids
  // the Nuxt layer `extends` mechanism which can trigger Vite module
  // resolution conflicts when the package is installed from a tarball.
  const supaslidevRoot = findSupaslidevPackageRoot();

  // Find the nuxt binary — prefer the project's node_modules, then
  // the supaslidev package's own node_modules, then fall back to npx.
  const projectNuxtBin = join(projectRoot, 'node_modules', '.bin', 'nuxt');
  const packageNuxtBin = join(supaslidevRoot, 'node_modules', '.bin', 'nuxt');

  let command: string;
  let args: string[];

  if (existsSync(projectNuxtBin)) {
    command = projectNuxtBin;
    args = ['dev'];
  } else if (existsSync(packageNuxtBin)) {
    command = packageNuxtBin;
    args = ['dev'];
  } else {
    command = 'npx';
    args = ['nuxt', 'dev'];
  }

  // Build a clean env for nuxt dev: always run in development mode
  // and strip test runner env vars (VITEST, etc.) that cause Nuxt to
  // skip the dev server startup.
  const nuxtEnv: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
  for (const key of Object.keys(nuxtEnv)) {
    if (key === 'VITEST' || key.startsWith('VITEST_') || key === 'TEST') {
      delete nuxtEnv[key];
    }
  }

  const nuxt = spawn(command, args, {
    cwd: supaslidevRoot,
    stdio: 'inherit',
    env: nuxtEnv,
    shell: process.platform === 'win32',
    detached: false,
  });

  const processes: ChildProcess[] = [nuxt];

  nuxt.on('error', (err) => {
    console.error(`Failed to start Nuxt: ${err.message}`);
    process.exit(1);
  });

  nuxt.on('close', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });

  const cleanup = () => {
    for (const proc of processes) {
      proc.kill('SIGTERM');
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
