import { stopAllPresentationServers } from '../../utils/process-manager';

export default defineEventHandler(() => {
  return stopAllPresentationServers();
});
