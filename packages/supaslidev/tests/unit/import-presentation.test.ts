import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { importPresentation } from '../../src/cli/commands/import.js';
import {
  createTestProjectDir,
  createMockSlidevProject,
  createMockSupaslidevWorkspace,
  cleanupTestDir,
} from '../helpers/import-test-helpers.js';

vi.mock('../../src/cli/utils.js', () => ({
  findProjectRoot: vi.fn(),
  getPresentations: vi.fn(() => []),
}));

vi.mock('create-supaslidev', () => ({
  findWorkspaceRoot: vi.fn(() => null),
  addImportedPresentation: vi.fn(),
}));

const createMockChildProcess = () => {
  const emitter = new EventEmitter();
  return emitter as EventEmitter & { emit: (event: string, ...args: unknown[]) => boolean };
};

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => createMockChildProcess()),
}));

vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit(${code})`);
});

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('importPresentation', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestProjectDir('import-presentation');
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe('error handling', () => {
    it('exits with error when no project root is found', async () => {
      const { findProjectRoot } = await import('../../src/cli/utils.js');
      vi.mocked(findProjectRoot).mockReturnValue(null);

      const sourceDir = join(testDir, 'source');
      createMockSlidevProject(sourceDir);

      await expect(importPresentation(sourceDir)).rejects.toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: Could not find a Supaslidev project.');
    });

    it('exits with error when presentations folder does not exist', async () => {
      const { findProjectRoot } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      mkdirSync(workspaceDir, { recursive: true });
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);

      const sourceDir = join(testDir, 'source');
      createMockSlidevProject(sourceDir);

      await expect(importPresentation(sourceDir)).rejects.toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error: No "presentations" folder found'),
      );
    });

    it('exits with error when source directory does not exist', async () => {
      const { findProjectRoot } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);

      const nonExistentSource = join(testDir, 'does-not-exist');

      await expect(importPresentation(nonExistentSource)).rejects.toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error: Source directory does not exist'),
      );
    });

    it('exits with error when source is not a valid Slidev project', async () => {
      const { findProjectRoot } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);

      const invalidSource = join(testDir, 'invalid');
      mkdirSync(invalidSource, { recursive: true });

      await expect(importPresentation(invalidSource)).rejects.toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Error:'));
    });

    it('exits with error when presentation name is invalid', async () => {
      const { findProjectRoot } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);

      const sourceDir = join(testDir, 'source');
      createMockSlidevProject(sourceDir);

      await expect(importPresentation(sourceDir, { name: '-invalid-name-' })).rejects.toThrow(
        'process.exit(1)',
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error: Name must be lowercase alphanumeric'),
      );
    });

    it('exits with error when presentation already exists', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue(['existing-deck']);

      const sourceDir = join(testDir, 'source');
      createMockSlidevProject(sourceDir);

      await expect(importPresentation(sourceDir, { name: 'existing-deck' })).rejects.toThrow(
        'process.exit(1)',
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error: Presentation "existing-deck" already exists',
      );
    });
  });

  describe('successful import with install: false', () => {
    it('copies files to presentations directory', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const sourceDir = join(testDir, 'my-slides');
      createMockSlidevProject(sourceDir, {
        slidesContent: '# My Test Slides',
        additionalFiles: {
          'custom.css': 'body { color: red; }',
        },
      });

      await importPresentation(sourceDir, { name: 'test-deck', install: false });

      const destDir = join(workspaceDir, 'presentations', 'test-deck');
      expect(existsSync(destDir)).toBe(true);
      expect(existsSync(join(destDir, 'slides.md'))).toBe(true);
      expect(existsSync(join(destDir, 'custom.css'))).toBe(true);
      expect(readFileSync(join(destDir, 'slides.md'), 'utf-8')).toBe('# My Test Slides');
    });

    it('transforms package.json correctly', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const sourceDir = join(testDir, 'source-slides');
      createMockSlidevProject(sourceDir);

      await importPresentation(sourceDir, { name: 'imported-deck', install: false });

      const destDir = join(workspaceDir, 'presentations', 'imported-deck');
      const packageJson = JSON.parse(readFileSync(join(destDir, 'package.json'), 'utf-8'));

      expect(packageJson.name).toBe('@supaslidev/imported-deck');
      expect(packageJson.private).toBe(true);
      expect(packageJson.scripts.dev).toBe('slidev --open');
    });

    it('generates name from source directory when not provided', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const sourceDir = join(testDir, 'My_Slides_2024');
      createMockSlidevProject(sourceDir);

      await importPresentation(sourceDir, { install: false });

      const destDir = join(workspaceDir, 'presentations', 'my-slides-2024');
      expect(existsSync(destDir)).toBe(true);
    });

    it('logs skip message when install is false', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const sourceDir = join(testDir, 'slides');
      createMockSlidevProject(sourceDir);

      await importPresentation(sourceDir, { name: 'my-deck', install: false });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '\nSkipped pnpm install. Run "pnpm install" manually before using the presentation.',
      );
    });

    it('logs success messages', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const sourceDir = join(testDir, 'slides');
      createMockSlidevProject(sourceDir);

      await importPresentation(sourceDir, { name: 'my-deck', install: false });

      expect(mockConsoleLog).toHaveBeenCalledWith('\nPresentation imported successfully!');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Run "supaslidev present my-deck" to start a dev server.',
      );
    });

    it('calls addImportedPresentation when workspace root is found', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const { findWorkspaceRoot, addImportedPresentation } = await import('create-supaslidev');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);
      vi.mocked(findWorkspaceRoot).mockReturnValue(workspaceDir);

      const sourceDir = join(testDir, 'slides');
      createMockSlidevProject(sourceDir);

      await importPresentation(sourceDir, { name: 'tracked-deck', install: false });

      expect(addImportedPresentation).toHaveBeenCalledWith(
        workspaceDir,
        expect.objectContaining({
          name: 'tracked-deck',
          importedAt: expect.any(String),
        }),
      );
    });
  });

  describe('successful import with install: true', () => {
    it('runs pnpm install when install is true', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const { spawn } = await import('node:child_process');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      writeFileSync(join(workspaceDir, 'pnpm-workspace.yaml'), 'packages:\n  - presentations/*\n');
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const sourceDir = join(testDir, 'slides');
      createMockSlidevProject(sourceDir);

      const importPromise = importPresentation(sourceDir, { name: 'install-deck', install: true });

      await new Promise((resolve) => setImmediate(resolve));
      mockChild.emit('close', 0);

      await importPromise;

      expect(spawn).toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.objectContaining({
          cwd: workspaceDir,
          stdio: 'inherit',
        }),
      );
    });

    it('rejects when pnpm install fails with non-zero exit code', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const { spawn } = await import('node:child_process');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      writeFileSync(join(workspaceDir, 'pnpm-workspace.yaml'), 'packages:\n  - presentations/*\n');
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const sourceDir = join(testDir, 'slides');
      createMockSlidevProject(sourceDir);

      const importPromise = importPresentation(sourceDir, { name: 'fail-deck', install: true });

      await new Promise((resolve) => setImmediate(resolve));
      mockChild.emit('close', 1);

      await expect(importPromise).rejects.toThrow('pnpm install failed with exit code 1');
    });

    it('rejects when pnpm install emits an error', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const { spawn } = await import('node:child_process');
      const workspaceDir = join(testDir, 'workspace');
      createMockSupaslidevWorkspace(workspaceDir);
      writeFileSync(join(workspaceDir, 'pnpm-workspace.yaml'), 'packages:\n  - presentations/*\n');
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const sourceDir = join(testDir, 'slides');
      createMockSlidevProject(sourceDir);

      const importPromise = importPresentation(sourceDir, { name: 'error-deck', install: true });

      await new Promise((resolve) => setImmediate(resolve));
      mockChild.emit('error', new Error('spawn failed'));

      await expect(importPromise).rejects.toThrow('spawn failed');
    });

    it('uses project root when no pnpm workspace root is found', async () => {
      const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
      const { spawn } = await import('node:child_process');
      const workspaceDir = join(testDir, 'workspace-no-pnpm');
      createMockSupaslidevWorkspace(workspaceDir);
      vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
      vi.mocked(getPresentations).mockReturnValue([]);

      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const sourceDir = join(testDir, 'slides');
      createMockSlidevProject(sourceDir);

      const importPromise = importPresentation(sourceDir, { name: 'no-pnpm-deck', install: true });

      await new Promise((resolve) => setImmediate(resolve));
      mockChild.emit('close', 0);

      await importPromise;

      expect(spawn).toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.objectContaining({
          cwd: workspaceDir,
        }),
      );
    });
  });
});
