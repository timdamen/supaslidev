import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSharedPackage } from '../../src/create.js';

const TEST_DIR = join(tmpdir(), 'supaslidev-unit-shared-package');

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('createSharedPackage', () => {
  beforeEach(() => {
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('creates the shared package directory structure', () => {
    createSharedPackage(TEST_DIR);

    const sharedDir = join(TEST_DIR, 'packages', 'shared');
    expect(existsSync(sharedDir)).toBe(true);
    expect(existsSync(join(sharedDir, 'components'))).toBe(true);
    expect(existsSync(join(sharedDir, 'layouts'))).toBe(true);
    expect(existsSync(join(sharedDir, 'styles'))).toBe(true);
  });

  it('creates package.json with correct content and format', () => {
    createSharedPackage(TEST_DIR);

    const packageJsonPath = join(TEST_DIR, 'packages', 'shared', 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);

    const content = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    expect(packageJson.name).toBe('@supaslidev/shared');
    expect(packageJson.private).toBe(true);
    expect(packageJson.type).toBe('module');
    expect(packageJson.keywords).toEqual(['slidev-addon', 'slidev']);
    expect(packageJson.dependencies).toEqual({ vue: 'catalog:' });

    expect(content.endsWith('\n')).toBe(true);
  });

  it('creates SharedBadge.vue with correct content', () => {
    createSharedPackage(TEST_DIR);

    const badgePath = join(TEST_DIR, 'packages', 'shared', 'components', 'SharedBadge.vue');
    expect(existsSync(badgePath)).toBe(true);

    const content = readFileSync(badgePath, 'utf-8');
    expect(content).toContain('<script setup lang="ts">');
    expect(content).toContain('text?: string');
    expect(content).toContain("{{ text ?? 'Shared' }}");
    expect(content).toContain('<template>');
    expect(content).toContain('</template>');
  });

  it('creates SharedBadge.vue with gradient styling', () => {
    createSharedPackage(TEST_DIR);

    const badgePath = join(TEST_DIR, 'packages', 'shared', 'components', 'SharedBadge.vue');
    const content = readFileSync(badgePath, 'utf-8');

    expect(content).toContain('linear-gradient');
    expect(content).toContain('border-radius: 9999px');
    expect(content).toContain('text-transform: uppercase');
  });

  it('creates README.md with addon documentation', () => {
    createSharedPackage(TEST_DIR);

    const readmePath = join(TEST_DIR, 'packages', 'shared', 'README.md');
    expect(existsSync(readmePath)).toBe(true);

    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('@supaslidev/shared');
    expect(content).toContain('Slidev addon pattern');
    expect(content).toContain('sli.dev/guide/write-addon');
    expect(content).toContain('<SharedBadge text="New" />');
    expect(content).toContain('Adding New Components');
  });

  it('creates tsconfig.json with full compiler options', () => {
    createSharedPackage(TEST_DIR);

    const tsconfigPath = join(TEST_DIR, 'packages', 'shared', 'tsconfig.json');
    expect(existsSync(tsconfigPath)).toBe(true);

    const content = readFileSync(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content);

    expect(tsconfig.compilerOptions.target).toBe('ESNext');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
    expect(tsconfig.compilerOptions.resolveJsonModule).toBe(true);
    expect(tsconfig.compilerOptions.isolatedModules).toBe(true);
    expect(tsconfig.compilerOptions.esModuleInterop).toBe(true);
    expect(tsconfig.compilerOptions.lib).toEqual(['ESNext', 'DOM']);
    expect(tsconfig.compilerOptions.noEmit).toBe(true);
  });

  it('creates tsconfig.json scoped to components directory', () => {
    createSharedPackage(TEST_DIR);

    const tsconfigPath = join(TEST_DIR, 'packages', 'shared', 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.include).toEqual(['components/**/*.ts', 'components/**/*.vue']);
    expect(tsconfig.exclude).toEqual(['node_modules']);
  });
});
