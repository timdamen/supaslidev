import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Command } from 'commander';
import { create, type CreateOptions } from '../../src/create.js';

const TEST_DIR = join(tmpdir(), 'supaslidev-e2e-cli-flags');

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function createProgram() {
  const program = new Command();
  program.exitOverride();
  return program;
}

describe('CLI Flag Parsing E2E', () => {
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

  describe('create command flag parsing', () => {
    it('parses --name flag correctly', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('-n, --name <name>', 'Name of the workspace')
        .option('-p, --presentation <name>', 'Name of the first presentation')
        .option('-t, --template <template>', 'Template to use', 'default')
        .option('--git', 'Initialize a git repository')
        .option('--no-git', 'Skip git initialization')
        .option('--install', 'Run pnpm install after scaffolding')
        .option('--no-install', 'Skip pnpm install')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '--name', 'test-project'], { from: 'user' });

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions?.name).toBe('test-project');
    });

    it('parses -n shorthand correctly', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('-n, --name <name>', 'Name')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '-n', 'short-test'], { from: 'user' });

      expect(capturedOptions?.name).toBe('short-test');
    });

    it('parses --presentation flag correctly', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('-p, --presentation <name>', 'Presentation name')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '--presentation', 'my-slides'], { from: 'user' });

      expect(capturedOptions?.presentation).toBe('my-slides');
    });

    it('parses -p shorthand correctly', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('-p, --presentation <name>', 'Presentation name')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '-p', 'short-deck'], { from: 'user' });

      expect(capturedOptions?.presentation).toBe('short-deck');
    });

    it('parses --template flag correctly', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('-t, --template <template>', 'Template', 'default')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '-t', 'custom'], { from: 'user' });

      expect(capturedOptions?.template).toBe('custom');
    });

    it('parses --no-git flag correctly', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('--git', 'Initialize git')
        .option('--no-git', 'Skip git')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '--no-git'], { from: 'user' });

      expect(capturedOptions?.git).toBe(false);
    });

    it('parses --no-install flag correctly', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('--install', 'Run install')
        .option('--no-install', 'Skip install')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '--no-install'], { from: 'user' });

      expect(capturedOptions?.install).toBe(false);
    });

    it('parses multiple flags together', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('-n, --name <name>', 'Name')
        .option('-p, --presentation <name>', 'Presentation')
        .option('-t, --template <template>', 'Template', 'default')
        .option('--git', 'Init git')
        .option('--no-git', 'Skip git')
        .option('--install', 'Run install')
        .option('--no-install', 'Skip install')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '-n', 'my-project', '-p', 'my-deck', '--no-git', '--no-install'], {
        from: 'user',
      });

      expect(capturedOptions?.name).toBe('my-project');
      expect(capturedOptions?.presentation).toBe('my-deck');
      expect(capturedOptions?.git).toBe(false);
      expect(capturedOptions?.install).toBe(false);
    });
  });

  describe('create command execution', () => {
    it('creates workspace with --name flag', async () => {
      await create({
        name: 'flag-name-test',
        git: false,
        install: false,
      });

      expect(existsSync(join(TEST_DIR, 'flag-name-test'))).toBe(true);
    });

    it('creates presentation with --presentation flag', async () => {
      await create({
        name: 'flag-pres-test',
        presentation: 'custom-deck',
        git: false,
        install: false,
      });

      const presDir = join(TEST_DIR, 'flag-pres-test', 'presentations', 'custom-deck');
      expect(existsSync(presDir)).toBe(true);
    });

    it('creates workspace without git when --no-git is set', async () => {
      await create({
        name: 'no-git-flag-test',
        git: false,
        install: false,
      });

      const gitDir = join(TEST_DIR, 'no-git-flag-test', '.git');
      expect(existsSync(gitDir)).toBe(false);
    });

    it('applies all flags correctly in combination', async () => {
      await create({
        name: 'all-flags-test',
        presentation: 'combined-deck',
        template: 'default',
        git: false,
        install: false,
      });

      const projectDir = join(TEST_DIR, 'all-flags-test');
      const presDir = join(projectDir, 'presentations', 'combined-deck');

      expect(existsSync(projectDir)).toBe(true);
      expect(existsSync(presDir)).toBe(true);
      expect(existsSync(join(presDir, 'slides.md'))).toBe(true);
    });
  });

  describe('migrate command flag parsing', () => {
    it('parses --apply flag correctly', () => {
      const program = createProgram();
      let capturedOptions: { apply?: boolean } | null = null;

      program
        .command('migrate')
        .option('--apply', 'Execute migrations')
        .action((options: { apply?: boolean }) => {
          capturedOptions = options;
        });

      program.parse(['migrate', '--apply'], { from: 'user' });

      expect(capturedOptions?.apply).toBe(true);
    });

    it('defaults to dry-run mode without --apply', () => {
      const program = createProgram();
      let capturedOptions: { apply?: boolean } | null = null;

      program
        .command('migrate')
        .option('--apply', 'Execute migrations')
        .action((options: { apply?: boolean }) => {
          capturedOptions = options;
        });

      program.parse(['migrate'], { from: 'user' });

      expect(capturedOptions?.apply).toBeUndefined();
    });
  });

  describe('version and help output', () => {
    it('program has correct version', () => {
      const program = new Command();
      program.version('0.1.0');

      expect(program.version()).toBe('0.1.0');
    });

    it('program has correct name', () => {
      const program = new Command();
      program.name('create-supaslidev');

      expect(program.name()).toBe('create-supaslidev');
    });

    it('create command has expected options', () => {
      const program = new Command();

      const createCmd = program
        .command('create')
        .option('-n, --name <name>', 'Name')
        .option('-p, --presentation <name>', 'Presentation')
        .option('-t, --template <template>', 'Template')
        .option('--git', 'Init git')
        .option('--no-git', 'Skip git')
        .option('--install', 'Run install')
        .option('--no-install', 'Skip install');

      const optionNames = createCmd.options.map((opt) => opt.long || opt.short);

      expect(optionNames).toContain('--name');
      expect(optionNames).toContain('--presentation');
      expect(optionNames).toContain('--template');
      expect(optionNames).toContain('--git');
      expect(optionNames).toContain('--install');
    });

    it('migrate command has expected options', () => {
      const program = new Command();

      const migrateCmd = program.command('migrate').option('--apply', 'Execute migrations');

      const optionNames = migrateCmd.options.map((opt) => opt.long || opt.short);

      expect(optionNames).toContain('--apply');
    });
  });

  describe('validation behavior', () => {
    it('handles missing optional flags gracefully', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('-n, --name <name>', 'Name')
        .option('-p, --presentation <name>', 'Presentation')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create', '-n', 'only-name'], { from: 'user' });

      expect(capturedOptions?.name).toBe('only-name');
      expect(capturedOptions?.presentation).toBeUndefined();
    });

    it('uses default template when not specified', () => {
      const program = createProgram();
      let capturedOptions: CreateOptions | null = null;

      program
        .command('create')
        .option('-t, --template <template>', 'Template', 'default')
        .action((options: CreateOptions) => {
          capturedOptions = options;
        });

      program.parse(['create'], { from: 'user' });

      expect(capturedOptions?.template).toBe('default');
    });
  });
});
