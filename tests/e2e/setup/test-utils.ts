import { spawn, ChildProcess, execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, Browser, BrowserType, BrowserContext } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../../..');
const TMP_DIR = join(ROOT_DIR, '.tmp');
const CLI_BINARY = join(ROOT_DIR, 'packages/cli/dist/cli.js');
const IS_WINDOWS = process.platform === 'win32';

const dashboardProcesses: Set<ChildProcess> = new Set();
let currentDashboardProcess: ChildProcess | null = null;

export function getTmpDir(): string {
  return TMP_DIR;
}

export function getCliBinaryPath(): string {
  return CLI_BINARY;
}

export function getBaseProjectPath(): string {
  return join(TMP_DIR, 'base-project');
}

export function getSupaslidevTarballPath(): string {
  const tarballPathFile = join(TMP_DIR, '.supaslidev-tarball-path');
  if (!existsSync(tarballPathFile)) {
    throw new Error(
      'Tarball path file not found. Did globalSetup run? Expected: ' + tarballPathFile,
    );
  }
  return readFileSync(tarballPathFile, 'utf-8').trim();
}

export function runCli(
  args: string,
  cwd: string,
  options?: { timeout?: number },
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI_BINARY}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: options?.timeout ?? 30000,
      env: { ...process.env, NO_COLOR: '1' },
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

export function scaffoldProject(name: string): string {
  const projectPath = join(TMP_DIR, name);

  if (existsSync(projectPath)) {
    rmSync(projectPath, { recursive: true, force: true });
  }

  mkdirSync(TMP_DIR, { recursive: true });

  try {
    execSync(
      `node "${CLI_BINARY}" create --name ${name} --presentation test-deck --no-git --no-install`,
      {
        cwd: TMP_DIR,
        stdio: 'pipe',
        shell: true,
        env: { ...process.env, NO_COLOR: '1' },
      },
    );
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `Failed to scaffold project: ${execError.message}\nstdout: ${execError.stdout}\nstderr: ${execError.stderr}`,
    );
  }

  if (!existsSync(join(projectPath, 'package.json'))) {
    throw new Error(
      `Scaffolding did not create expected files at ${projectPath}. Directory exists: ${existsSync(projectPath)}`,
    );
  }

  return projectPath;
}

export interface DashboardInfo {
  url: string;
  process: ChildProcess;
}

export async function startDashboard(projectPath: string): Promise<DashboardInfo> {
  const dashboardCliPath = join(ROOT_DIR, 'packages/supaslidev/src/cli/index.ts');

  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', dashboardCliPath, 'dev'], {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      shell: true,
      detached: !IS_WINDOWS,
    });

    currentDashboardProcess = proc;
    dashboardProcesses.add(proc);

    let output = '';
    let resolved = false;
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
    const urlPattern = /Local:\s+(https?:\/\/localhost:\d+\/?)/;

    const timeout = setTimeout(() => {
      if (!resolved && proc.pid) {
        killProcessTree(proc.pid);
        reject(new Error(`Dashboard startup timed out. Output: ${stripAnsi(output)}`));
      }
    }, 60000);

    const handleOutput = (data: Buffer) => {
      if (resolved) return;
      output += data.toString();
      const cleanOutput = stripAnsi(output);
      const match = cleanOutput.match(urlPattern);
      if (match) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: match[1].replace(/\/$/, ''), process: proc });
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

    proc.on('close', (code) => {
      if (!resolved && code !== 0) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Dashboard exited with code ${code}. Output: ${stripAnsi(output)}`));
      }
    });
  });
}

function killProcessTree(pid: number): void {
  if (IS_WINDOWS) {
    try {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Process may have already exited
    }
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Process may have already exited
      }
    }
  }
}

export function stopDashboard(): void {
  if (currentDashboardProcess?.pid) {
    killProcessTree(currentDashboardProcess.pid);
    dashboardProcesses.delete(currentDashboardProcess);
    currentDashboardProcess = null;
  }
}

async function stopProcess(proc: ChildProcess): Promise<void> {
  if (!proc.pid) return;

  const pid = proc.pid;
  killProcessTree(pid);

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => resolve(), 5000);
    proc.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    proc.on('close', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  if (IS_WINDOWS) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function stopDashboardAsync(): Promise<void> {
  if (currentDashboardProcess) {
    const proc = currentDashboardProcess;
    currentDashboardProcess = null;
    dashboardProcesses.delete(proc);
    await stopProcess(proc);
  }
}

export async function stopAllDashboards(): Promise<void> {
  const processes = Array.from(dashboardProcesses);
  dashboardProcesses.clear();
  currentDashboardProcess = null;

  await Promise.all(processes.map((proc) => stopProcess(proc)));
}

export async function waitForServer(
  url: string,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 30000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }

    const elapsed = Date.now() - startTime;
    const delay = elapsed < 5000 ? interval : interval * 2;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`Server at ${url} did not respond within ${timeout}ms`);
}

function rmSyncWithRetry(path: string, retries = 3, delay = 1000): void {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      return;
    } catch (error) {
      const isLastAttempt = attempt === retries - 1;
      const isWindowsLockError =
        IS_WINDOWS &&
        error instanceof Error &&
        'code' in error &&
        (error.code === 'EBUSY' || error.code === 'EPERM');

      if (isLastAttempt || !isWindowsLockError) {
        throw error;
      }

      const sleepSync = (ms: number) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
          // Busy wait
        }
      };
      sleepSync(delay);
    }
  }
}

export function cleanupTmpDir(): void {
  if (existsSync(TMP_DIR)) {
    rmSyncWithRetry(TMP_DIR);
  }
}

export function cleanupProject(name: string): void {
  const projectPath = join(TMP_DIR, name);
  if (existsSync(projectPath)) {
    rmSyncWithRetry(projectPath);
  }
}

export function patchSupaslidevDependency(projectPath: string): void {
  const tarballPath = getSupaslidevTarballPath();
  const packageJsonPath = join(projectPath, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (packageJson.devDependencies?.['supaslidev']) {
    packageJson.devDependencies['supaslidev'] = `file:${tarballPath}`;
  }
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

export function installDependencies(projectPath: string): void {
  patchSupaslidevDependency(projectPath);

  // Strip inherited npm_config_* env vars from the parent pnpm process
  // so the scaffolded project uses its own pnpm-workspace.yaml settings
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('npm_config_')),
  );

  execSync('pnpm install', {
    cwd: projectPath,
    stdio: 'inherit',
    env: { ...cleanEnv, npm_config_trust_policy: '' },
  });
}

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

const browsers: Record<BrowserName, BrowserType> = { chromium, firefox, webkit };

export function getBrowserType(): BrowserType {
  const browserName = (
    process.env.PLAYWRIGHT_BROWSER ||
    process.env.BROWSER ||
    'chromium'
  ).toLowerCase();
  const browserType = browsers[browserName as BrowserName];

  if (!browserType) {
    throw new Error(
      `Unknown browser: "${browserName}". Allowed values: ${Object.keys(browsers).join(', ')}`,
    );
  }

  return browserType;
}

export async function launchBrowser(): Promise<Browser> {
  const browserType = getBrowserType();
  return browserType.launch({ headless: true });
}

let sharedBrowser: Browser | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    const browserType = getBrowserType();
    sharedBrowser = await browserType.launch({ headless: true });
  }
  return sharedBrowser;
}

export async function createBrowserContext(): Promise<BrowserContext> {
  const browser = await getSharedBrowser();
  return browser.newContext();
}

export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export interface StandaloneSlidevProject {
  path: string;
  name: string;
}

export function createStandaloneSlidevProject(
  baseDir: string,
  name: string,
): StandaloneSlidevProject {
  const projectPath = join(baseDir, name);

  mkdirSync(projectPath, { recursive: true });

  const packageJson = {
    name,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'slidev',
      build: 'slidev build',
      export: 'slidev export',
    },
    dependencies: {
      '@slidev/cli': '^0.50.0',
      '@slidev/theme-default': '^0.25.0',
      vue: '^3.5.0',
    },
  };

  writeFileSync(join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

  const slidesContent = `---
theme: default
title: ${name}
---

# ${name}

Welcome to your presentation

---

# Slide 2

Content goes here
`;

  writeFileSync(join(projectPath, 'slides.md'), slidesContent);

  const gitignore = `node_modules
dist
.slidev
*.local
`;

  writeFileSync(join(projectPath, '.gitignore'), gitignore);

  return {
    path: projectPath,
    name,
  };
}
