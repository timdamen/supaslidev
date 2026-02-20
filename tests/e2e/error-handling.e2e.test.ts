import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { scaffoldProject, cleanupProject } from './setup/test-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../..');
const DASHBOARD_CLI_PATH = join(ROOT_DIR, 'packages/supaslidev/src/cli/index.ts');

function getTsxPath(): string {
  return join(ROOT_DIR, 'node_modules/.bin/tsx');
}

function runDashboardCli(
  args: string,
  cwd: string,
): { stdout: string; stderr: string; exitCode: number } {
  const tsxPath = getTsxPath();
  try {
    const stdout = execSync(`"${tsxPath}" "${DASHBOARD_CLI_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      status?: number;
    };
    return {
      stdout: execError.stdout?.toString() ?? '',
      stderr: execError.stderr?.toString() ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}

function runDevScript(
  name: string,
  projectPath: string,
): { stdout: string; stderr: string; exitCode: number } {
  const scriptPath = join(projectPath, 'scripts', 'dev-presentation.mjs');
  try {
    const stdout = execSync(`node "${scriptPath}" ${name}`, {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      status?: number;
    };
    return {
      stdout: execError.stdout?.toString() ?? '',
      stderr: execError.stderr?.toString() ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}

describe('Error Handling E2E', () => {
  const TEST_PROJECT_NAME = 'error-handling-e2e-test';
  let projectPath: string;
  let scaffoldingSucceeded = false;

  beforeAll(() => {
    cleanupProject(TEST_PROJECT_NAME);
    try {
      projectPath = scaffoldProject(TEST_PROJECT_NAME);
      scaffoldingSucceeded = true;
    } catch {
      scaffoldingSucceeded = false;
    }
  });

  afterAll(() => {
    cleanupProject(TEST_PROJECT_NAME);
  });

  describe('invalid presentation name', () => {
    it('rejects presentation name with uppercase letters', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const result = runDashboardCli('new InvalidName', projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('lowercase');
    });

    it('rejects presentation name with special characters', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const result = runDashboardCli('new invalid_name!', projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('alphanumeric');
    });

    it('rejects presentation name starting with hyphen', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const result = runDashboardCli('new -- -invalid', projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('hyphen');
    });

    it('rejects presentation name ending with hyphen', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const result = runDashboardCli('new invalid-', projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('hyphen');
    });
  });

  describe('duplicate presentation name', () => {
    it('rejects creating presentation with existing name', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const existingPresentation = 'test-deck';
      const presentationPath = join(projectPath, 'presentations', existingPresentation);
      expect(existsSync(presentationPath)).toBe(true);

      const result = runDashboardCli(`new ${existingPresentation}`, projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('already exists');
    });
  });

  describe('non-existent presentation', () => {
    it('dev script fails for non-existent presentation', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const result = runDevScript('non-existent-deck', projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('not found');
      expect(result.stderr).toContain('Available presentations');
    });

    it('dev script shows available presentations in error', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const result = runDevScript('missing-deck', projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('test-deck');
    });

    it('export command fails for non-existent presentation', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const result = runDashboardCli('export non-existent-deck', projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('not found');
      expect(result.stderr).toContain('Available presentations');
    });

    it('deploy command fails for non-existent presentation', () => {
      expect(scaffoldingSucceeded, 'Scaffolding must succeed before running dependent tests').toBe(
        true,
      );

      const result = runDashboardCli('deploy non-existent-deck', projectPath);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('not found');
      expect(result.stderr).toContain('Available presentations');
    });
  });

  describe('project not found', () => {
    const ISOLATED_DIR = join(tmpdir(), 'supaslidev-isolated-test-' + Date.now());

    beforeAll(() => {
      mkdirSync(ISOLATED_DIR, { recursive: true });
    });

    afterAll(() => {
      if (existsSync(ISOLATED_DIR)) {
        rmSync(ISOLATED_DIR, { recursive: true, force: true });
      }
    });

    it('dev command fails when no project is found', () => {
      const result = runDashboardCli('dev', ISOLATED_DIR);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Could not find a Supaslidev project');
    });

    it('create command fails when no project is found', () => {
      const result = runDashboardCli('new my-deck', ISOLATED_DIR);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Could not find a Supaslidev project');
    });

    it('export command fails when no project is found', () => {
      const result = runDashboardCli('export my-deck', ISOLATED_DIR);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Could not find a Supaslidev project');
    });

    it('deploy command fails when no project is found', () => {
      const result = runDashboardCli('deploy my-deck', ISOLATED_DIR);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Could not find a Supaslidev project');
    });
  });
});
