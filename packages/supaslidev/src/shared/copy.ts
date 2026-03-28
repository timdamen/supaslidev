import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { shouldIgnore } from './validation.js';

export function copyDirectorySelective(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });

  const entries = readdirSync(source);

  for (const entry of entries) {
    if (shouldIgnore(entry)) {
      continue;
    }

    const sourcePath = join(source, entry);
    const destPath = join(destination, entry);
    const stat = statSync(sourcePath);

    if (stat.isDirectory()) {
      cpSync(sourcePath, destPath, {
        recursive: true,
        filter: (src) => !shouldIgnore(basename(src)),
      });
    } else {
      cpSync(sourcePath, destPath);
    }
  }
}
