import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { isValidPresentationId } from '../../../src/shared/validation.js';
import { getProjectRoot } from '../../utils/config';

export default defineEventHandler((event) => {
  const presentationId = getRouterParam(event, 'id')!;
  const projectRoot = getProjectRoot();

  if (!isValidPresentationId(presentationId)) {
    throw createError({
      statusCode: 400,
      data: { success: false, error: 'Invalid presentation id' },
    });
  }

  const slidesPath = join(projectRoot, 'presentations', presentationId, 'slides.md');
  if (!existsSync(slidesPath)) {
    throw createError({
      statusCode: 404,
      data: { success: false, error: 'Presentation not found' },
    });
  }

  spawn('code', [slidesPath], { detached: true, stdio: 'ignore' }).unref();
  return { success: true };
});
