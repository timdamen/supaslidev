import { existsSync, statSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import type { ValidationResult, PathValidationResult } from './types.js';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.nuxt',
  '.output',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '.DS_Store',
];

export function isValidPresentationId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 100 && SLUG_REGEX.test(id);
}

export function validateName(name: string): void {
  if (!SLUG_REGEX.test(name)) {
    throw new Error(
      'Name must be lowercase alphanumeric with single hyphens only (no leading, trailing, or consecutive hyphens)',
    );
  }
}

export function shouldIgnore(name: string): boolean {
  return IGNORE_PATTERNS.includes(name);
}

export function validateSourceDirectory(sourcePath: string): void {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source directory does not exist: ${sourcePath}`);
  }

  if (!statSync(sourcePath).isDirectory()) {
    throw new Error(`Source path is not a directory: ${sourcePath}`);
  }

  const slidesPath = join(sourcePath, 'slides.md');
  if (!existsSync(slidesPath)) {
    throw new Error(`No slides.md found in source directory: ${sourcePath}`);
  }

  const packageJsonPath = join(sourcePath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new Error(`No package.json found in source directory: ${sourcePath}`);
  }
}

export function validateSourceDirectoryResult(sourcePath: string): ValidationResult {
  try {
    if (!existsSync(sourcePath)) {
      return { isValid: false, error: 'Source directory does not exist' };
    }

    if (!statSync(sourcePath).isDirectory()) {
      return { isValid: false, error: 'Source path is not a directory' };
    }

    const slidesPath = join(sourcePath, 'slides.md');
    if (!existsSync(slidesPath)) {
      return { isValid: false, error: 'No slides.md found in source directory' };
    }

    const packageJsonPath = join(sourcePath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return { isValid: false, error: 'No package.json found in source directory' };
    }

    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: `Validation error: ${(err as Error).message}` };
  }
}

export function validatePath(path: string): PathValidationResult {
  const sourcePath = resolve(path);
  const validation = validateSourceDirectoryResult(sourcePath);

  if (!validation.isValid) {
    return {
      path,
      isValid: false,
      suggestedName: null,
      error: validation.error ?? null,
    };
  }

  const suggestedName =
    basename(sourcePath)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled';

  return {
    path,
    isValid: true,
    suggestedName,
    error: null,
  };
}

export function validatePaths(paths: string[]): PathValidationResult[] {
  return paths.map(validatePath);
}
