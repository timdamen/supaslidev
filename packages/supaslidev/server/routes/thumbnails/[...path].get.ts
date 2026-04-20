import { join, basename, relative } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import { getProjectRoot } from '../../utils/config';

export default defineEventHandler((event) => {
  const path = getRouterParam(event, 'path') || '';
  const projectRoot = getProjectRoot();
  const thumbnailsDir = join(projectRoot, 'thumbnails');
  const filePath = join(thumbnailsDir, path);

  const rel = relative(thumbnailsDir, filePath);
  const isAllowedExt = filePath.endsWith('.png') || filePath.endsWith('.webp');
  if (
    rel.startsWith('..') ||
    !filePath.startsWith(thumbnailsDir) ||
    !existsSync(filePath) ||
    !isAllowedExt
  ) {
    throw createError({ statusCode: 404, message: 'Not found' });
  }

  const contentType = filePath.endsWith('.webp') ? 'image/webp' : 'image/png';
  setHeader(event, 'Content-Type', contentType);
  setHeader(event, 'Content-Disposition', `inline; filename="${basename(filePath)}"`);

  return sendStream(event, createReadStream(filePath));
});
