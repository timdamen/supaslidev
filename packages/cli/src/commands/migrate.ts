import pc from 'picocolors';
import { join } from 'node:path';
import { findWorkspaceRoot } from '../state.js';
import { dryRun, run, formatDryRunOutput, formatRunOutput } from '../migrations/runner.js';
import { loadMigrations, loadInteractiveMigration } from '../migrations/loader.js';
import { promptForCatalogSelection } from '../prompts.js';

export interface MigrateOptions {
  apply?: boolean;
}

interface MigrateResult {
  success: boolean;
  dryRun: boolean;
  migrationsToApply: number;
  migrationsApplied: number;
  output: string;
}

async function getMigrateResult(options: MigrateOptions = {}): Promise<MigrateResult> {
  const workspaceDir = findWorkspaceRoot();

  if (!workspaceDir) {
    return {
      success: false,
      dryRun: !options.apply,
      migrationsToApply: 0,
      migrationsApplied: 0,
      output: 'Not a Supaslidev workspace. No .supaslidev/state.json found.',
    };
  }

  const migrationsDir = join(workspaceDir, '.supaslidev', 'migrations');

  if (options.apply) {
    const { migrations } = await loadMigrations();
    const migrationOptions: Record<string, Record<string, unknown>> = {};

    const slidev51to52 = await loadInteractiveMigration('slidev-51-to-52');
    if (slidev51to52?.getAffectedPresentations) {
      const affected = slidev51to52.getAffectedPresentations(workspaceDir);
      if (affected.length > 0) {
        const selectionResult = await promptForCatalogSelection(affected);
        if (selectionResult.cancelled) {
          return {
            success: false,
            dryRun: false,
            migrationsToApply: 0,
            migrationsApplied: 0,
            output: 'Migration cancelled by user.',
          };
        }
        migrationOptions['slidev-51-to-52'] = {
          interactive: true,
          selectedForCatalog: selectionResult.selectedForCatalog,
        };
      }
    }

    const result = await run({
      workspaceDir,
      migrationsDir,
      apply: true,
      migrations,
      migrationOptions,
    });

    return {
      success: result.success,
      dryRun: false,
      migrationsToApply: result.applied.length + (result.failed ? 1 : 0),
      migrationsApplied: result.applied.length,
      output: formatRunOutput(result),
    };
  }

  try {
    const results = dryRun({
      workspaceDir,
      migrationsDir,
    });

    const toApply = results.filter((r) => r.wouldApply);

    return {
      success: true,
      dryRun: true,
      migrationsToApply: toApply.length,
      migrationsApplied: 0,
      output: formatDryRunOutput(results),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('No migrations.json found')) {
      return {
        success: true,
        dryRun: true,
        migrationsToApply: 0,
        migrationsApplied: 0,
        output: 'No migrations available. Workspace is up to date.',
      };
    }

    return {
      success: false,
      dryRun: true,
      migrationsToApply: 0,
      migrationsApplied: 0,
      output: `Error: ${message}`,
    };
  }
}

function formatMigrateOutput(result: MigrateResult): string {
  const lines: string[] = [];

  lines.push(pc.bold('Supaslidev Migrate'));
  lines.push('─'.repeat(40));
  lines.push('');

  if (result.dryRun) {
    lines.push(pc.cyan('Mode: Dry Run (no changes will be made)'));
    lines.push('');
  }

  lines.push(result.output);

  if (!result.success) {
    lines.push('');
    lines.push(pc.red('✗ Migration failed'));
  } else if (result.dryRun && result.migrationsToApply > 0) {
    lines.push('');
    lines.push(pc.yellow(`Run ${pc.bold('supaslidev migrate --apply')} to execute migrations.`));
  } else if (!result.dryRun && result.migrationsApplied > 0) {
    lines.push('');
    lines.push(pc.green('✓ All migrations applied successfully'));
  }

  return lines.join('\n');
}

export async function migrate(options: MigrateOptions = {}): Promise<void> {
  const result = await getMigrateResult(options);
  console.log(formatMigrateOutput(result));

  if (!result.success) {
    process.exit(1);
  }
}
