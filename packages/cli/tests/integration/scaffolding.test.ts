import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { create } from '../../src/create.js';
import { CLI_VERSION } from '../../src/version.js';

const TEST_DIR = join(tmpdir(), 'supaslidev-e2e-scaffolding');

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('Scaffolding E2E', () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanTestDir();
  });

  it('creates a complete workspace with all required files', async () => {
    await create({
      name: 'test-project',
      presentation: 'demo-slides',
      git: false,
      install: false,
    });

    const projectDir = join(TEST_DIR, 'test-project');

    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(join(projectDir, 'pnpm-workspace.yaml'))).toBe(true);
    expect(existsSync(join(projectDir, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(projectDir, '.supaslidev', 'state.json'))).toBe(true);

    expect(existsSync(join(projectDir, 'presentations'))).toBe(true);
    expect(existsSync(join(projectDir, 'packages'))).toBe(true);
    expect(existsSync(join(projectDir, 'scripts'))).toBe(true);
  });

  it('creates the specified presentation with slides.md', async () => {
    await create({
      name: 'test-project',
      presentation: 'my-deck',
      git: false,
      install: false,
    });

    const presentationDir = join(TEST_DIR, 'test-project', 'presentations', 'my-deck');

    expect(existsSync(presentationDir)).toBe(true);
    expect(existsSync(join(presentationDir, 'slides.md'))).toBe(true);
    expect(existsSync(join(presentationDir, 'package.json'))).toBe(true);
    expect(existsSync(join(presentationDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(presentationDir, '.npmrc'))).toBe(true);

    const slidesContent = readFileSync(join(presentationDir, 'slides.md'), 'utf-8');
    expect(slidesContent).toContain('title: my-deck');
    expect(slidesContent).toContain('# my-deck');
  });

  it('creates valid package.json with correct workspace name', async () => {
    await create({
      name: 'my-workspace',
      presentation: 'first-deck',
      git: false,
      install: false,
    });

    const packageJsonPath = join(TEST_DIR, 'my-workspace', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    expect(packageJson.name).toBe('my-workspace');
    expect(packageJson.private).toBe(true);
  });

  it('creates presentation package.json with catalog dependencies', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const presPackageJsonPath = join(
      TEST_DIR,
      'test-project',
      'presentations',
      'test-deck',
      'package.json',
    );
    const presPackageJson = JSON.parse(readFileSync(presPackageJsonPath, 'utf-8'));

    expect(presPackageJson.name).toBe('@supaslidev/test-deck');
    expect(presPackageJson.dependencies['@slidev/cli']).toBe('catalog:');
    expect(presPackageJson.dependencies['@slidev/theme-default']).toBe('catalog:');
    expect(presPackageJson.dependencies['@slidev/theme-seriph']).toBe('catalog:');
    expect(presPackageJson.dependencies['@slidev/theme-apple-basic']).toBe('catalog:');
    expect(presPackageJson.dependencies['vue']).toBe('catalog:');
  });

  it('creates pnpm-workspace.yaml with catalog section', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const workspaceYamlPath = join(TEST_DIR, 'test-project', 'pnpm-workspace.yaml');
    const workspaceContent = readFileSync(workspaceYamlPath, 'utf-8');

    expect(workspaceContent).toContain('packages:');
    expect(workspaceContent).toContain('presentations/*');
    expect(workspaceContent).toContain('@slidev/theme-default');
    expect(workspaceContent).toContain('@slidev/theme-seriph');
    expect(workspaceContent).toContain('@slidev/theme-apple-basic');
  });

  it('creates state.json with correct initial values', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const statePath = join(TEST_DIR, 'test-project', '.supaslidev', 'state.json');
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));

    expect(state.cliVersion).toBe(CLI_VERSION);
    expect(state.appliedMigrations).toEqual([]);
    expect(state.createdAt).toBeDefined();
    expect(state.lastUpdatedAt).toBeDefined();
  });

  it('creates dev script for running presentations', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const devScriptPath = join(TEST_DIR, 'test-project', 'scripts', 'dev-presentation.mjs');
    expect(existsSync(devScriptPath)).toBe(true);

    const scriptContent = readFileSync(devScriptPath, 'utf-8');
    expect(scriptContent).toContain('#!/usr/bin/env node');
    expect(scriptContent).toContain('getPresentations');
  });

  it('uses default values when options are provided', async () => {
    await create({
      name: 'default-test',
      git: false,
      install: false,
    });

    const projectDir = join(TEST_DIR, 'default-test');
    const presentationDir = join(projectDir, 'presentations', 'my-first-deck');

    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(presentationDir)).toBe(true);
  });

  it('includes supaslidev in devDependencies', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const packageJsonPath = join(TEST_DIR, 'test-project', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    expect(packageJson.devDependencies['supaslidev']).toMatch(/^\^\d+\.\d+\.\d+$/);
  });

  it('includes supaslidev script in package.json', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const packageJsonPath = join(TEST_DIR, 'test-project', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    expect(packageJson.scripts.dev).toBe('supaslidev');
  });

  it('includes build script in root package.json', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const packageJsonPath = join(TEST_DIR, 'test-project', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    expect(packageJson.scripts.build).toBe('pnpm --filter @supaslidev/* run build');
  });

  it('creates presentation .gitignore with all required entries', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const gitignorePath = join(
      TEST_DIR,
      'test-project',
      'presentations',
      'test-deck',
      '.gitignore',
    );
    const content = readFileSync(gitignorePath, 'utf-8');

    expect(content).toContain('node_modules');
    expect(content).toContain('.DS_Store');
    expect(content).toContain('dist');
    expect(content).toContain('*.local');
    expect(content).toContain('.vite-inspect');
    expect(content).toContain('.remote-assets');
    expect(content).toContain('components.d.ts');
  });

  it('creates presentation .npmrc with auto-install-peers', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const npmrcPath = join(TEST_DIR, 'test-project', 'presentations', 'test-deck', '.npmrc');
    const content = readFileSync(npmrcPath, 'utf-8');

    expect(content).toContain('shamefully-hoist=true');
    expect(content).toContain('auto-install-peers=true');
  });

  it('creates pnpm-workspace.yaml with pnpm configuration options', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const workspacePath = join(TEST_DIR, 'test-project', 'pnpm-workspace.yaml');
    const content = readFileSync(workspacePath, 'utf-8');

    expect(content).toContain('linkWorkspacePackages: true');
    expect(content).toContain('shellEmulator: true');
    expect(content).toContain('trustPolicy: no-downgrade');
    expect(content).toContain('catalogMode: prefer');
  });

  it('creates shared package.json with Slidev addon keywords', async () => {
    await create({
      name: 'test-project',
      presentation: 'test-deck',
      git: false,
      install: false,
    });

    const sharedPackageJsonPath = join(
      TEST_DIR,
      'test-project',
      'packages',
      'shared',
      'package.json',
    );
    expect(existsSync(sharedPackageJsonPath)).toBe(true);

    const sharedPackageJson = JSON.parse(readFileSync(sharedPackageJsonPath, 'utf-8'));

    expect(sharedPackageJson.name).toBe('@supaslidev/shared');
    expect(sharedPackageJson.private).toBe(true);
    expect(sharedPackageJson.type).toBe('module');
    expect(sharedPackageJson.keywords).toEqual(['slidev-addon', 'slidev']);
    expect(sharedPackageJson.dependencies.vue).toBe('catalog:');
  });
});
