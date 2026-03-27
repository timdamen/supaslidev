import { join, basename, relative } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import { getProjectRoot } from '../../utils/config';

export default defineEventHandler((event) => {
  const path = getRouterParam(event, 'path') || '';
  const projectRoot = getProjectRoot();
  const exportsDir = join(projectRoot, 'exports');
  const filePath = join(exportsDir, path);

  const rel = relative(exportsDir, filePath);
  if (
    rel.startsWith('..') ||
    !filePath.startsWith(exportsDir) ||
    !existsSync(filePath) ||
    !filePath.endsWith('.pdf')
  ) {
    throw createError({ statusCode: 404, message: 'Not found' });
  }

  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', `inline; filename="${basename(filePath)}"`);

  return sendStream(event, createReadStream(filePath));
});
