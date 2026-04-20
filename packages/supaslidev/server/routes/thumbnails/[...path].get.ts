import { join, basename, relative } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import { getProjectRoot } from '../../utils/config';

export default defineEventHandler((event) => {
  const path = getRouterParam(event, 'path') || '';
  const projectRoot = getProjectRoot();
  const thumbnailsDir = join(projectRoot, 'thumbnails');
  const filePath = join(thumbnailsDir, path);

  const rel = relative(thumbnailsDir, filePath);
  if (
    rel.startsWith('..') ||
    !filePath.startsWith(thumbnailsDir) ||
    !existsSync(filePath) ||
    !filePath.endsWith('.png')
  ) {
    throw createError({ statusCode: 404, message: 'Not found' });
  }

  setHeader(event, 'Content-Type', 'image/png');
  setHeader(event, 'Content-Disposition', `inline; filename="${basename(filePath)}"`);

  return sendStream(event, createReadStream(filePath));
});
