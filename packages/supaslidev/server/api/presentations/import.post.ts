import { spawn } from 'node:child_process';
import { join, basename, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  validateSourceDirectoryResult,
  SLUG_REGEX,
  copyDirectorySelective,
  hasSharedPackage,
  addSharedDependencyToPackageJson,
  addSharedAddonToSlides,
  normalizeVueToCatalog,
  regeneratePresentationsJson,
} from '../../../src/shared/index.js';
import { getProjectRoot, getPresentationsDir, getPresentationsJsonPath } from '../../utils/config';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { source, name } = body;

  const projectRoot = getProjectRoot();
  const presentationsDir = getPresentationsDir();
  const sourcePath = resolve(source);

  // This endpoint is dev-only; sourcePath is validated by validateSourceDirectoryResult
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
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
    || 'untitled';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let packageJson: any;
  try {
    const packageJsonContent = readFileSync(sourcePackageJsonPath, 'utf-8');
    packageJson = JSON.parse(packageJsonContent);
  } catch {
    throw createError({
      statusCode: 400,
      data: { field: 'source', message: `Invalid package.json in ${sourcePackageJsonPath}` },
    });
  }

  packageJson.name = `@supaslidev/${presentationName}`;
  packageJson.private = true;
  packageJson.scripts = {
    dev: 'slidev --open',
    build: 'slidev build',
    export: 'slidev export',
  };

  normalizeVueToCatalog(packageJson);

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

  install.on('error', (err) => {
    console.error(`[import] pnpm install spawn error: ${err.message}`);
  });

  setResponseStatus(event, 201);
  return presentation;
});
