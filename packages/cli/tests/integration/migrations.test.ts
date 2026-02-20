import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createInitialState, writeState, readState, addMigration } from '../../src/state.js';
import {
  writeManifest,
  validateManifest,
  getMigrationOrder,
} from '../../src/migrations/manifest.js';
import { dryRun, run, formatDryRunOutput } from '../../src/migrations/runner.js';
import {
  createBackup,
  restoreBackup,
  deleteBackup,
  listBackups,
} from '../../src/migrations/backup.js';
import type { Migration, MigrationContext } from '../../src/migrations/types.js';

const TEST_DIR = join(tmpdir(), 'supaslidev-e2e-migrations');

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function createTestWorkspace(): string {
  const workspaceDir = join(TEST_DIR, 'test-workspace');
  mkdirSync(join(workspaceDir, '.supaslidev'), { recursive: true });

  const state = createInitialState();
  writeState(workspaceDir, state);

  writeFileSync(join(workspaceDir, 'package.json'), JSON.stringify({ name: 'test' }, null, 2));

  return workspaceDir;
}

function createMigrationsDir(workspaceDir: string): string {
  const migrationsDir = join(workspaceDir, '.supaslidev', 'migrations');
  mkdirSync(migrationsDir, { recursive: true });
  return migrationsDir;
}

describe('Migrations E2E', () => {
  beforeEach(() => {
    cleanTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanTestDir();
  });

  describe('Manifest Operations', () => {
    it('validates a valid manifest', () => {
      const manifest = {
        version: '1.0.0',
        migrations: [
          { id: 'migration-1', description: 'First migration', version: '0.1.0' },
          { id: 'migration-2', description: 'Second migration', version: '0.2.0' },
        ],
      };

      const errors = validateManifest(manifest);
      expect(errors).toEqual([]);
    });

    it('detects duplicate migration IDs', () => {
      const manifest = {
        version: '1.0.0',
        migrations: [
          { id: 'migration-1', description: 'First', version: '0.1.0' },
          { id: 'migration-1', description: 'Duplicate', version: '0.2.0' },
        ],
      };

      const errors = validateManifest(manifest);
      expect(errors).toContain('Duplicate migration id: migration-1');
    });

    it('computes correct migration order with dependencies', () => {
      const manifest = {
        version: '1.0.0',
        migrations: [
          { id: 'c', description: 'Third', version: '0.3.0', dependencies: ['b'] },
          { id: 'a', description: 'First', version: '0.1.0' },
          { id: 'b', description: 'Second', version: '0.2.0', dependencies: ['a'] },
        ],
      };

      const order = getMigrationOrder(manifest);

      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    });

    it('detects circular dependencies', () => {
      const manifest = {
        version: '1.0.0',
        migrations: [
          { id: 'a', description: 'First', version: '0.1.0', dependencies: ['b'] },
          { id: 'b', description: 'Second', version: '0.2.0', dependencies: ['a'] },
        ],
      };

      expect(() => getMigrationOrder(manifest)).toThrow(/circular dependency/i);
    });
  });

  describe('Dry Run', () => {
    it('shows pending migrations in dry run', () => {
      const workspaceDir = createTestWorkspace();
      const migrationsDir = createMigrationsDir(workspaceDir);

      const manifest = {
        version: '1.0.0',
        migrations: [
          { id: 'migration-1', description: 'First migration', version: '0.1.0' },
          { id: 'migration-2', description: 'Second migration', version: '0.2.0' },
        ],
      };
      writeManifest(migrationsDir, manifest);

      const results = dryRun({ workspaceDir, migrationsDir });

      expect(results).toHaveLength(2);
      expect(results[0].wouldApply).toBe(true);
      expect(results[0].alreadyApplied).toBe(false);
      expect(results[1].wouldApply).toBe(true);
    });

    it('marks already applied migrations correctly', () => {
      const workspaceDir = createTestWorkspace();
      const migrationsDir = createMigrationsDir(workspaceDir);

      const manifest = {
        version: '1.0.0',
        migrations: [
          { id: 'migration-1', description: 'First migration', version: '0.1.0' },
          { id: 'migration-2', description: 'Second migration', version: '0.2.0' },
        ],
      };
      writeManifest(migrationsDir, manifest);

      addMigration(workspaceDir, 'migration-1');

      const results = dryRun({ workspaceDir, migrationsDir });

      expect(results[0].alreadyApplied).toBe(true);
      expect(results[0].wouldApply).toBe(false);
      expect(results[1].alreadyApplied).toBe(false);
      expect(results[1].wouldApply).toBe(true);
    });

    it('formats dry run output correctly', () => {
      const results = [
        {
          migrationId: 'migration-1',
          description: 'First',
          wouldApply: true,
          alreadyApplied: false,
        },
        {
          migrationId: 'migration-2',
          description: 'Second',
          wouldApply: false,
          alreadyApplied: true,
        },
      ];

      const output = formatDryRunOutput(results);

      expect(output).toContain('Migration Preview');
      expect(output).toContain('migration-1');
      expect(output).toContain('Already applied: 1');
    });
  });

  describe('Apply Migrations', () => {
    it('applies migrations and updates state', async () => {
      const workspaceDir = createTestWorkspace();
      const migrationsDir = createMigrationsDir(workspaceDir);

      const manifest = {
        version: '1.0.0',
        migrations: [{ id: 'test-migration', description: 'Test migration', version: '0.1.0' }],
      };
      writeManifest(migrationsDir, manifest);

      const migrations: Migration[] = [
        {
          id: 'test-migration',
          description: 'Test migration',
          up: async (ctx: MigrationContext) => {
            writeFileSync(join(ctx.workspaceDir, 'migration-marker.txt'), 'applied');
          },
        },
      ];

      const result = await run({
        workspaceDir,
        migrationsDir,
        apply: true,
        migrations,
      });

      expect(result.success).toBe(true);
      expect(result.applied).toHaveLength(1);
      expect(existsSync(join(workspaceDir, 'migration-marker.txt'))).toBe(true);

      const state = readState(workspaceDir);
      expect(state?.appliedMigrations.some((m) => m.id === 'test-migration')).toBe(true);
    });

    it('rolls back on migration failure', async () => {
      const workspaceDir = createTestWorkspace();
      const migrationsDir = createMigrationsDir(workspaceDir);

      writeFileSync(join(workspaceDir, 'original.txt'), 'original content');

      const manifest = {
        version: '1.0.0',
        migrations: [
          { id: 'good-migration', description: 'Good migration', version: '0.1.0' },
          { id: 'bad-migration', description: 'Bad migration', version: '0.2.0' },
        ],
      };
      writeManifest(migrationsDir, manifest);

      const migrations: Migration[] = [
        {
          id: 'good-migration',
          description: 'Good migration',
          up: async (ctx: MigrationContext) => {
            writeFileSync(join(ctx.workspaceDir, 'original.txt'), 'modified by good migration');
          },
        },
        {
          id: 'bad-migration',
          description: 'Bad migration',
          up: async () => {
            throw new Error('Intentional failure');
          },
        },
      ];

      const result = await run({
        workspaceDir,
        migrationsDir,
        apply: true,
        migrations,
      });

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(result.failed?.migrationId).toBe('bad-migration');

      const restoredContent = readFileSync(join(workspaceDir, 'original.txt'), 'utf-8');
      expect(restoredContent).toBe('original content');
    });

    it('skips already applied migrations', async () => {
      const workspaceDir = createTestWorkspace();
      const migrationsDir = createMigrationsDir(workspaceDir);

      addMigration(workspaceDir, 'already-applied');

      const manifest = {
        version: '1.0.0',
        migrations: [
          { id: 'already-applied', description: 'Already applied', version: '0.1.0' },
          { id: 'new-migration', description: 'New migration', version: '0.2.0' },
        ],
      };
      writeManifest(migrationsDir, manifest);

      let alreadyAppliedCalled = false;
      const migrations: Migration[] = [
        {
          id: 'already-applied',
          description: 'Already applied',
          up: async () => {
            alreadyAppliedCalled = true;
          },
        },
        {
          id: 'new-migration',
          description: 'New migration',
          up: async (ctx: MigrationContext) => {
            writeFileSync(join(ctx.workspaceDir, 'new-marker.txt'), 'new');
          },
        },
      ];

      const result = await run({
        workspaceDir,
        migrationsDir,
        apply: true,
        migrations,
      });

      expect(result.success).toBe(true);
      expect(alreadyAppliedCalled).toBe(false);
      expect(result.applied).toHaveLength(1);
      expect(result.applied[0].migrationId).toBe('new-migration');
    });
  });

  describe('Backup and Restore', () => {
    it('creates a backup with all workspace files', () => {
      const workspaceDir = createTestWorkspace();

      writeFileSync(join(workspaceDir, 'test-file.txt'), 'test content');
      mkdirSync(join(workspaceDir, 'subdir'));
      writeFileSync(join(workspaceDir, 'subdir', 'nested.txt'), 'nested content');

      const backupId = createBackup(workspaceDir);

      expect(backupId).toMatch(/^backup-/);

      const backups = listBackups(workspaceDir);
      expect(backups).toHaveLength(1);
      expect(backups[0].files).toContain('test-file.txt');
      expect(backups[0].files).toContain('subdir/nested.txt');
    });

    it('excludes node_modules and .git from backups', () => {
      const workspaceDir = createTestWorkspace();

      mkdirSync(join(workspaceDir, 'node_modules'));
      writeFileSync(join(workspaceDir, 'node_modules', 'package.json'), '{}');

      mkdirSync(join(workspaceDir, '.git'));
      writeFileSync(join(workspaceDir, '.git', 'config'), 'git config');

      const backupId = createBackup(workspaceDir);
      const backups = listBackups(workspaceDir);

      const backup = backups.find((b) => b.backupId === backupId);
      expect(backup?.files.some((f) => f.startsWith('node_modules'))).toBe(false);
      expect(backup?.files.some((f) => f.startsWith('.git/'))).toBe(false);
    });

    it('restores workspace from backup', () => {
      const workspaceDir = createTestWorkspace();

      writeFileSync(join(workspaceDir, 'original.txt'), 'original content');

      const backupId = createBackup(workspaceDir);

      writeFileSync(join(workspaceDir, 'original.txt'), 'modified content');
      writeFileSync(join(workspaceDir, 'new-file.txt'), 'new file');

      restoreBackup(workspaceDir, backupId);

      const content = readFileSync(join(workspaceDir, 'original.txt'), 'utf-8');
      expect(content).toBe('original content');
    });

    it('deletes backup successfully', () => {
      const workspaceDir = createTestWorkspace();
      writeFileSync(join(workspaceDir, 'test.txt'), 'test');

      const backupId = createBackup(workspaceDir);
      expect(listBackups(workspaceDir)).toHaveLength(1);

      deleteBackup(workspaceDir, backupId);
      expect(listBackups(workspaceDir)).toHaveLength(0);
    });
  });

  describe('State Management', () => {
    it('creates initial state with correct structure', () => {
      const state = createInitialState();

      expect(state.cliVersion).toBe('0.1.0');
      expect(state.appliedMigrations).toEqual([]);
      expect(state.createdAt).toBeDefined();
      expect(state.lastUpdatedAt).toBeDefined();
    });

    it('persists and reads state correctly', () => {
      const workspaceDir = createTestWorkspace();

      const state = readState(workspaceDir);
      expect(state).not.toBeNull();
      expect(state?.cliVersion).toBe('0.1.0');
    });

    it('adds migrations to state', () => {
      const workspaceDir = createTestWorkspace();

      addMigration(workspaceDir, 'test-migration-1');
      addMigration(workspaceDir, 'test-migration-2');

      const state = readState(workspaceDir);
      expect(state?.appliedMigrations).toHaveLength(2);
      expect(state?.appliedMigrations[0].id).toBe('test-migration-1');
      expect(state?.appliedMigrations[1].id).toBe('test-migration-2');
    });

    it('does not add duplicate migrations', () => {
      const workspaceDir = createTestWorkspace();

      addMigration(workspaceDir, 'test-migration');
      addMigration(workspaceDir, 'test-migration');

      const state = readState(workspaceDir);
      expect(state?.appliedMigrations).toHaveLength(1);
    });
  });
});
