import { stopPresentationServer } from '../../utils/process-manager';

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, data: { message: 'Missing server id' } });
  }
  const result = stopPresentationServer(id);

  if (!result.success) {
    throw createError({ statusCode: 404, data: result });
  }

  return result;
});
