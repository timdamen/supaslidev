import { getServersStatus } from '../../utils/process-manager';

export default defineEventHandler(() => {
  return getServersStatus();
});
