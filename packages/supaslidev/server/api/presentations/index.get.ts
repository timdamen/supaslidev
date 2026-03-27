import { existsSync, readFileSync } from 'node:fs';
import { getPresentationsJsonPath } from '../../utils/config';

export default defineEventHandler(() => {
  const presentationsJsonPath = getPresentationsJsonPath();

  if (existsSync(presentationsJsonPath)) {
    const data = readFileSync(presentationsJsonPath, 'utf-8');
    return JSON.parse(data);
  }

  return [];
});
