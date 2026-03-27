import { startPresentationServer } from '../../utils/process-manager';
import { getProjectRoot } from '../../utils/config';

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')!;
  const projectRoot = getProjectRoot();
  const result = startPresentationServer(id, projectRoot);

  if (!result.success) {
    throw createError({ statusCode: 500, data: result });
  }

  return result;
});
