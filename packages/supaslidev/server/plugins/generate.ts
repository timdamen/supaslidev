import { regeneratePresentationsJson } from '../../src/shared/presentations.js';
import { getPresentationsDir, getPresentationsJsonPath } from '../utils/config';

export default defineNitroPlugin(() => {
  const presentationsDir = getPresentationsDir();
  const presentationsJsonPath = getPresentationsJsonPath();

  console.log(`[generate] presentationsDir: ${presentationsDir}`);
  console.log(`[generate] presentationsJsonPath: ${presentationsJsonPath}`);

  regeneratePresentationsJson(presentationsDir, presentationsJsonPath);
});
