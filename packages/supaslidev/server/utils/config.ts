import { join } from 'node:path';

export function getProjectRoot(): string {
  return process.env.SUPASLIDEV_PROJECT_ROOT || join(process.cwd());
}

export function getPresentationsDir(): string {
  return process.env.SUPASLIDEV_PRESENTATIONS_DIR || join(getProjectRoot(), 'presentations');
}

export function getPresentationsJsonPath(): string {
  return join(getProjectRoot(), '.supaslidev', 'presentations.json');
}
