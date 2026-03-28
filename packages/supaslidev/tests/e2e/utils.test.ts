import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findProjectRoot, getPresentations } from '../../src/cli/utils.js';

const TEST_DIR = join(tmpdir(), 'supaslidev-utils-test');

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('findProjectRoot', () => {
  beforeEach(() => {
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('returns null when no project structure is found', () => {
    const result = findProjectRoot(TEST_DIR);
    expect(result).toBeNull();
  });

  it('finds project root with presentations folder and package.json', () => {
    mkdirSync(join(TEST_DIR, 'presentations'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'package.json'), '{}');

    const result = findProjectRoot(TEST_DIR);
    expect(result).toBe(TEST_DIR);
  });

  it('finds project root with pnpm-workspace.yaml', () => {
    writeFileSync(join(TEST_DIR, 'pnpm-workspace.yaml'), 'packages:\n  - presentations/*');

    const result = findProjectRoot(TEST_DIR);
    expect(result).toBe(TEST_DIR);
  });

  it('finds project root from nested directory', () => {
    mkdirSync(join(TEST_DIR, 'presentations'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'package.json'), '{}');
    const nestedDir = join(TEST_DIR, 'presentations', 'my-deck');
    mkdirSync(nestedDir, { recursive: true });

    const result = findProjectRoot(nestedDir);
    expect(result).toBe(TEST_DIR);
  });

  it('finds project root when cwd has only presentations folder', () => {
    mkdirSync(join(TEST_DIR, 'presentations'), { recursive: true });

    const result = findProjectRoot(TEST_DIR);
    expect(result).toBe(TEST_DIR);
  });

  it('prefers presentations + package.json over just pnpm-workspace.yaml', () => {
    mkdirSync(join(TEST_DIR, 'presentations'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'package.json'), '{}');
    writeFileSync(join(TEST_DIR, 'pnpm-workspace.yaml'), 'packages:\n  - presentations/*');

    const result = findProjectRoot(TEST_DIR);
    expect(result).toBe(TEST_DIR);
  });
});

describe('getPresentations', () => {
  beforeEach(() => {
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('returns empty array when directory does not exist', () => {
    const result = getPresentations(join(TEST_DIR, 'nonexistent'));
    expect(result).toEqual([]);
  });

  it('returns empty array when directory is empty', () => {
    const presentationsDir = join(TEST_DIR, 'presentations');
    mkdirSync(presentationsDir);

    const result = getPresentations(presentationsDir);
    expect(result).toEqual([]);
  });

  it('returns empty array when subdirectories have no slides.md', () => {
    const presentationsDir = join(TEST_DIR, 'presentations');
    mkdirSync(join(presentationsDir, 'deck1'), { recursive: true });
    mkdirSync(join(presentationsDir, 'deck2'), { recursive: true });

    const result = getPresentations(presentationsDir);
    expect(result).toEqual([]);
  });

  it('returns presentations with slides.md files', () => {
    const presentationsDir = join(TEST_DIR, 'presentations');
    mkdirSync(join(presentationsDir, 'deck1'), { recursive: true });
    mkdirSync(join(presentationsDir, 'deck2'), { recursive: true });
    writeFileSync(join(presentationsDir, 'deck1', 'slides.md'), '# Deck 1');
    writeFileSync(join(presentationsDir, 'deck2', 'slides.md'), '# Deck 2');

    const result = getPresentations(presentationsDir);
    expect(result).toEqual(['deck1', 'deck2']);
  });

  it('excludes directories without slides.md', () => {
    const presentationsDir = join(TEST_DIR, 'presentations');
    mkdirSync(join(presentationsDir, 'valid-deck'), { recursive: true });
    mkdirSync(join(presentationsDir, 'invalid-deck'), { recursive: true });
    writeFileSync(join(presentationsDir, 'valid-deck', 'slides.md'), '# Valid');

    const result = getPresentations(presentationsDir);
    expect(result).toEqual(['valid-deck']);
  });

  it('excludes files (only includes directories)', () => {
    const presentationsDir = join(TEST_DIR, 'presentations');
    mkdirSync(join(presentationsDir, 'real-deck'), { recursive: true });
    writeFileSync(join(presentationsDir, 'real-deck', 'slides.md'), '# Real');
    writeFileSync(join(presentationsDir, 'not-a-deck.txt'), 'just a file');

    const result = getPresentations(presentationsDir);
    expect(result).toEqual(['real-deck']);
  });

  it('returns presentations sorted alphabetically', () => {
    const presentationsDir = join(TEST_DIR, 'presentations');
    mkdirSync(join(presentationsDir, 'zebra'), { recursive: true });
    mkdirSync(join(presentationsDir, 'alpha'), { recursive: true });
    mkdirSync(join(presentationsDir, 'middle'), { recursive: true });
    writeFileSync(join(presentationsDir, 'zebra', 'slides.md'), '# Z');
    writeFileSync(join(presentationsDir, 'alpha', 'slides.md'), '# A');
    writeFileSync(join(presentationsDir, 'middle', 'slides.md'), '# M');

    const result = getPresentations(presentationsDir);
    expect(result).toEqual(['alpha', 'middle', 'zebra']);
  });
});
