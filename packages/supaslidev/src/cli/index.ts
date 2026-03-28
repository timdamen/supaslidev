import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { dev } from './commands/dev.js';
import { create } from './commands/create.js';
import { present } from './commands/present.js';
import { exportPdf } from './commands/export.js';
import { importPresentation } from './commands/import.js';
import { deploy } from './commands/deploy.js';

const program = new Command();

program.name('supaslidev').description('Supaslidev presentation management CLI').version('0.1.0');

program
  .command('dev', { isDefault: true })
  .description('Start the Supaslidev UI and development server')
  .action(async () => {
    await dev();
  });

program
  .command('new')
  .description('Create a new presentation')
  .argument('[name]', 'Name of the presentation')
  .action(async (name?: string) => {
    await create(name);
  });

program
  .command('present')
  .description('Start a presentation dev server')
  .argument('<name>', 'Name of the presentation to start')
  .action(async (name: string) => {
    await present(name);
  });

program
  .command('export')
  .description('Export a presentation to PDF')
  .argument('<name>', 'Name of the presentation to export')
  .option('-o, --output <path>', 'Output path for the PDF')
  .action(async (name: string, options: { output?: string }) => {
    await exportPdf(name, options);
  });

program
  .command('import')
  .description('Import existing Sli.dev presentation(s)')
  .argument('<source>', 'Path to existing Slidev presentation directory')
  .option(
    '-n, --name <name>',
    'Name for the imported presentation (defaults to source directory name)',
  )
  .option('--no-install', 'Skip pnpm install after import')
  .action(async (source: string, options: { name?: string; install?: boolean }) => {
    await importPresentation(source, { name: options.name, install: options.install ?? true });
  });

program
  .command('deploy')
  .description('Build all presentations into a static deployable site')
  .option('-o, --output <dir>', 'Output directory for the deploy package')
  .option('--base <path>', 'Base path for the deployed site (default: /)')
  .action(async (options: { output?: string; base?: string }) => {
    try {
      await deploy(options);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

export async function run(): Promise<void> {
  await program.parseAsync();
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;

  try {
    const scriptPath = realpathSync(process.argv[1]);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return scriptPath === modulePath;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  run();
}
