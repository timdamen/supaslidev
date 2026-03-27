import { spawn } from 'node:child_process';
import { join, basename, resolve, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { addImportedPresentation, findWorkspaceRoot } from 'create-supaslidev';
import { findProjectRoot, getPresentations } from '../utils.js';
import {
  IGNORE_PATTERNS,
  validateName,
  validateSourceDirectory,
  copyDirectorySelective,
  hasSharedPackage,
  addSharedAddonToSlides,
  addSharedDependencyToPackageJson,
} from '../../shared/index.js';
import type { PackageJson } from '../../shared/types.js';

// Re-export for tests and other consumers
export {
  IGNORE_PATTERNS,
  validateName,
  shouldIgnore,
  validateSourceDirectory,
  copyDirectorySelective,
} from '../../shared/index.js';

export function findPnpmWorkspaceRoot(startDir: string): string | null {
  let currentDir = startDir;
  while (currentDir !== dirname(currentDir)) {
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }
  return null;
}

export function transformPackageJson(
  sourcePath: string,
  name: string,
  projectRoot: string,
): string {
  const packageJsonPath = join(sourcePath, 'package.json');
  const content = readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content) as PackageJson;

  packageJson.name = `@supaslidev/${name}`;
  packageJson.private = true;

  packageJson.scripts = {
    dev: 'slidev --open',
    build: 'slidev build',
    export: 'slidev export',
  };

  if (hasSharedPackage(projectRoot)) {
    addSharedDependencyToPackageJson(packageJson);
  }

  return JSON.stringify(packageJson, null, 2) + '\n';
}

function runPnpmInstall(projectRoot: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('\nRunning pnpm install...');

    const child = spawn('pnpm', ['install'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pnpm install failed with exit code ${code}`));
        return;
      }
      resolve();
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export interface ImportOptions {
  name?: string;
  install?: boolean;
}

export async function importPresentation(
  source: string,
  options: ImportOptions = {},
): Promise<void> {
  const { name, install = true } = options;
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

  const sourcePath = resolve(source);

  try {
    validateSourceDirectory(sourcePath);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : 'Invalid source'}`);
    process.exit(1);
  }

  const presentationName =
    name ??
    basename(sourcePath)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

  try {
    validateName(presentationName);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : 'Invalid name'}`);
    process.exit(1);
  }

  const existingPresentations = getPresentations(presentationsDir);
  if (existingPresentations.includes(presentationName)) {
    console.error(`Error: Presentation "${presentationName}" already exists`);
    process.exit(1);
  }

  const destinationPath = join(presentationsDir, presentationName);

  console.log(`Importing presentation from: ${sourcePath}`);
  console.log(`Destination: ${destinationPath}`);

  copyDirectorySelective(sourcePath, destinationPath);

  const transformedPackageJson = transformPackageJson(sourcePath, presentationName, projectRoot);
  writeFileSync(join(destinationPath, 'package.json'), transformedPackageJson);

  if (hasSharedPackage(projectRoot)) {
    const slidesPath = join(destinationPath, 'slides.md');
    if (existsSync(slidesPath)) {
      addSharedAddonToSlides(slidesPath);
    }
  }

  console.log('\nFiles copied successfully!');
  console.log('Ignored: ' + IGNORE_PATTERNS.join(', '));

  const workspaceRoot = findWorkspaceRoot(projectRoot);
  const pnpmRoot = findPnpmWorkspaceRoot(projectRoot);

  if (install) {
    await runPnpmInstall(pnpmRoot ?? projectRoot);
  } else {
    console.log(
      '\nSkipped pnpm install. Run "pnpm install" manually before using the presentation.',
    );
  }
  if (workspaceRoot) {
    addImportedPresentation(workspaceRoot, {
      name: presentationName,
      importedAt: new Date().toISOString(),
      sourcePath,
    });
  }

  console.log('\nPresentation imported successfully!');
  console.log(`Run "supaslidev present ${presentationName}" to start a dev server.`);
}
