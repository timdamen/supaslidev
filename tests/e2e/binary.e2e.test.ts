import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getCliBinaryPath, runCli, getTmpDir } from './setup/test-utils.js';

describe('CLI Binary', () => {
  const cliBinary = getCliBinaryPath();
  const tmpDir = getTmpDir();

  it('has executable shebang', () => {
    const content = readFileSync(cliBinary, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('displays version with --version', () => {
    const result = runCli('--version', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('displays help with --help', () => {
    const result = runCli('--help', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('create-supaslidev');
    expect(result.stdout).toContain('create');
  });

  it('shows create command help with expected flags', () => {
    const result = runCli('create --help', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--name');
    expect(result.stdout).toContain('--presentation');
    expect(result.stdout).toContain('--no-git');
    expect(result.stdout).toContain('--no-install');
  });

  it('shows migrate command help', () => {
    const result = runCli('migrate --help', tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--apply');
  });

  it('exits with error for unknown command', () => {
    const result = runCli('nonexistent', tmpDir);
    expect(result.exitCode).not.toBe(0);
  });
});
