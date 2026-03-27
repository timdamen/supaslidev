import { spawn } from 'node:child_process';
import { join, basename, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  validateSourceDirectoryResult,
  SLUG_REGEX,
  copyDirectorySelective,
  convertToCatalogDependencies,
  hasSharedPackage,
  addSharedDependencyToPackageJson,
  addSharedAddonToSlides,
  regeneratePresentationsJson,
} from '../../../src/shared/index.js';
import { getProjectRoot, getPresentationsDir, getPresentationsJsonPath } from '../../utils/config';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { source, name } = body;

  const projectRoot = getProjectRoot();
  const presentationsDir = getPresentationsDir();
  const sourcePath = resolve(source);
  const validation = validateSourceDirectoryResult(sourcePath);

  if (!validation.isValid) {
    throw createError({
      statusCode: 400,
      data: { field: 'source', message: validation.error },
    });
  }

  const presentationName =
    name ||
    basename(sourcePath)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

  if (!SLUG_REGEX.test(presentationName)) {
    throw createError({
      statusCode: 400,
      data: {
        field: 'name',
        message: 'Name must be a valid slug (lowercase letters, numbers, hyphens only)',
      },
    });
  }

  const destinationPath = join(presentationsDir, presentationName);

  if (existsSync(destinationPath)) {
    throw createError({
      statusCode: 400,
      data: { field: 'name', message: 'A presentation with this name already exists' },
    });
  }

  copyDirectorySelective(sourcePath, destinationPath);

  const sourcePackageJsonPath = join(sourcePath, 'package.json');
  const packageJsonContent = readFileSync(sourcePackageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonContent);

  packageJson.name = `@supaslidev/${presentationName}`;
  packageJson.private = true;
  packageJson.scripts = {
    dev: 'slidev --open',
    build: 'slidev build',
    export: 'slidev export',
  };

  if (packageJson.dependencies) {
    packageJson.dependencies = convertToCatalogDependencies(packageJson.dependencies);
  }
  if (packageJson.devDependencies) {
    packageJson.devDependencies = convertToCatalogDependencies(packageJson.devDependencies);
  }

  const sharedExists = hasSharedPackage(projectRoot);
  if (sharedExists) {
    addSharedDependencyToPackageJson(packageJson);
  }

  writeFileSync(
    join(destinationPath, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
  );

  if (sharedExists) {
    const slidesPath = join(destinationPath, 'slides.md');
    if (existsSync(slidesPath)) {
      addSharedAddonToSlides(slidesPath);
    }
  }

  regeneratePresentationsJson(presentationsDir, getPresentationsJsonPath());

  const presentation = {
    id: presentationName,
    title: presentationName,
    description: '',
    theme: 'default',
    background: 'https://cover.sli.dev',
    duration: '',
  };

  // Run pnpm install in background
  const install = spawn('pnpm', ['install'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
  });

  install.on('close', (code: number | null) => {
    if (code !== 0) {
      console.error(`[import] pnpm install failed with code ${code}`);
    }
  });

  setResponseStatus(event, 201);
  return presentation;
});
