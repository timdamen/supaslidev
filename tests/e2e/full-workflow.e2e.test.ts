import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli, getTmpDir, cleanupProject, installDependencies } from './setup/test-utils.js';

describe('Full Production Workflow', { timeout: 180000 }, () => {
  const PROJECT_NAME = 'full-workflow-test';
  let projectDir: string;

  beforeAll(() => {
    cleanupProject(PROJECT_NAME);

    const result = runCli(
      `create --name ${PROJECT_NAME} --presentation first-deck --no-git --no-install`,
      getTmpDir(),
    );

    if (result.exitCode !== 0) {
      throw new Error(
        `CLI scaffolding failed (exit ${result.exitCode}):\n${result.stdout}\n${result.stderr}`,
      );
    }

    projectDir = join(getTmpDir(), PROJECT_NAME);
    installDependencies(projectDir);
  }, 180000);

  afterAll(() => {
    cleanupProject(PROJECT_NAME);
  });

  describe('dependency resolution', () => {
    it('pnpm install creates node_modules and lockfile', () => {
      expect(existsSync(join(projectDir, 'node_modules'))).toBe(true);
      expect(existsSync(join(projectDir, 'pnpm-lock.yaml'))).toBe(true);
    });

    it('supaslidev binary is available after install', () => {
      const binPath = join(projectDir, 'node_modules', '.bin', 'supaslidev');
      expect(existsSync(binPath)).toBe(true);
    });

    it('shared package is symlinked in presentation node_modules', () => {
      const sharedPath = join(
        projectDir,
        'presentations',
        'first-deck',
        'node_modules',
        '@supaslidev',
        'shared',
      );
      expect(existsSync(sharedPath)).toBe(true);

      const linkedPackageJson = JSON.parse(readFileSync(join(sharedPath, 'package.json'), 'utf-8'));
      expect(linkedPackageJson.name).toBe('@supaslidev/shared');
      expect(linkedPackageJson.keywords).toContain('slidev-addon');
    });

    it('slidev CLI is available in presentation', () => {
      const slidevBin = join(
        projectDir,
        'presentations',
        'first-deck',
        'node_modules',
        '.bin',
        'slidev',
      );
      expect(existsSync(slidevBin)).toBe(true);
    });
  });

  describe('workspace structure after install', () => {
    it('presentation node_modules exist', () => {
      expect(existsSync(join(projectDir, 'presentations', 'first-deck', 'node_modules'))).toBe(
        true,
      );
    });

    it('shared package node_modules exist', () => {
      expect(existsSync(join(projectDir, 'packages', 'shared', 'node_modules'))).toBe(true);
    });

    it('catalog dependencies resolved to real versions in lockfile', () => {
      const lockContent = readFileSync(join(projectDir, 'pnpm-lock.yaml'), 'utf-8');
      expect(lockContent).toContain('@slidev/cli');
      expect(lockContent).toContain('vue');
    });
  });

  describe('shared addon integration', () => {
    it('SharedBadge component is accessible from presentation', () => {
      const componentPath = join(
        projectDir,
        'presentations',
        'first-deck',
        'node_modules',
        '@supaslidev',
        'shared',
        'components',
        'SharedBadge.vue',
      );
      expect(existsSync(componentPath)).toBe(true);

      const content = readFileSync(componentPath, 'utf-8');
      expect(content).toContain('<template>');
      expect(content).toContain('shared-badge');
    });

    it('slides.md references shared addon', () => {
      const slidesPath = join(projectDir, 'presentations', 'first-deck', 'slides.md');
      const content = readFileSync(slidesPath, 'utf-8');
      expect(content).toContain("'@supaslidev/shared'");
    });
  });

  describe('typescript via nuxt layer', () => {
    let nuxtPrepareSucceeded = false;

    beforeAll(() => {
      // Strip inherited npm_config_* env vars so pnpm uses the project's own config
      const cleanEnv = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('npm_config_')),
      );

      execSync('pnpm exec nuxt prepare', {
        cwd: projectDir,
        stdio: 'pipe',
        timeout: 60000,
        env: cleanEnv,
      });
      nuxtPrepareSucceeded = true;
    }, 90000);

    it('nuxt prepare generates .nuxt directory', () => {
      expect(nuxtPrepareSucceeded).toBe(true);
      expect(existsSync(join(projectDir, '.nuxt'))).toBe(true);
    });

    it('nuxt prepare generates tsconfig.json', () => {
      expect(existsSync(join(projectDir, '.nuxt', 'tsconfig.json'))).toBe(true);
    });

    it('generated tsconfig contains compiler options', () => {
      const tsconfigPath = join(projectDir, '.nuxt', 'tsconfig.json');
      const content = readFileSync(tsconfigPath, 'utf-8');
      expect(content).toContain('compilerOptions');
    });
  });
});
