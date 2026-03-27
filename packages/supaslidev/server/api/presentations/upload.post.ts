import { spawn } from 'node:child_process';
import { join, dirname, normalize, resolve, sep } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  SLUG_REGEX,
  shouldIgnore,
  convertToCatalogDependencies,
  hasSharedPackage,
  addSharedDependencyToPackageJson,
  addSharedAddonToSlides,
  regeneratePresentationsJson,
} from '../../../src/shared/index.js';
import { getProjectRoot, getPresentationsDir, getPresentationsJsonPath } from '../../utils/config';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { files, name, folderName } = body;

  if (!Array.isArray(files) || files.length === 0) {
    throw createError({
      statusCode: 400,
      data: { field: 'files', message: 'No files provided' },
    });
  }

  const hasSlides = files.some((f: { path: string }) => f.path === 'slides.md');
  const hasPackageJson = files.some((f: { path: string }) => f.path === 'package.json');

  if (!hasSlides) {
    throw createError({
      statusCode: 400,
      data: { field: 'files', message: 'No slides.md found in uploaded files' },
    });
  }

  if (!hasPackageJson) {
    throw createError({
      statusCode: 400,
      data: { field: 'files', message: 'No package.json found in uploaded files' },
    });
  }

  const projectRoot = getProjectRoot();
  const presentationsDir = getPresentationsDir();

  const presentationName =
    name || (folderName || 'presentation').toLowerCase().replace(/[^a-z0-9-]/g, '-');

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

  mkdirSync(destinationPath, { recursive: true });

  const resolvedDest = resolve(destinationPath);
  for (const file of files) {
    if (shouldIgnore(file.path.split('/')[0])) {
      continue;
    }

    const normalizedPath = normalize(file.path).replace(/^(\.\.[\\/])+/, '');
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/') || normalizedPath.includes('\0')) {
      continue;
    }
    const filePath = resolve(destinationPath, normalizedPath);
    if (!filePath.startsWith(resolvedDest + sep) && filePath !== resolvedDest) {
      continue;
    }
    const fileDir = dirname(filePath);

    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }

    if (file.encoding === 'base64') {
      writeFileSync(filePath, Buffer.from(file.content, 'base64'));
    } else {
      writeFileSync(filePath, file.content, 'utf-8');
    }
  }

  const packageJsonPath = join(destinationPath, 'package.json');
  let packageJson: Record<string, unknown>;
  try {
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(packageJsonContent);
  } catch {
    throw createError({
      statusCode: 400,
      data: { field: 'files', message: 'Malformed package.json in uploaded files' },
    });
  }

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

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

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
      console.error(`[upload] pnpm install failed with code ${code}`);
    }
  });

  setResponseStatus(event, 201);
  return presentation;
});
