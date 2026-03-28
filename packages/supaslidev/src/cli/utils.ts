import { dirname, join } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';

export function findProjectRoot(cwd: string = process.cwd()): string | null {
  let dir = cwd;

  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'presentations')) && existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = dirname(dir);
  }

  if (existsSync(join(cwd, 'presentations'))) {
    return cwd;
  }

  return null;
}

export function getPresentations(presentationsDir: string): string[] {
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

export function printAvailablePresentations(presentations: string[]): void {
  console.error('\nAvailable presentations:');

  if (presentations.length === 0) {
    console.error('  No presentations found');
  } else {
    for (const name of presentations) {
      console.error(`  ${name}`);
    }
  }
}
