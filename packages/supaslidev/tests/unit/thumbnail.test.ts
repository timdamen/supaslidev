import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { thumbnail } from '../../src/cli/commands/thumbnail.js';
import {
  createTestProjectDir,
  createMockSlidevProject,
  createMockSupaslidevWorkspace,
  cleanupTestDir,
} from '../helpers/import-test-helpers.js';

vi.mock('../../src/cli/utils.js', () => ({
  findProjectRoot: vi.fn(),
  getPresentations: vi.fn(() => []),
  printAvailablePresentations: vi.fn(),
}));

const createMockChildProcess = () => {
  const emitter = new EventEmitter();
  return emitter as EventEmitter & { emit: (event: string, ...args: unknown[]) => boolean };
};

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => createMockChildProcess()),
}));

vi.mock('../../src/shared/optimize-thumbnail.js', () => ({
  optimizeThumbnail: vi.fn(async (pngPath: string) => pngPath.replace(/\.png$/, '.webp')),
}));

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`process.exit(${code})`);
});

describe('thumbnail CLI command', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestProjectDir('thumbnail');
    vi.clearAllMocks();
    mockExit.mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('exits when no project root is found', async () => {
    const { findProjectRoot } = await import('../../src/cli/utils.js');
    vi.mocked(findProjectRoot).mockReturnValue(null);

    await expect(thumbnail('my-deck')).rejects.toThrow('process.exit(1)');
    expect(console.error).toHaveBeenCalledWith('Error: Could not find a Supaslidev project.');
  });

  it('exits when presentation does not exist', async () => {
    const { findProjectRoot, getPresentations, printAvailablePresentations } =
      await import('../../src/cli/utils.js');
    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['other-deck']);

    await expect(thumbnail('non-existent')).rejects.toThrow('process.exit(1)');
    expect(console.error).toHaveBeenCalledWith('Error: Presentation "non-existent" not found');
    expect(printAvailablePresentations).toHaveBeenCalledWith(['other-deck']);
  });

  it('spawns slidev export with correct arguments', async () => {
    const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
    const { spawn } = await import('node:child_process');

    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    const presentationDir = join(workspaceDir, 'presentations', 'my-deck');
    createMockSlidevProject(presentationDir);
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['my-deck']);

    const child = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    // Don't await — thumbnail registers event listeners and returns
    thumbnail('my-deck');

    const slidevBin = join(presentationDir, 'node_modules', '.bin', 'slidev');
    const thumbnailsDir = join(workspaceDir, 'thumbnails');
    const outputBase = join(thumbnailsDir, 'my-deck');

    expect(spawn).toHaveBeenCalledWith(
      slidevBin,
      ['export', '--format', 'png', '--range', '1', '--output', outputBase],
      expect.objectContaining({ cwd: presentationDir }),
    );
  });

  it('spawns slidev export with custom output path', async () => {
    const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
    const { spawn } = await import('node:child_process');

    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    const presentationDir = join(workspaceDir, 'presentations', 'my-deck');
    createMockSlidevProject(presentationDir);
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['my-deck']);

    const child = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const customOutput = join(testDir, 'custom-output', 'thumb');
    thumbnail('my-deck', { output: customOutput });

    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      ['export', '--format', 'png', '--range', '1', '--output', customOutput],
      expect.any(Object),
    );
  });

  it('does not use shell option (avoids DEP0190)', async () => {
    const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
    const { spawn } = await import('node:child_process');

    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    createMockSlidevProject(join(workspaceDir, 'presentations', 'my-deck'));
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['my-deck']);

    const child = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    thumbnail('my-deck');

    const spawnOptions = vi.mocked(spawn).mock.calls[0][2] as Record<string, unknown>;
    expect(spawnOptions.shell).toBeUndefined();
  });

  it('creates thumbnails directory if it does not exist', async () => {
    const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
    const { spawn } = await import('node:child_process');

    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    createMockSlidevProject(join(workspaceDir, 'presentations', 'my-deck'));
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['my-deck']);

    const child = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    thumbnail('my-deck');

    const thumbnailsDir = join(workspaceDir, 'thumbnails');
    expect(existsSync(thumbnailsDir)).toBe(true);
  });

  it('logs banner with presentation name', async () => {
    const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
    const { spawn } = await import('node:child_process');

    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    createMockSlidevProject(join(workspaceDir, 'presentations', 'my-deck'));
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['my-deck']);

    const child = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    thumbnail('my-deck');

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Generating thumbnail: my-deck'),
    );
  });

  it('exits with error code on non-zero exit', async () => {
    const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
    const { spawn } = await import('node:child_process');

    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    createMockSlidevProject(join(workspaceDir, 'presentations', 'my-deck'));
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['my-deck']);

    const child = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    thumbnail('my-deck');

    expect(() => child.emit('close', 1)).toThrow('process.exit(1)');
  });

  it('renames slidev output directory PNG to flat file on success', async () => {
    const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
    const { spawn } = await import('node:child_process');

    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    createMockSlidevProject(join(workspaceDir, 'presentations', 'my-deck'));
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['my-deck']);

    const child = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const promise = thumbnail('my-deck');

    // Simulate Slidev creating a directory with 1.png inside
    const thumbnailsDir = join(workspaceDir, 'thumbnails');
    const outputDir = join(thumbnailsDir, 'my-deck');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, '1.png'), 'fake-png-data');

    child.emit('close', 0);
    await promise;

    // Should have been renamed to my-deck.png (then optimized to webp by mock)
    expect(existsSync(join(thumbnailsDir, 'my-deck.png'))).toBe(true);
  });

  it('logs success with output path after completion', async () => {
    const { findProjectRoot, getPresentations } = await import('../../src/cli/utils.js');
    const { spawn } = await import('node:child_process');

    const workspaceDir = join(testDir, 'workspace');
    createMockSupaslidevWorkspace(workspaceDir);
    createMockSlidevProject(join(workspaceDir, 'presentations', 'my-deck'));
    vi.mocked(findProjectRoot).mockReturnValue(workspaceDir);
    vi.mocked(getPresentations).mockReturnValue(['my-deck']);

    const child = createMockChildProcess();
    vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);

    const promise = thumbnail('my-deck');

    // Create the expected output so the rename logic runs
    const thumbnailsDir = join(workspaceDir, 'thumbnails');
    mkdirSync(join(thumbnailsDir, 'my-deck'), { recursive: true });
    writeFileSync(join(thumbnailsDir, 'my-deck', '1.png'), 'fake');

    child.emit('close', 0);
    await promise;

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Thumbnail generated!'));
  });
});
