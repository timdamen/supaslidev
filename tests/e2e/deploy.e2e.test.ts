import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserContext, Page } from 'playwright';
import { ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBaseProjectPath,
  getTmpDir,
  cleanupProject,
  createBrowserContext,
  installDependencies,
  waitForServer,
} from './setup/test-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../..');
const IS_WINDOWS = process.platform === 'win32';

function createSecondPresentation(projectPath: string): void {
  const secondDir = join(projectPath, 'presentations', 'second-deck');
  mkdirSync(secondDir, { recursive: true });

  writeFileSync(
    join(secondDir, 'package.json'),
    JSON.stringify(
      {
        name: '@supaslidev/second-deck',
        private: true,
        type: 'module',
        scripts: { dev: 'slidev --open', build: 'slidev build', export: 'slidev export' },
        dependencies: {
          '@slidev/cli': 'catalog:',
          '@slidev/theme-default': 'catalog:',
          vue: 'catalog:',
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(secondDir, 'slides.md'),
    `---
title: Second Deck
theme: default
---

# Second Deck

Welcome to the second presentation

---

## Slide 2

Content for slide two
`,
  );

  writeFileSync(join(secondDir, '.gitignore'), 'node_modules\ndist\n');
}

function runDeploy(
  projectPath: string,
  args: string = '',
): { stdout: string; stderr: string; exitCode: number } {
  const cliPath = join(ROOT_DIR, 'packages/supaslidev/src/cli/index.ts');
  const tsxPath = join(ROOT_DIR, 'node_modules/.bin/tsx');

  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('npm_config_')),
  );

  try {
    const stdout = execSync(`"${tsxPath}" "${cliPath}" deploy ${args}`, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 300000,
      env: { ...cleanEnv, NO_COLOR: '1' },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}

interface ServeInfo {
  url: string;
  process: ChildProcess;
}

async function startServe(dir: string): Promise<ServeInfo> {
  const npxPath = IS_WINDOWS ? 'npx.cmd' : 'npx';

  return new Promise((resolve, reject) => {
    const proc = spawn(npxPath, ['serve', dir, '-l', '0'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      detached: !IS_WINDOWS,
    });

    let output = '';
    let resolved = false;
    const urlPattern = /https?:\/\/localhost:\d+/;

    const timeout = setTimeout(() => {
      if (!resolved) {
        if (proc.pid) {
          try {
            IS_WINDOWS
              ? execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' })
              : process.kill(-proc.pid, 'SIGTERM');
          } catch {
            // ignore
          }
        }
        reject(new Error(`serve startup timed out. Output: ${output}`));
      }
    }, 30000);

    const handleOutput = (data: Buffer) => {
      if (resolved) return;
      output += data.toString();
      const match = output.match(urlPattern);
      if (match) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: match[0], process: proc });
      }
    };

    proc.stdout?.on('data', handleOutput);
    proc.stderr?.on('data', handleOutput);

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

function stopServe(info: ServeInfo): void {
  if (!info.process.pid) return;
  try {
    if (IS_WINDOWS) {
      execSync(`taskkill /pid ${info.process.pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-info.process.pid, 'SIGTERM');
    }
  } catch {
    // Process may have already exited
  }
}

describe('Deploy E2E', () => {
  const PROJECT_NAME = 'deploy-e2e-test';
  let projectPath: string;
  let deployOutputDir: string;

  beforeAll(async () => {
    cleanupProject(PROJECT_NAME);

    projectPath = join(getTmpDir(), PROJECT_NAME);
    deployOutputDir = join(projectPath, 'deploy');

    cpSync(getBaseProjectPath(), projectPath, { recursive: true });
    createSecondPresentation(projectPath);
    installDependencies(projectPath, { noFrozenLockfile: true });
  }, 180000);

  afterAll(() => {
    cleanupProject(PROJECT_NAME);
  });

  describe('CLI deploy command', () => {
    let result: { stdout: string; stderr: string; exitCode: number };

    beforeAll(() => {
      result = runDeploy(projectPath, `--output "${deployOutputDir}"`);
    }, 300000);

    it('exits with code 0', () => {
      expect(result.exitCode).toBe(0);
    });

    it('produces output directory', () => {
      expect(existsSync(deployOutputDir)).toBe(true);
    });

    it('builds all presentations', () => {
      expect(existsSync(join(deployOutputDir, 'presentations/test-deck/index.html'))).toBe(true);
      expect(existsSync(join(deployOutputDir, 'presentations/second-deck/index.html'))).toBe(true);
    });

    it('generates presentations.json with correct data', () => {
      const jsonPath = join(deployOutputDir, 'presentations.json');
      expect(existsSync(jsonPath)).toBe(true);

      const presentations = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      expect(presentations).toHaveLength(2);

      const ids = presentations.map((p: { id: string }) => p.id);
      expect(ids).toContain('test-deck');
      expect(ids).toContain('second-deck');

      for (const p of presentations) {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('title');
        expect(p).toHaveProperty('theme');
      }
    });

    it('copies Nuxt dashboard output', () => {
      expect(existsSync(join(deployOutputDir, 'index.html'))).toBe(true);
      expect(existsSync(join(deployOutputDir, '_nuxt'))).toBe(true);
    });

    it('generates vercel.json with rewrites', () => {
      const config = JSON.parse(readFileSync(join(deployOutputDir, 'vercel.json'), 'utf-8'));
      expect(config.rewrites).toBeDefined();
      expect(config.rewrites.length).toBeGreaterThanOrEqual(3); // 2 presentations + 1 catch-all

      const sources = config.rewrites.map((r: { source: string }) => r.source);
      expect(sources).toContain('/presentations/test-deck/(.*)');
      expect(sources).toContain('/presentations/second-deck/(.*)');
      expect(sources).toContain('/(.*)');
    });

    it('generates netlify.toml with redirects', () => {
      const content = readFileSync(join(deployOutputDir, 'netlify.toml'), 'utf-8');
      expect(content).toContain('/presentations/test-deck/*');
      expect(content).toContain('/presentations/second-deck/*');
      expect(content).toContain('status = 200');
    });

    it('generates package.json with serve script', () => {
      const pkg = JSON.parse(readFileSync(join(deployOutputDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts.start).toContain('serve');
    });

    it('prints success message with deployment instructions', () => {
      expect(result.stdout).toContain('Deploy package ready');
      expect(result.stdout).toContain('Vercel');
      expect(result.stdout).toContain('Netlify');
    });
  });

  describe('--base flag', () => {
    const baseOutputDir = join(getTmpDir(), PROJECT_NAME, 'deploy-base');

    beforeAll(() => {
      runDeploy(projectPath, `--output "${baseOutputDir}" --base /my-site/`);
    }, 300000);

    it('uses base path in vercel.json rewrites', () => {
      const config = JSON.parse(readFileSync(join(baseOutputDir, 'vercel.json'), 'utf-8'));
      const sources = config.rewrites.map((r: { source: string }) => r.source);
      expect(sources).toContain('/my-site/presentations/test-deck/(.*)');
      expect(sources).toContain('/my-site/(.*)');
    });

    it('uses base path in netlify.toml redirects', () => {
      const content = readFileSync(join(baseOutputDir, 'netlify.toml'), 'utf-8');
      expect(content).toContain('/my-site/presentations/test-deck/*');
      expect(content).toContain('from = "/my-site/*"');
    });
  });

  describe('static site serves correctly', () => {
    let serveInfo: ServeInfo;
    let serveUrl: string;
    let context: BrowserContext;
    let page: Page;

    beforeAll(async () => {
      serveInfo = await startServe(deployOutputDir);
      serveUrl = serveInfo.url;
      await waitForServer(serveUrl);

      context = await createBrowserContext();
      const browserName = (process.env.BROWSER || 'chromium').toLowerCase();
      if (browserName === 'chromium') {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      }
      page = await context.newPage();
    }, 60000);

    afterAll(async () => {
      await context?.close();
      stopServe(serveInfo);
    });

    it('dashboard loads and shows presentations', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      const cards = page.locator('.card');
      expect(await cards.count()).toBe(2);

      const titles = await page.locator('.card-title').allTextContents();
      expect(titles).toContain('test-deck');
      expect(titles).toContain('Second Deck');
    });

    it('deploy mode is active in runtime config', async () => {
      // Check that the inline script in the HTML contains deployMode:true
      const html = await page.content();
      expect(html).toContain('deployMode:true');
    });

    it('new and import buttons are visible in deploy mode', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      const newButton = page.locator('.btn-new');
      expect(await newButton.count()).toBe(1);

      const importButton = page.locator('button:has-text("import")');
      expect(await importButton.count()).toBe(1);
    });

    it('new button shows deploy demo toast when clicked', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      await page.locator('.btn-new').click();
      await page.waitForTimeout(500);

      const toast = page.locator('text=Dev Mode Only');
      expect(await toast.count()).toBeGreaterThan(0);
    });

    it('dev export and edit buttons are visible on cards', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      const devButton = page.locator('.card button:has-text("dev")');
      expect(await devButton.count()).toBeGreaterThan(0);

      const exportButton = page.locator('.card button:has-text("export")');
      expect(await exportButton.count()).toBeGreaterThan(0);

      const editButton = page.locator('.card button:has-text("edit")');
      expect(await editButton.count()).toBeGreaterThan(0);
    });

    it('dev button shows deploy demo toast when clicked', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      await page.locator('.card button:has-text("dev")').first().click();
      await page.waitForTimeout(500);

      const toast = page.locator('text=Dev Mode Only');
      expect(await toast.count()).toBeGreaterThan(0);
    });

    it('idle badges are visible in deploy mode', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      const idleBadge = page.locator('.terminal-badge:has-text("idle")');
      expect(await idleBadge.count()).toBeGreaterThan(0);
    });

    it('command palette shows all groups including export and edit', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      await page.keyboard.press('Control+k');
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      const dialogText = await page.locator('[role="dialog"]').textContent();
      expect(dialogText).toContain('Export >');
      expect(dialogText).toContain('Edit >');
      expect(dialogText).toContain('Present >');
    });

    it('command palette shows new and import actions', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      await page.keyboard.press('Control+k');
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      const dialogText = await page.locator('[role="dialog"]').textContent();
      expect(dialogText).toContain('New');
      expect(dialogText).toContain('Import');
    });

    it('search filters presentations', async () => {
      await page.goto(serveUrl);
      await page.waitForSelector('.card', { timeout: 15000 });

      const searchInput = page.locator('.filter-input input');
      await searchInput.fill('second');
      await page.waitForTimeout(400);

      const cards = page.locator('.card');
      expect(await cards.count()).toBe(1);

      const title = await cards.first().locator('.card-title').textContent();
      expect(title).toBe('Second Deck');
    });
  });

  describe('static Slidev presentations load', () => {
    let serveInfo: ServeInfo;
    let serveUrl: string;

    beforeAll(async () => {
      serveInfo = await startServe(deployOutputDir);
      serveUrl = serveInfo.url;
      await waitForServer(serveUrl);
    }, 60000);

    afterAll(() => {
      stopServe(serveInfo);
    });

    it('test-deck presentation loads', async () => {
      const response = await fetch(`${serveUrl}/presentations/test-deck/`);
      expect(response.ok).toBe(true);

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('second-deck presentation loads', async () => {
      const response = await fetch(`${serveUrl}/presentations/second-deck/`);
      expect(response.ok).toBe(true);

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('presentations.json is accessible', async () => {
      const response = await fetch(`${serveUrl}/presentations.json`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
    });
  });

  describe('error handling', () => {
    it('fails when no presentations exist', () => {
      const emptyProject = join(getTmpDir(), 'deploy-empty-test');
      mkdirSync(join(emptyProject, 'presentations'), { recursive: true });
      writeFileSync(join(emptyProject, 'package.json'), '{"name":"empty","private":true}');

      const result = runDeploy(emptyProject);

      expect(result.exitCode).not.toBe(0);
    });
  });
});
