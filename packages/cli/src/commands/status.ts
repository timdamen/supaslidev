import pc from 'picocolors';
import {
  readState,
  findWorkspaceRoot,
  getImportedPresentations,
  type ImportedPresentation,
} from '../state.js';
import { readManifest } from '../migrations/manifest.js';
import { hasMigration } from '../state.js';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { CLI_VERSION, fetchLatestVersion, compareVersions } from '../version.js';

export interface StatusResult {
  cliVersion: string;
  stateVersion: string | null;
  createdAt: string | null;
  lastUpdatedAt: string | null;
  pendingMigrations: number;
  latestVersion: string | null;
  updateAvailable: boolean;
  nativePresentations: string[];
  importedPresentations: ImportedPresentation[];
}

function getPendingMigrationsCount(workspaceDir: string): number {
  const migrationsDir = join(workspaceDir, '.supaslidev', 'migrations');
  const manifest = readManifest(migrationsDir);

  if (!manifest) {
    return 0;
  }

  return manifest.migrations.filter((m) => !hasMigration(workspaceDir, m.id)).length;
}

function getAllPresentations(workspaceDir: string): string[] {
  const presentationsDir = join(workspaceDir, 'presentations');

  if (!existsSync(presentationsDir)) {
    return [];
  }

  return readdirSync(presentationsDir)
    .filter((name: string) => {
      const fullPath = join(presentationsDir, name);
      return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'slides.md'));
    })
    .sort();
}

export async function getStatus(workspaceDir?: string): Promise<StatusResult> {
  const resolvedDir = workspaceDir ?? findWorkspaceRoot() ?? process.cwd();
  const state = readState(resolvedDir);

  const latestVersion = await fetchLatestVersion();
  const updateAvailable = latestVersion ? compareVersions(CLI_VERSION, latestVersion) : false;

  const importedPresentations = getImportedPresentations(resolvedDir);
  const importedNames = new Set(importedPresentations.map((p) => p.name));
  const allPresentations = getAllPresentations(resolvedDir);
  const nativePresentations = allPresentations.filter((name) => !importedNames.has(name));

  return {
    cliVersion: CLI_VERSION,
    stateVersion: state?.cliVersion ?? null,
    createdAt: state?.createdAt ?? null,
    lastUpdatedAt: state?.lastUpdatedAt ?? null,
    pendingMigrations: state ? getPendingMigrationsCount(resolvedDir) : 0,
    latestVersion,
    updateAvailable,
    nativePresentations,
    importedPresentations,
  };
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatStatus(status: StatusResult): string {
  const lines: string[] = [];

  lines.push(pc.bold('Supaslidev Status'));
  lines.push('─'.repeat(40));
  lines.push('');

  lines.push(`${pc.dim('CLI Version:')}      ${status.cliVersion}`);

  if (status.stateVersion) {
    lines.push(`${pc.dim('State Version:')}    ${status.stateVersion}`);
  } else {
    lines.push(`${pc.dim('State Version:')}    ${pc.yellow('Not initialized')}`);
  }

  lines.push('');

  if (status.createdAt) {
    lines.push(`${pc.dim('Created:')}          ${formatDate(status.createdAt)}`);
  }

  if (status.lastUpdatedAt) {
    lines.push(`${pc.dim('Last Updated:')}     ${formatDate(status.lastUpdatedAt)}`);
  }

  lines.push('');

  if (status.pendingMigrations > 0) {
    lines.push(`${pc.dim('Pending Migrations:')} ${pc.yellow(String(status.pendingMigrations))}`);
  } else {
    lines.push(`${pc.dim('Pending Migrations:')} ${pc.green('0')}`);
  }

  lines.push('');
  lines.push(pc.bold('Presentations'));
  lines.push('─'.repeat(40));

  lines.push('');
  lines.push(pc.dim('Native:'));
  if (status.nativePresentations.length === 0) {
    lines.push('  No native presentations');
  } else {
    for (const name of status.nativePresentations) {
      lines.push(`  ${name}`);
    }
  }

  lines.push('');
  lines.push(pc.dim('Imported:'));
  if (status.importedPresentations.length === 0) {
    lines.push('  No imported presentations');
  } else {
    for (const presentation of status.importedPresentations) {
      lines.push(`  ${pc.bold(presentation.name)}`);
      lines.push(`    ${pc.dim('Source:')} ${presentation.sourcePath}`);
      lines.push(`    ${pc.dim('Imported:')} ${formatDate(presentation.importedAt)}`);
    }
  }

  lines.push('');

  if (status.updateAvailable && status.latestVersion) {
    lines.push(pc.yellow(`Update available: ${status.cliVersion} → ${status.latestVersion}`));
    lines.push(pc.dim('  Run `pnpm add -g @supaslidev/cli` to update'));
  } else if (status.latestVersion) {
    lines.push(pc.green('✓ CLI is up to date'));
  } else {
    lines.push(pc.dim('Could not check for updates'));
  }

  return lines.join('\n');
}

export async function status(workspaceDir?: string): Promise<void> {
  const result = await getStatus(workspaceDir);
  console.log(formatStatus(result));
}
