import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_DIR = join(__dirname, '../../../../playground');

describe('Dashboard Integration E2E (Playground)', () => {
  beforeAll(() => {
    if (!existsSync(PLAYGROUND_DIR)) {
      throw new Error(`Playground directory not found at ${PLAYGROUND_DIR}`);
    }
  });

  describe('Playground Structure', () => {
    it('has valid Supaslidev workspace structure', () => {
      expect(existsSync(join(PLAYGROUND_DIR, 'package.json'))).toBe(true);
      expect(existsSync(join(PLAYGROUND_DIR, 'pnpm-workspace.yaml'))).toBe(true);
      expect(existsSync(join(PLAYGROUND_DIR, '.supaslidev', 'state.json'))).toBe(true);
      expect(existsSync(join(PLAYGROUND_DIR, 'presentations'))).toBe(true);
    });

    it('has valid state.json', () => {
      const statePath = join(PLAYGROUND_DIR, '.supaslidev', 'state.json');
      const state = JSON.parse(readFileSync(statePath, 'utf-8'));

      expect(state.cliVersion).toBeDefined();
      expect(state.createdAt).toBeDefined();
      expect(state.lastUpdatedAt).toBeDefined();
      expect(Array.isArray(state.appliedMigrations)).toBe(true);
    });

    it('has at least one presentation', () => {
      const presentationsDir = join(PLAYGROUND_DIR, 'presentations');
      const presentations = readdirSync(presentationsDir).filter((name) => {
        const fullPath = join(presentationsDir, name);
        return statSync(fullPath).isDirectory();
      });

      expect(presentations.length).toBeGreaterThan(0);
    });
  });

  describe('Presentation Structure', () => {
    function getAllPresentationDirs(): string[] {
      const presentationsDir = join(PLAYGROUND_DIR, 'presentations');
      return readdirSync(presentationsDir).filter((name) => {
        const fullPath = join(presentationsDir, name);
        return statSync(fullPath).isDirectory();
      });
    }

    function getPresentationsWithSlides(): string[] {
      return getAllPresentationDirs().filter((name) => {
        const fullPath = join(PLAYGROUND_DIR, 'presentations', name);
        return existsSync(join(fullPath, 'slides.md'));
      });
    }

    it('each presentation has slides.md', () => {
      const presentations = getAllPresentationDirs();

      for (const name of presentations) {
        const slidesPath = join(PLAYGROUND_DIR, 'presentations', name, 'slides.md');
        expect(existsSync(slidesPath)).toBe(true);
      }
    });

    it('each presentation has package.json', () => {
      const presentations = getPresentationsWithSlides();

      for (const name of presentations) {
        const packagePath = join(PLAYGROUND_DIR, 'presentations', name, 'package.json');
        expect(existsSync(packagePath)).toBe(true);
      }
    });

    it('presentation package.json has correct structure', () => {
      const presentations = getPresentationsWithSlides();

      for (const name of presentations) {
        const packagePath = join(PLAYGROUND_DIR, 'presentations', name, 'package.json');
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

        expect(packageJson.name).toBe(`@supaslidev/${name}`);
        expect(packageJson.private).toBe(true);
        expect(packageJson.scripts).toBeDefined();
        expect(packageJson.scripts.dev).toBeDefined();
      }
    });

    it('slides.md has valid frontmatter', () => {
      const presentations = getPresentationsWithSlides();

      for (const name of presentations) {
        const slidesPath = join(PLAYGROUND_DIR, 'presentations', name, 'slides.md');
        const content = readFileSync(slidesPath, 'utf-8');

        expect(content.startsWith('---')).toBe(true);
        expect(content).toContain('theme:');
      }
    });
  });

  describe('CLI State Integration', () => {
    it('can read workspace state from playground', async () => {
      const { readState, findWorkspaceRoot } = await import('../../src/state.js');

      const workspaceRoot = findWorkspaceRoot(PLAYGROUND_DIR);
      expect(workspaceRoot).toBe(PLAYGROUND_DIR);

      const state = readState(PLAYGROUND_DIR);
      expect(state).not.toBeNull();
      expect(state?.cliVersion).toBeDefined();
    });

    it('can check migration status from playground', async () => {
      const { hasMigration, readState } = await import('../../src/state.js');

      const state = readState(PLAYGROUND_DIR);
      expect(state).not.toBeNull();

      const hasNonExistentMigration = hasMigration(PLAYGROUND_DIR, 'non-existent-migration');
      expect(hasNonExistentMigration).toBe(false);
    });
  });

  describe('Dashboard Project Detection', () => {
    it('detects project by presentations folder', () => {
      function findProjectRoot(startDir: string): string | null {
        let dir = startDir;
        const path = require('node:path');

        while (dir !== path.dirname(dir)) {
          if (existsSync(join(dir, 'presentations')) && existsSync(join(dir, 'package.json'))) {
            return dir;
          }
          if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
            return dir;
          }
          dir = path.dirname(dir);
        }

        if (existsSync(join(startDir, 'presentations'))) {
          return startDir;
        }

        return null;
      }

      const projectRoot = findProjectRoot(PLAYGROUND_DIR);
      expect(projectRoot).toBe(PLAYGROUND_DIR);
    });

    it('detects project by pnpm-workspace.yaml', () => {
      const workspaceYamlPath = join(PLAYGROUND_DIR, 'pnpm-workspace.yaml');
      expect(existsSync(workspaceYamlPath)).toBe(true);
    });
  });

  describe('Migration Readiness', () => {
    it('workspace is ready for migrations', () => {
      const stateDir = join(PLAYGROUND_DIR, '.supaslidev');
      expect(existsSync(stateDir)).toBe(true);

      const statePath = join(stateDir, 'state.json');
      expect(existsSync(statePath)).toBe(true);

      const state = JSON.parse(readFileSync(statePath, 'utf-8'));
      expect(state.cliVersion).toBeDefined();
    });

    it('can create migrations directory', async () => {
      const { mkdirSync, existsSync: fsExists, rmSync } = await import('node:fs');

      const migrationsDir = join(PLAYGROUND_DIR, '.supaslidev', 'migrations');

      if (!fsExists(migrationsDir)) {
        mkdirSync(migrationsDir, { recursive: true });
        expect(fsExists(migrationsDir)).toBe(true);
        rmSync(migrationsDir, { recursive: true });
      }
    });
  });

  describe('pnpm Workspace Configuration', () => {
    it('has valid pnpm-workspace.yaml', () => {
      const workspacePath = join(PLAYGROUND_DIR, 'pnpm-workspace.yaml');
      const content = readFileSync(workspacePath, 'utf-8');

      expect(content).toContain('packages:');
    });
  });
});
