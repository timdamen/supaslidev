import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(tmpdir(), 'supaslidev-cli-test');
const SUPASLIDEV_ROOT = join(__dirname, '../..');
const CLI_PATH = join(SUPASLIDEV_ROOT, 'src/cli/index.ts');

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function runCLI(
  args: string,
  cwd: string = TEST_DIR,
): { stdout: string; stderr: string; exitCode: number } {
  const tsxPath = join(SUPASLIDEV_ROOT, 'node_modules/.bin/tsx');
  try {
    const stdout = execSync(`"${tsxPath}" "${CLI_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      exitCode: error.status || 1,
    };
  }
}

describe('CLI Help & Version', () => {
  it('shows help with --help flag', () => {
    const { stdout } = runCLI('--help', process.cwd());
    expect(stdout).toContain('supaslidev');
    expect(stdout).toContain('Supaslidev');
  });

  it('shows version with --version flag', () => {
    const { stdout } = runCLI('--version', process.cwd());
    expect(stdout).toContain('0.1.0');
  });

  it('shows help for dev command', () => {
    const { stdout } = runCLI('dev --help', process.cwd());
    expect(stdout).toContain('dev');
    expect(stdout).toContain('Supaslidev');
  });

  it('shows help for new command', () => {
    const { stdout } = runCLI('new --help', process.cwd());
    expect(stdout).toContain('new');
    expect(stdout).toContain('presentation');
  });

  it('shows help for present command', () => {
    const { stdout } = runCLI('present --help', process.cwd());
    expect(stdout).toContain('present');
    expect(stdout).toContain('dev server');
  });

  it('shows help for export command', () => {
    const { stdout } = runCLI('export --help', process.cwd());
    expect(stdout).toContain('export');
    expect(stdout).toContain('PDF');
  });
});

describe('CLI Project Detection', () => {
  beforeEach(() => {
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('fails dev command when no project is found', () => {
    const { stderr, exitCode } = runCLI('dev', TEST_DIR);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Could not find a Supaslidev project');
  });

  it('fails new command when no project is found', () => {
    const { stderr, exitCode } = runCLI('new test-deck', TEST_DIR);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Could not find a Supaslidev project');
  });

  it('fails present command when no project is found', () => {
    const { stderr, exitCode } = runCLI('present test-deck', TEST_DIR);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Could not find a Supaslidev project');
  });

  it('fails export command when no project is found', () => {
    const { stderr, exitCode } = runCLI('export test-deck', TEST_DIR);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Could not find a Supaslidev project');
  });
});

describe('CLI Presentation Validation', () => {
  beforeEach(() => {
    cleanTestDir();
    mkdirSync(join(TEST_DIR, 'presentations', 'existing-deck'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'package.json'), '{}');
    writeFileSync(join(TEST_DIR, 'presentations', 'existing-deck', 'slides.md'), '# Test');
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('export command fails for non-existent presentation', () => {
    const { stderr, exitCode } = runCLI('export non-existent', TEST_DIR);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('not found');
    expect(stderr).toContain('Available presentations');
    expect(stderr).toContain('existing-deck');
  });

  it('export command shows empty list when no presentations exist', () => {
    rmSync(join(TEST_DIR, 'presentations', 'existing-deck'), { recursive: true });
    const { stderr } = runCLI('export any-deck', TEST_DIR);
    expect(stderr).toContain('No presentations found');
  });
});

describe('CLI Export Options', () => {
  beforeEach(() => {
    cleanTestDir();
    mkdirSync(join(TEST_DIR, 'presentations', 'my-deck'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'package.json'), '{}');
    writeFileSync(join(TEST_DIR, 'presentations', 'my-deck', 'slides.md'), '# Test');
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('export command accepts -o flag', () => {
    const { stdout } = runCLI('export --help', TEST_DIR);
    expect(stdout).toContain('-o');
    expect(stdout).toContain('--output');
  });
});
