import { validatePaths } from '../../../src/shared/index.js';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!Array.isArray(body.paths)) {
    throw createError({
      statusCode: 400,
      data: { message: 'paths must be an array' },
    });
  }

  return validatePaths(body.paths);
});
