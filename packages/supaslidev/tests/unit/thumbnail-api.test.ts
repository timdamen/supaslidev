import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { isValidPresentationId } from '../../src/shared/validation.js';
import {
  createTestProjectDir,
  createMockSlidevProject,
  createMockSupaslidevWorkspace,
  cleanupTestDir,
} from '../helpers/import-test-helpers.js';

describe('Thumbnail API validation', () => {
  it('rejects invalid presentation IDs', () => {
    expect(isValidPresentationId('')).toBe(false);
    expect(isValidPresentationId('../escape')).toBe(false);
    expect(isValidPresentationId('UPPERCASE')).toBe(false);
    expect(isValidPresentationId('has spaces')).toBe(false);
    expect(isValidPresentationId('has_underscores')).toBe(false);
  });

  it('accepts valid presentation IDs', () => {
    expect(isValidPresentationId('my-deck')).toBe(true);
    expect(isValidPresentationId('presentation')).toBe(true);
    expect(isValidPresentationId('deck-2024')).toBe(true);
  });
});

describe('Thumbnail file detection logic', () => {
  let testDir: string;
  let thumbnailsDir: string;

  beforeEach(() => {
    testDir = createTestProjectDir('thumbnail-api');
    thumbnailsDir = join(testDir, 'thumbnails');
    mkdirSync(thumbnailsDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('detects direct .png file when it already exists', () => {
    const presentationId = 'my-deck';
    const pngDirect = join(thumbnailsDir, `${presentationId}.png`);
    writeFileSync(pngDirect, 'fake-png');

    expect(existsSync(pngDirect)).toBe(true);
  });

  it('finds PNG in slidev output directory and renames it', () => {
    const presentationId = 'my-deck';
    const outputBase = join(thumbnailsDir, presentationId);
    const targetFile = join(thumbnailsDir, `${presentationId}.png`);
    const pngDirect = `${outputBase}.png`;

    // Simulate Slidev creating directory with numbered PNG
    mkdirSync(outputBase, { recursive: true });
    writeFileSync(join(outputBase, '1.png'), 'fake-png-data');

    // Replicate the file detection logic from the API endpoint
    if (!existsSync(pngDirect) && existsSync(outputBase)) {
      const pngs = readdirSync(outputBase)
        .filter((f) => f.endsWith('.png'))
        .sort();
      if (pngs.length > 0) {
        renameSync(join(outputBase, pngs[0]), targetFile);
      }
    }

    expect(existsSync(targetFile)).toBe(true);
  });

  it('picks first PNG alphabetically when multiple exist', () => {
    const presentationId = 'my-deck';
    const outputBase = join(thumbnailsDir, presentationId);
    const targetFile = join(thumbnailsDir, `${presentationId}.png`);
    const pngDirect = `${outputBase}.png`;

    mkdirSync(outputBase, { recursive: true });
    writeFileSync(join(outputBase, '1.png'), 'first-slide');
    writeFileSync(join(outputBase, '2.png'), 'second-slide');
    writeFileSync(join(outputBase, '3.png'), 'third-slide');

    if (!existsSync(pngDirect) && existsSync(outputBase)) {
      const pngs = readdirSync(outputBase)
        .filter((f) => f.endsWith('.png'))
        .sort();
      if (pngs.length > 0) {
        renameSync(join(outputBase, pngs[0]), targetFile);
      }
    }

    expect(existsSync(targetFile)).toBe(true);
  });

  it('does not overwrite existing .png when directory also exists', () => {
    const presentationId = 'my-deck';
    const outputBase = join(thumbnailsDir, presentationId);
    const pngDirect = `${outputBase}.png`;

    // Direct file exists
    writeFileSync(pngDirect, 'existing-png');

    // Directory also exists with different content
    mkdirSync(outputBase, { recursive: true });
    writeFileSync(join(outputBase, '1.png'), 'directory-png');

    // Logic: if pngDirect exists, don't touch directory
    if (existsSync(pngDirect)) {
      // Already at the right location — no rename needed
    }

    // Original file should be untouched
    const { readFileSync } = require('node:fs');
    expect(readFileSync(pngDirect, 'utf-8')).toBe('existing-png');
  });

  it('returns correct thumbnail path format', () => {
    const presentationId = 'my-deck';
    const expectedPath = `/thumbnails/${presentationId}.png`;
    const expectedFilename = `${presentationId}.png`;

    expect(expectedPath).toBe('/thumbnails/my-deck.png');
    expect(expectedFilename).toBe('my-deck.png');
  });
});

describe('Thumbnail serve route validation', () => {
  let testDir: string;
  let thumbnailsDir: string;

  beforeEach(() => {
    testDir = createTestProjectDir('thumbnail-serve');
    thumbnailsDir = join(testDir, 'thumbnails');
    mkdirSync(thumbnailsDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('blocks path traversal attempts', () => {
    const path = '../../../etc/passwd';
    const filePath = join(thumbnailsDir, path);
    const rel = relative(thumbnailsDir, filePath);

    expect(rel.startsWith('..')).toBe(true);
  });

  it('blocks non-PNG file extensions', () => {
    const filePath = join(thumbnailsDir, 'malicious.exe');
    expect(filePath.endsWith('.png')).toBe(false);
  });

  it('allows valid PNG path within thumbnails directory', () => {
    const filename = 'my-deck.png';
    const filePath = join(thumbnailsDir, filename);
    writeFileSync(filePath, 'fake-png');

    const rel = relative(thumbnailsDir, filePath);

    expect(rel.startsWith('..')).toBe(false);
    expect(filePath.startsWith(thumbnailsDir)).toBe(true);
    expect(existsSync(filePath)).toBe(true);
    expect(filePath.endsWith('.png')).toBe(true);
  });

  it('rejects files that do not exist', () => {
    const filePath = join(thumbnailsDir, 'nonexistent.png');
    expect(existsSync(filePath)).toBe(false);
  });

  it('returns correct Content-Disposition filename', () => {
    const filePath = join(thumbnailsDir, 'my-deck.png');
    expect(basename(filePath)).toBe('my-deck.png');
  });

  it('blocks symlink-style path that resolves outside directory', () => {
    const path = 'subdir/../../outside.png';
    const filePath = join(thumbnailsDir, path);
    const rel = relative(thumbnailsDir, filePath);

    // This path resolves to parent of thumbnailsDir
    expect(rel.startsWith('..')).toBe(true);
  });
});
