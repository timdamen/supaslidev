import { Command } from 'commander';
import { create, type CreateOptions } from './create.js';
import { status } from './commands/status.js';
import { migrate, type MigrateOptions } from './commands/migrate.js';
import { update } from './commands/update.js';
import { startBackgroundUpdateCheck } from './background-update.js';
import { CLI_VERSION } from './version.js';

const program = new Command();

program
  .name('create-supaslidev')
  .description('CLI tool for scaffolding Supaslidev presentations')
  .version(CLI_VERSION);

program
  .command('create', { isDefault: true })
  .description('Create a new Supaslidev workspace')
  .option('-n, --name <name>', 'Name of the workspace')
  .option('-p, --presentation <name>', 'Name of the first presentation')
  .option('-t, --template <template>', 'Template to use', 'default')
  .option('--git', 'Initialize a git repository')
  .option('--no-git', 'Skip git initialization')
  .option('--install', 'Run pnpm install after scaffolding')
  .option('--no-install', 'Skip pnpm install')
  .action(async (options: CreateOptions) => {
    await create(options);
  });

program
  .command('status')
  .description('Show project status and check for updates')
  .action(async () => {
    await status();
  });

program
  .command('migrate')
  .description('Run migrations to update the workspace')
  .option('--apply', 'Execute migrations (default is dry-run mode)')
  .action(async (options: MigrateOptions) => {
    await migrate(options);
  });

program
  .command('update')
  .description('Check for CLI updates')
  .action(async () => {
    await update();
  });

export async function run(): Promise<void> {
  startBackgroundUpdateCheck();
  await program.parseAsync();
}

import { basename } from 'node:path';

const scriptName = process.argv[1] ? basename(process.argv[1]) : '';
if (scriptName === 'cli.js') {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
