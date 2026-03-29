import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { transformPackageJson } from '../../src/cli/commands/import.js';
import {
  createTestProjectDir,
  createMockSlidevProject,
  cleanupTestDir,
} from '../helpers/import-test-helpers.js';

describe('transformPackageJson', () => {
  let testDir: string;
  let workspaceRoot: string;

  beforeEach(() => {
    testDir = createTestProjectDir('transform-package-json');
    workspaceRoot = join(testDir, 'workspace');
    mkdirSync(workspaceRoot, { recursive: true });
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('sets package name to @supaslidev/{name} format', () => {
    const projectDir = join(testDir, 'project');
    createMockSlidevProject(projectDir);

    const result = JSON.parse(transformPackageJson(projectDir, 'my-presentation', workspaceRoot));

    expect(result.name).toBe('@supaslidev/my-presentation');
  });

  it('sets private to true', () => {
    const projectDir = join(testDir, 'project');
    createMockSlidevProject(projectDir, {
      packageJson: { private: false },
    });

    const result = JSON.parse(transformPackageJson(projectDir, 'my-presentation', workspaceRoot));

    expect(result.private).toBe(true);
  });

  it('sets correct scripts for supaslidev workspace', () => {
    const projectDir = join(testDir, 'project');
    createMockSlidevProject(projectDir, {
      packageJson: {
        scripts: {
          dev: 'original-dev',
          build: 'original-build',
          custom: 'custom-script',
        },
      },
    });

    const result = JSON.parse(transformPackageJson(projectDir, 'my-presentation', workspaceRoot));

    expect(result.scripts).toEqual({
      dev: 'slidev --open',
      build: 'slidev build',
      export: 'slidev export',
    });
  });

  it('preserves original dependency versions except vue', () => {
    const projectDir = join(testDir, 'project');
    createMockSlidevProject(projectDir, {
      packageJson: {
        dependencies: {
          '@slidev/cli': '^0.50.0',
          '@slidev/theme-default': '^0.25.0',
          vue: '^3.5.0',
        },
      },
    });

    const result = JSON.parse(transformPackageJson(projectDir, 'my-presentation', workspaceRoot));

    expect(result.dependencies['@slidev/cli']).toBe('^0.50.0');
    expect(result.dependencies['@slidev/theme-default']).toBe('^0.25.0');
    expect(result.dependencies['vue']).toBe('catalog:');
  });

  it('normalizes vue to catalog: in devDependencies', () => {
    const projectDir = join(testDir, 'project');
    createMockSlidevProject(projectDir, {
      packageJson: {
        dependencies: {
          '@slidev/cli': '^0.50.0',
        },
        devDependencies: {
          vue: '^3.4.0',
        },
      },
    });

    const result = JSON.parse(transformPackageJson(projectDir, 'my-presentation', workspaceRoot));

    expect(result.devDependencies['vue']).toBe('catalog:');
  });

  it('preserves existing devDependencies', () => {
    const projectDir = join(testDir, 'project');
    createMockSlidevProject(projectDir, {
      packageJson: {
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
        },
      },
    });

    const result = JSON.parse(transformPackageJson(projectDir, 'my-presentation', workspaceRoot));

    expect(result.devDependencies).toEqual({
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
    });
  });

  it('handles package.json without dependencies gracefully', () => {
    const projectDir = join(testDir, 'project');
    createMockSlidevProject(projectDir, {
      packageJson: {
        name: 'minimal-project',
        version: '1.0.0',
        dependencies: undefined,
        devDependencies: undefined,
      },
    });

    const result = JSON.parse(transformPackageJson(projectDir, 'my-presentation', workspaceRoot));

    expect(result.name).toBe('@supaslidev/my-presentation');
    expect(result.private).toBe(true);
    expect(result.scripts).toEqual({
      dev: 'slidev --open',
      build: 'slidev build',
      export: 'slidev export',
    });
    expect(result.dependencies).toBeUndefined();
    expect(result.devDependencies).toBeUndefined();
  });

  it('adds shared dependency when shared package exists', () => {
    const projectDir = join(testDir, 'project');
    createMockSlidevProject(projectDir, {
      packageJson: {
        dependencies: {
          '@slidev/cli': '^0.50.0',
        },
      },
    });

    const sharedDir = join(workspaceRoot, 'packages', 'shared');
    mkdirSync(sharedDir, { recursive: true });
    writeFileSync(join(sharedDir, 'package.json'), JSON.stringify({ name: '@supaslidev/shared' }));

    const result = JSON.parse(transformPackageJson(projectDir, 'my-presentation', workspaceRoot));

    expect(result.dependencies['@supaslidev/shared']).toBe('workspace:*');
  });
});
