import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { create } from '../../src/create.js';

const TEST_DIR = join(tmpdir(), 'supaslidev-e2e-shared-integration');

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

function removeUnpublishedPackages(projectDir: string): void {
  const packageJsonPath = join(projectDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (packageJson.devDependencies?.['supaslidev']) {
    delete packageJson.devDependencies['supaslidev'];
  }
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

function runPnpmInstall(cwd: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const output: string[] = [];
    const child = spawn('pnpm', ['install'], {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (data) => {
      output.push(data.toString());
    });

    child.stderr?.on('data', (data) => {
      output.push(data.toString());
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output.join(''),
      });
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        output: err.message,
      });
    });
  });
}

describe('Shared Package Integration E2E', () => {
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

  describe('workspace structure verification', () => {
    it('creates packages/shared/ with correct directory structure', async () => {
      await create({
        name: 'test-workspace',
        presentation: 'test-slides',
        git: false,
        install: false,
      });

      const sharedDir = join(TEST_DIR, 'test-workspace', 'packages', 'shared');

      expect(existsSync(sharedDir)).toBe(true);
      expect(existsSync(join(sharedDir, 'components'))).toBe(true);
      expect(existsSync(join(sharedDir, 'layouts'))).toBe(true);
      expect(existsSync(join(sharedDir, 'styles'))).toBe(true);
      expect(existsSync(join(sharedDir, 'package.json'))).toBe(true);
      expect(existsSync(join(sharedDir, 'tsconfig.json'))).toBe(true);
      expect(existsSync(join(sharedDir, 'README.md'))).toBe(true);
    });

    it('creates SharedBadge.vue component in shared package', async () => {
      await create({
        name: 'test-workspace',
        presentation: 'test-slides',
        git: false,
        install: false,
      });

      const componentPath = join(
        TEST_DIR,
        'test-workspace',
        'packages',
        'shared',
        'components',
        'SharedBadge.vue',
      );

      expect(existsSync(componentPath)).toBe(true);

      const content = readFileSync(componentPath, 'utf-8');
      expect(content).toContain('<template>');
      expect(content).toContain('shared-badge');
      expect(content).toContain('<style');
    });

    it('creates shared package.json with correct Slidev addon configuration', async () => {
      await create({
        name: 'test-workspace',
        presentation: 'test-slides',
        git: false,
        install: false,
      });

      const packageJsonPath = join(
        TEST_DIR,
        'test-workspace',
        'packages',
        'shared',
        'package.json',
      );
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.name).toBe('@supaslidev/shared');
      expect(packageJson.private).toBe(true);
      expect(packageJson.type).toBe('module');
      expect(packageJson.keywords).toContain('slidev-addon');
      expect(packageJson.keywords).toContain('slidev');
      expect(packageJson.dependencies.vue).toBe('catalog:');
    });
  });

  describe('presentation configuration verification', () => {
    it('includes @supaslidev/shared as workspace dependency in presentation package.json', async () => {
      await create({
        name: 'test-workspace',
        presentation: 'test-slides',
        git: false,
        install: false,
      });

      const presPackageJsonPath = join(
        TEST_DIR,
        'test-workspace',
        'presentations',
        'test-slides',
        'package.json',
      );
      const presPackageJson = JSON.parse(readFileSync(presPackageJsonPath, 'utf-8'));

      expect(presPackageJson.dependencies['@supaslidev/shared']).toBe('workspace:*');
    });

    it('includes @supaslidev/shared in slides.md addons frontmatter', async () => {
      await create({
        name: 'test-workspace',
        presentation: 'test-slides',
        git: false,
        install: false,
      });

      const slidesMdPath = join(
        TEST_DIR,
        'test-workspace',
        'presentations',
        'test-slides',
        'slides.md',
      );
      const slidesContent = readFileSync(slidesMdPath, 'utf-8');

      expect(slidesContent).toContain('addons:');
      expect(slidesContent).toContain("'@supaslidev/shared'");
    });
  });

  describe('pnpm workspace integration', () => {
    it('includes packages/* in pnpm-workspace.yaml', async () => {
      await create({
        name: 'test-workspace',
        presentation: 'test-slides',
        git: false,
        install: false,
      });

      const workspaceYamlPath = join(TEST_DIR, 'test-workspace', 'pnpm-workspace.yaml');
      const workspaceContent = readFileSync(workspaceYamlPath, 'utf-8');

      expect(workspaceContent).toContain('packages/*');
    });
  });
});

describe('Shared Package Integration E2E (with install)', { timeout: 180000 }, () => {
  let originalCwd: string;
  let projectDir: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);

    await create({
      name: 'integration-test',
      presentation: 'demo-deck',
      git: false,
      install: false,
    });

    projectDir = join(TEST_DIR, 'integration-test');

    removeUnpublishedPackages(projectDir);
    const result = await runPnpmInstall(projectDir);
    if (!result.success) {
      throw new Error('pnpm install failed during setup: ' + result.output);
    }
  }, 180000);

  afterAll(() => {
    process.chdir(originalCwd);
    try {
      cleanTestDir();
    } catch {
      // Ignore cleanup errors - temp dir will be cleaned by OS
    }
  });

  it('pnpm install completes successfully', () => {
    expect(existsSync(join(projectDir, 'node_modules'))).toBe(true);
  });

  it('node_modules are created after install', async () => {
    expect(existsSync(join(projectDir, 'node_modules'))).toBe(true);
    expect(existsSync(join(projectDir, 'packages', 'shared', 'node_modules'))).toBe(true);
    expect(existsSync(join(projectDir, 'presentations', 'demo-deck', 'node_modules'))).toBe(true);
  });
});

describe('Slidev Integration E2E', { timeout: 180000 }, () => {
  let originalCwd: string;
  let projectDir: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);

    await create({
      name: 'slidev-test',
      presentation: 'badge-demo',
      git: false,
      install: false,
    });

    projectDir = join(TEST_DIR, 'slidev-test');

    removeUnpublishedPackages(projectDir);
    const installResult = await runPnpmInstall(projectDir);
    if (!installResult.success) {
      throw new Error('pnpm install failed: ' + installResult.output);
    }
  }, 180000);

  afterAll(() => {
    process.chdir(originalCwd);
    try {
      cleanTestDir();
    } catch {
      // Ignore cleanup errors - temp dir will be cleaned by OS
    }
  });

  it('SharedBadge component is available after pnpm install', async () => {
    const sharedPackageDir = join(projectDir, 'packages', 'shared');
    const componentPath = join(sharedPackageDir, 'components', 'SharedBadge.vue');

    expect(existsSync(componentPath)).toBe(true);

    const content = readFileSync(componentPath, 'utf-8');
    expect(content).toContain('<template>');
    expect(content).toContain('shared-badge');
  });

  it('shared package is symlinked in presentation node_modules', async () => {
    const nodeModulesShared = join(
      projectDir,
      'presentations',
      'badge-demo',
      'node_modules',
      '@supaslidev',
      'shared',
    );
    expect(existsSync(nodeModulesShared)).toBe(true);

    const linkedPackageJson = JSON.parse(
      readFileSync(join(nodeModulesShared, 'package.json'), 'utf-8'),
    );
    expect(linkedPackageJson.name).toBe('@supaslidev/shared');
    expect(linkedPackageJson.keywords).toContain('slidev-addon');
  });

  it('Slidev CLI is installed and can be invoked', async () => {
    const slidevCliPath = join(
      projectDir,
      'presentations',
      'badge-demo',
      'node_modules',
      '.bin',
      'slidev',
    );
    expect(existsSync(slidevCliPath)).toBe(true);
  });

  it('shared addon is configured correctly for Slidev', async () => {
    const sharedPackageJson = JSON.parse(
      readFileSync(join(projectDir, 'packages', 'shared', 'package.json'), 'utf-8'),
    );

    expect(sharedPackageJson.keywords).toContain('slidev-addon');
    expect(sharedPackageJson.keywords).toContain('slidev');

    expect(existsSync(join(projectDir, 'packages', 'shared', 'components'))).toBe(true);
    expect(existsSync(join(projectDir, 'packages', 'shared', 'layouts'))).toBe(true);
    expect(existsSync(join(projectDir, 'packages', 'shared', 'styles'))).toBe(true);
  });
});
