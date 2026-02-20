import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { create } from '../../src/create.js';

const TEST_DIR = join(tmpdir(), 'supaslidev-e2e-import-addon');

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
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

function createMockSlidevPresentation(dir: string, options: { addons?: string[] } = {}): void {
  mkdirSync(dir, { recursive: true });

  const packageJson = {
    name: 'my-existing-presentation',
    private: true,
    scripts: {
      dev: 'slidev',
      build: 'slidev build',
    },
    dependencies: {
      '@slidev/cli': '^0.50.0',
    },
  };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');

  let frontmatter = `---
theme: seriph
title: My Existing Presentation`;

  if (options.addons && options.addons.length > 0) {
    frontmatter += `\naddons:\n${options.addons.map((a) => `  - '${a}'`).join('\n')}`;
  }

  frontmatter += `
---

# My Existing Presentation

This is an existing Slidev presentation

---

# Slide 2

More content here
`;

  writeFileSync(join(dir, 'slides.md'), frontmatter);
}

function addSharedAddonToSlides(slidesPath: string): void {
  const content = readFileSync(slidesPath, 'utf-8');
  const frontmatterMatch = content.match(/^(---\n)([\s\S]*?)\n(---)/);
  if (!frontmatterMatch) return;

  const [fullMatch, openDelim, frontmatter, closeDelim] = frontmatterMatch;
  const restOfFile = content.slice(fullMatch.length);
  const sharedAddon = '@supaslidev/shared';

  if (frontmatter.includes(sharedAddon)) return;

  let updatedFrontmatter = frontmatter;

  const addonsMatch = frontmatter.match(/^(addons:\s*)(\[.*?\])?$/m);
  if (addonsMatch) {
    if (addonsMatch[2]) {
      const arrayContent = addonsMatch[2].slice(1, -1).trim();
      if (arrayContent === '') {
        updatedFrontmatter = frontmatter.replace(addonsMatch[0], `addons: ['${sharedAddon}']`);
      } else {
        updatedFrontmatter = frontmatter.replace(
          addonsMatch[0],
          `addons: [${arrayContent}, '${sharedAddon}']`,
        );
      }
    } else {
      const addonsBlockMatch = frontmatter.match(/^addons:\s*\n((?:  - .+\n?)*)/m);
      if (addonsBlockMatch) {
        const existingBlock = addonsBlockMatch[0].trimEnd();
        updatedFrontmatter = frontmatter.replace(
          existingBlock,
          `${existingBlock}\n  - '${sharedAddon}'`,
        );
      }
    }
  } else {
    const themeMatch = frontmatter.match(/^(theme:\s*.+)$/m);
    if (themeMatch) {
      updatedFrontmatter = frontmatter.replace(
        themeMatch[1],
        `${themeMatch[1]}\naddons:\n  - '${sharedAddon}'`,
      );
    }
  }

  if (updatedFrontmatter !== frontmatter) {
    writeFileSync(slidesPath, `${openDelim}${updatedFrontmatter}\n${closeDelim}${restOfFile}`);
  }
}

function addSharedDependencyToPackageJson(packageJsonPath: string): void {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  if (!packageJson.dependencies['@supaslidev/shared']) {
    packageJson.dependencies['@supaslidev/shared'] = 'workspace:*';
  }
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

function simulateImport(sourceDir: string, destinationDir: string, presentationName: string): void {
  mkdirSync(destinationDir, { recursive: true });

  const sourcePackageJson = JSON.parse(readFileSync(join(sourceDir, 'package.json'), 'utf-8'));
  sourcePackageJson.name = `@supaslidev/${presentationName}`;
  sourcePackageJson.private = true;
  sourcePackageJson.scripts = {
    dev: 'slidev --open',
    build: 'slidev build',
    export: 'slidev export',
  };
  writeFileSync(
    join(destinationDir, 'package.json'),
    JSON.stringify(sourcePackageJson, null, 2) + '\n',
  );

  const slidesContent = readFileSync(join(sourceDir, 'slides.md'), 'utf-8');
  writeFileSync(join(destinationDir, 'slides.md'), slidesContent);

  addSharedDependencyToPackageJson(join(destinationDir, 'package.json'));
  addSharedAddonToSlides(join(destinationDir, 'slides.md'));
}

describe('Import Addon Configuration E2E', () => {
  let originalCwd: string;
  let projectDir: string;
  let mockPresentationDir: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);

    await create({
      name: 'import-test-workspace',
      presentation: 'initial-deck',
      git: false,
      install: false,
    });

    projectDir = join(TEST_DIR, 'import-test-workspace');
    mockPresentationDir = join(TEST_DIR, 'existing-presentation');
  });

  afterAll(() => {
    process.chdir(originalCwd);
    cleanTestDir();
  });

  describe('importing presentation without existing addons', () => {
    it('adds @supaslidev/shared to package.json dependencies', () => {
      createMockSlidevPresentation(mockPresentationDir);
      const importedDir = join(projectDir, 'presentations', 'imported-deck');

      simulateImport(mockPresentationDir, importedDir, 'imported-deck');

      const packageJson = JSON.parse(readFileSync(join(importedDir, 'package.json'), 'utf-8'));
      expect(packageJson.dependencies['@supaslidev/shared']).toBe('workspace:*');
    });

    it('adds @supaslidev/shared to slides.md addons', () => {
      const importedDir = join(projectDir, 'presentations', 'imported-deck');

      const slidesContent = readFileSync(join(importedDir, 'slides.md'), 'utf-8');
      expect(slidesContent).toContain('addons:');
      expect(slidesContent).toContain("'@supaslidev/shared'");
    });

    it('creates addons section after theme line', () => {
      const importedDir = join(projectDir, 'presentations', 'imported-deck');

      const slidesContent = readFileSync(join(importedDir, 'slides.md'), 'utf-8');
      const lines = slidesContent.split('\n');
      const themeIndex = lines.findIndex((line) => line.startsWith('theme:'));
      const addonsIndex = lines.findIndex((line) => line.startsWith('addons:'));

      expect(addonsIndex).toBeGreaterThan(themeIndex);
    });
  });

  describe('importing presentation with existing addons', () => {
    let importedWithAddonsDir: string;

    beforeAll(() => {
      const mockWithAddonsDir = join(TEST_DIR, 'existing-with-addons');
      createMockSlidevPresentation(mockWithAddonsDir, { addons: ['slidev-addon-qrcode'] });
      importedWithAddonsDir = join(projectDir, 'presentations', 'imported-with-addons');
      simulateImport(mockWithAddonsDir, importedWithAddonsDir, 'imported-with-addons');
    });

    it('preserves existing addons in slides.md', () => {
      const slidesContent = readFileSync(join(importedWithAddonsDir, 'slides.md'), 'utf-8');
      expect(slidesContent).toContain("'slidev-addon-qrcode'");
    });

    it('appends @supaslidev/shared to existing addons', () => {
      const slidesContent = readFileSync(join(importedWithAddonsDir, 'slides.md'), 'utf-8');
      expect(slidesContent).toContain("'@supaslidev/shared'");
    });

    it('maintains both existing and shared addons', () => {
      const slidesContent = readFileSync(join(importedWithAddonsDir, 'slides.md'), 'utf-8');
      const frontmatterMatch = slidesContent.match(/^---\n([\s\S]*?)\n---/);

      expect(frontmatterMatch).not.toBeNull();
      const frontmatter = frontmatterMatch![1];

      expect(frontmatter).toContain("'slidev-addon-qrcode'");
      expect(frontmatter).toContain("'@supaslidev/shared'");
    });
  });

  describe('importing presentation with multiple existing addons', () => {
    let importedMultiAddonsDir: string;

    beforeAll(() => {
      const mockMultiAddonsDir = join(TEST_DIR, 'existing-multi-addons');
      createMockSlidevPresentation(mockMultiAddonsDir, {
        addons: ['slidev-addon-qrcode', 'slidev-addon-excalidraw'],
      });
      importedMultiAddonsDir = join(projectDir, 'presentations', 'imported-multi-addons');
      simulateImport(mockMultiAddonsDir, importedMultiAddonsDir, 'imported-multi-addons');
    });

    it('preserves all existing addons', () => {
      const slidesContent = readFileSync(join(importedMultiAddonsDir, 'slides.md'), 'utf-8');
      expect(slidesContent).toContain("'slidev-addon-qrcode'");
      expect(slidesContent).toContain("'slidev-addon-excalidraw'");
    });

    it('adds @supaslidev/shared as third addon', () => {
      const slidesContent = readFileSync(join(importedMultiAddonsDir, 'slides.md'), 'utf-8');
      expect(slidesContent).toContain("'@supaslidev/shared'");

      const frontmatterMatch = slidesContent.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = frontmatterMatch![1];

      const addonsBlockMatch = frontmatter.match(/^addons:\s*\n((?:  - .+\n?)*)/m);
      expect(addonsBlockMatch).not.toBeNull();

      const addonLines = addonsBlockMatch![1].trim().split('\n');
      expect(addonLines.length).toBe(3);
      expect(addonLines.some((line) => line.includes('slidev-addon-qrcode'))).toBe(true);
      expect(addonLines.some((line) => line.includes('slidev-addon-excalidraw'))).toBe(true);
      expect(addonLines.some((line) => line.includes('@supaslidev/shared'))).toBe(true);
    });
  });

  describe('imported presentation package.json structure', () => {
    it('sets correct package name with @supaslidev scope', () => {
      const importedDir = join(projectDir, 'presentations', 'imported-deck');
      const packageJson = JSON.parse(readFileSync(join(importedDir, 'package.json'), 'utf-8'));

      expect(packageJson.name).toBe('@supaslidev/imported-deck');
    });

    it('sets private to true', () => {
      const importedDir = join(projectDir, 'presentations', 'imported-deck');
      const packageJson = JSON.parse(readFileSync(join(importedDir, 'package.json'), 'utf-8'));

      expect(packageJson.private).toBe(true);
    });

    it('updates scripts for supaslidev workflow', () => {
      const importedDir = join(projectDir, 'presentations', 'imported-deck');
      const packageJson = JSON.parse(readFileSync(join(importedDir, 'package.json'), 'utf-8'));

      expect(packageJson.scripts.dev).toBe('slidev --open');
      expect(packageJson.scripts.build).toBe('slidev build');
      expect(packageJson.scripts.export).toBe('slidev export');
    });
  });
});

describe('Import Addon Configuration E2E (with install)', { timeout: 180000 }, () => {
  let originalCwd: string;
  let projectDir: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);

    await create({
      name: 'install-test-workspace',
      presentation: 'initial-deck',
      git: false,
      install: false,
    });

    projectDir = join(TEST_DIR, 'install-test-workspace');

    const mockPresentationDir = join(TEST_DIR, 'mock-for-install');
    createMockSlidevPresentation(mockPresentationDir, { addons: ['slidev-addon-qrcode'] });

    const importedDir = join(projectDir, 'presentations', 'install-test-deck');
    simulateImport(mockPresentationDir, importedDir, 'install-test-deck');

    removeUnpublishedPackages(projectDir);
    const result = await runPnpmInstall(projectDir);
    if (!result.success) {
      throw new Error('pnpm install failed during setup: ' + result.output);
    }
  }, 180000);

  afterAll(() => {
    process.chdir(originalCwd);
    cleanTestDir();
  });

  it('pnpm install completes successfully', () => {
    expect(existsSync(join(projectDir, 'node_modules'))).toBe(true);
  });

  it('shared package is symlinked in imported presentation node_modules', () => {
    const nodeModulesShared = join(
      projectDir,
      'presentations',
      'install-test-deck',
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

  it('imported presentation has all required dependencies installed', () => {
    const importedNodeModules = join(
      projectDir,
      'presentations',
      'install-test-deck',
      'node_modules',
    );
    expect(existsSync(importedNodeModules)).toBe(true);
    expect(existsSync(join(importedNodeModules, '@supaslidev', 'shared'))).toBe(true);
  });
});
