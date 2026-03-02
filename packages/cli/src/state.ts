import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CLI_VERSION } from './version.js';
const STATE_DIR = '.supaslidev';
const STATE_FILE = 'state.json';

export interface AppliedMigration {
  id: string;
  appliedAt: string;
}

export interface ImportedPresentation {
  name: string;
  importedAt: string;
  sourcePath: string;
}

export interface StateSchema {
  cliVersion: string;
  createdAt: string;
  lastUpdatedAt: string;
  appliedMigrations: AppliedMigration[];
  importedPresentations?: ImportedPresentation[];
}

function getStatePath(workspaceDir: string): string {
  return join(workspaceDir, STATE_DIR, STATE_FILE);
}

function getStateDir(workspaceDir: string): string {
  return join(workspaceDir, STATE_DIR);
}

export function createInitialState(): StateSchema {
  const now = new Date().toISOString();
  return {
    cliVersion: CLI_VERSION,
    createdAt: now,
    lastUpdatedAt: now,
    appliedMigrations: [],
  };
}

export function readState(workspaceDir: string): StateSchema | null {
  const statePath = getStatePath(workspaceDir);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, 'utf-8');
    return JSON.parse(content) as StateSchema;
  } catch {
    return null;
  }
}

export function writeState(workspaceDir: string, state: StateSchema): void {
  const stateDir = getStateDir(workspaceDir);
  const statePath = getStatePath(workspaceDir);

  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  const updatedState: StateSchema = {
    ...state,
    lastUpdatedAt: new Date().toISOString(),
  };

  writeFileSync(statePath, JSON.stringify(updatedState, null, 2) + '\n', 'utf-8');
}

export function initializeState(workspaceDir: string): StateSchema {
  const state = createInitialState();
  writeState(workspaceDir, state);
  return state;
}

export function stateExists(workspaceDir: string): boolean {
  return existsSync(getStatePath(workspaceDir));
}

export function addMigration(workspaceDir: string, migrationId: string): void {
  const state = readState(workspaceDir);

  if (!state) {
    throw new Error('State file not found. Is this a Supaslidev workspace?');
  }

  const alreadyApplied = state.appliedMigrations.some((m) => m.id === migrationId);
  if (alreadyApplied) {
    return;
  }

  state.appliedMigrations.push({
    id: migrationId,
    appliedAt: new Date().toISOString(),
  });

  writeState(workspaceDir, state);
}

export function hasMigration(workspaceDir: string, migrationId: string): boolean {
  const state = readState(workspaceDir);

  if (!state) {
    return false;
  }

  return state.appliedMigrations.some((m) => m.id === migrationId);
}

export function updateCliVersion(workspaceDir: string): void {
  const state = readState(workspaceDir);

  if (!state) {
    throw new Error('State file not found. Is this a Supaslidev workspace?');
  }

  state.cliVersion = CLI_VERSION;
  writeState(workspaceDir, state);
}

export function findWorkspaceRoot(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    if (stateExists(currentDir)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

export function addImportedPresentation(
  workspaceDir: string,
  presentation: ImportedPresentation,
): void {
  const state = readState(workspaceDir);

  if (!state) {
    throw new Error('State file not found. Is this a Supaslidev workspace?');
  }

  if (!state.importedPresentations) {
    state.importedPresentations = [];
  }

  const existingIndex = state.importedPresentations.findIndex((p) => p.name === presentation.name);

  if (existingIndex >= 0) {
    state.importedPresentations[existingIndex] = presentation;
  } else {
    state.importedPresentations.push(presentation);
  }

  writeState(workspaceDir, state);
}

export function getImportedPresentations(workspaceDir: string): ImportedPresentation[] {
  const state = readState(workspaceDir);
  return state?.importedPresentations ?? [];
}

export function removeImportedPresentation(workspaceDir: string, name: string): void {
  const state = readState(workspaceDir);

  if (!state) {
    throw new Error('State file not found. Is this a Supaslidev workspace?');
  }

  if (!state.importedPresentations) {
    return;
  }

  state.importedPresentations = state.importedPresentations.filter((p) => p.name !== name);
  writeState(workspaceDir, state);
}
