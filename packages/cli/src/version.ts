import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pkg from '../package.json' with { type: 'json' };

export const CLI_VERSION: string = pkg.version;
export const PACKAGE_NAME = '@supaslidev/cli';

const CACHE_DIR = join(tmpdir(), 'supaslidev-cli');
const CACHE_FILE = join(CACHE_DIR, 'version-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface VersionCache {
  latestVersion: string;
  checkedAt: number;
}

interface NpmVersionResponse {
  'dist-tags': {
    latest: string;
  };
}

export function compareVersions(current: string, latest: string): boolean {
  const parseVersion = (v: string): number[] =>
    v
      .replace(/^v/, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] ?? 0;
    const lat = latestParts[i] ?? 0;
    if (lat > curr) return true;
    if (lat < curr) return false;
  }
  return false;
}

function readCache(): VersionCache | null {
  try {
    if (!existsSync(CACHE_FILE)) {
      return null;
    }
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as VersionCache;
    if (Date.now() - data.checkedAt > CACHE_TTL_MS) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeCache(latestVersion: string): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cache: VersionCache = {
      latestVersion,
      checkedAt: Date.now(),
    };
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // Silently ignore cache write failures
  }
}

export async function fetchLatestPackageVersion(packageName: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://registry.npmjs.org/${packageName}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as NpmVersionResponse;
    return data['dist-tags'].latest;
  } catch {
    return null;
  }
}

export async function fetchLatestVersion(): Promise<string | null> {
  const version = await fetchLatestPackageVersion(PACKAGE_NAME);
  if (version) {
    writeCache(version);
  }
  return version;
}

export function getCachedLatestVersion(): string | null {
  const cache = readCache();
  return cache?.latestVersion ?? null;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const latestVersion = await fetchLatestVersion();
  const updateAvailable = latestVersion ? compareVersions(CLI_VERSION, latestVersion) : false;

  return {
    currentVersion: CLI_VERSION,
    latestVersion,
    updateAvailable,
  };
}

export function checkForUpdatesCached(): UpdateCheckResult {
  const latestVersion = getCachedLatestVersion();
  const updateAvailable = latestVersion ? compareVersions(CLI_VERSION, latestVersion) : false;

  return {
    currentVersion: CLI_VERSION,
    latestVersion,
    updateAvailable,
  };
}
