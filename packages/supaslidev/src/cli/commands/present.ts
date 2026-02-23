import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { findProjectRoot } from '../utils.js';

function tryOpenBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];

  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      console.log(`\n  Open ${url} in your browser\n`);
    });
    child.unref();
  } catch {
    console.log(`\n  Open ${url} in your browser\n`);
  }
}

function getPresentations(presentationsDir: string): string[] {
  if (!existsSync(presentationsDir)) {
    return [];
  }

  return readdirSync(presentationsDir)
    .filter((name) => {
      const fullPath = join(presentationsDir, name);
      return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'slides.md'));
    })
    .sort();
}

function printAvailable(presentations: string[]): void {
  console.error('\nAvailable presentations:');

  if (presentations.length === 0) {
    console.error('  No presentations found');
  } else {
    presentations.forEach((name) => {
      console.error(`  ${name}`);
    });
  }
}

export async function present(name: string): Promise<void> {
  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    console.error('Error: Could not find a Supaslidev project.');
    console.error('Make sure you are in a directory with a "presentations" folder.');
    process.exit(1);
  }

  const presentationsDir = join(projectRoot, 'presentations');

  if (!existsSync(presentationsDir)) {
    console.error(`Error: No "presentations" folder found at ${presentationsDir}`);
    process.exit(1);
  }

  const presentations = getPresentations(presentationsDir);

  if (!presentations.includes(name)) {
    console.error(`Error: Presentation "${name}" not found`);
    printAvailable(presentations);
    process.exit(1);
  }

  const presentationPath = join(projectRoot, 'presentations', name);
  const slidevBin = join(presentationPath, 'node_modules', '.bin', 'slidev');

  console.log(`\nStarting dev server for ${name}...\n`);

  return new Promise((resolve, reject) => {
    const slidev = spawn(slidevBin, ['--open', 'false'], {
      cwd: presentationPath,
      stdio: ['inherit', 'pipe', 'inherit'],
      shell: true,
    });

    let browserOpened = false;

    slidev.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(text);

      if (!browserOpened) {
        const match = text.match(/https?:\/\/localhost:\d+/);
        if (match) {
          browserOpened = true;
          tryOpenBrowser(match[0]);
        }
      }
    });

    slidev.on('error', (err) => {
      console.error(`Failed to start dev server: ${err.message}`);
      reject(err);
    });

    slidev.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}
