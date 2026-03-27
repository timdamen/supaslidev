import { stopAllPresentationServers } from '../utils/process-manager';

export default defineNitroPlugin((nitroApp) => {
  const cleanup = () => {
    console.log('\nShutting down servers...');
    stopAllPresentationServers();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  nitroApp.hooks.hook('close', () => {
    stopAllPresentationServers();
  });
});
