import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  scaffoldProject,
  getBaseProjectPath,
  cleanupTmpDir,
  installDependencies,
  stopAllDashboards,
  closeSharedBrowser,
  getTmpDir,
} from './test-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../../..');
const TARBALL_PATH_FILE = join(getTmpDir(), '.supaslidev-tarball-path');

export function getTarballPathFile(): string {
  return TARBALL_PATH_FILE;
}

function buildAndPack(): string {
  console.log('Building create-supaslidev CLI...');
  execSync('pnpm --filter create-supaslidev build', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  const cliBinary = join(ROOT_DIR, 'packages/cli/dist/cli.js');
  if (!existsSync(cliBinary)) {
    throw new Error('Build failed: packages/cli/dist/cli.js not found');
  }
  console.log('CLI built successfully.');

  console.log('Building supaslidev dashboard package...');
  execSync('pnpm --filter supaslidev build', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  const packDir = join(getTmpDir(), '.packs');
  mkdirSync(packDir, { recursive: true });

  console.log('Packing supaslidev dashboard...');
  execSync(`pnpm --filter supaslidev pack --pack-destination "${packDir}"`, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  const tarball = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
  if (!tarball) {
    throw new Error('pnpm pack did not produce a .tgz file');
  }

  const tarballPath = join(packDir, tarball);
  console.log('Supaslidev packed at:', tarballPath);
  return tarballPath;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  console.log('Cleaning up .tmp directory before tests...');
  cleanupTmpDir();

  mkdirSync(getTmpDir(), { recursive: true });

  const tarballPath = buildAndPack();
  writeFileSync(TARBALL_PATH_FILE, tarballPath, 'utf-8');

  const baseProjectPath = getBaseProjectPath();

  console.log('Scaffolding base project for e2e tests...');
  scaffoldProject('base-project');
  console.log('Base project scaffolded at:', baseProjectPath);

  const nodeModulesPath = join(baseProjectPath, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    console.log('Installing dependencies for base project...');
    installDependencies(baseProjectPath);
    console.log('Dependencies installed.');
  }

  return async () => {
    await stopAllDashboards();
    await closeSharedBrowser();

    const testsFailed = process.exitCode === 1;
    if (!testsFailed) {
      console.log('All tests passed. Cleaning up .tmp directory...');
      cleanupTmpDir();
    } else {
      console.log('Tests failed. Preserving .tmp directory for debugging.');
    }
  };
}
