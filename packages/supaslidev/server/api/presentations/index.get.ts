import { existsSync, readFileSync } from 'node:fs';
import { getPresentationsJsonPath } from '../../utils/config';

export default defineEventHandler(() => {
  const presentationsJsonPath = getPresentationsJsonPath();

  if (existsSync(presentationsJsonPath)) {
    const data = readFileSync(presentationsJsonPath, 'utf-8');
    try {
      return JSON.parse(data);
    } catch (err) {
      console.error(`Failed to parse ${presentationsJsonPath}: ${(err as Error).message}`);
      return [];
    }
  }

  return [];
});
