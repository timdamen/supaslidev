import { spawn, execSync, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { isValidPresentationId } from '../../src/shared/validation.js';

const IS_WINDOWS = process.platform === 'win32';

interface ServerEntry {
  process: ChildProcess;
  port: number;
}

const runningServers = new Map<string, ServerEntry>();

export function getNextPort(): number {
  const usedPorts = new Set([...runningServers.values()].map((s) => s.port));
  let port = 3030;
  while (usedPorts.has(port)) {
    port++;
  }
  return port;
}

export function startPresentationServer(
  presentationId: string,
  projectRoot: string,
): { success: boolean; port?: number; error?: string; alreadyRunning?: boolean } {
  if (!isValidPresentationId(presentationId)) {
    return { success: false, error: 'Invalid presentation id' };
  }

  if (runningServers.has(presentationId)) {
    return { success: true, port: runningServers.get(presentationId)!.port, alreadyRunning: true };
  }

  const presentationPath = join(projectRoot, 'presentations', presentationId);
  const slidevBin = join(presentationPath, 'node_modules', '.bin', 'slidev');

  if (!existsSync(presentationPath)) {
    return { success: false, error: 'Presentation not found' };
  }

  if (!existsSync(slidevBin)) {
    return { success: false, error: 'Dependencies not installed. Run pnpm install first.' };
  }

  const port = getNextPort();

  const child = spawn(
    slidevBin,
    ['--port', String(port), '--remote', crypto.randomUUID(), '--open', 'false'],
    {
      cwd: presentationPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: !IS_WINDOWS,
      shell: IS_WINDOWS,
    },
  );

  child.unref();

  runningServers.set(presentationId, { process: child, port });

  child.stderr?.on('data', (data: Buffer) => {
    console.error(`[${presentationId}] stderr:`, data.toString());
  });

  child.on('close', (code: number | null) => {
    console.log(`[${presentationId}] process exited with code ${code}`);
    runningServers.delete(presentationId);
  });

  child.on('error', (err: Error) => {
    console.error(`Failed to start server for ${presentationId}:`, err);
    runningServers.delete(presentationId);
  });

  return { success: true, port, alreadyRunning: false };
}

export function stopPresentationServer(presentationId: string): {
  success: boolean;
  error?: string;
} {
  const server = runningServers.get(presentationId);
  if (!server) {
    return { success: false, error: 'Server not running' };
  }

  if (IS_WINDOWS) {
    try {
      execSync(`taskkill /pid ${server.process.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Process may have already exited
    }
  } else {
    server.process.kill('SIGTERM');
  }
  runningServers.delete(presentationId);
  return { success: true };
}

export function stopAllPresentationServers(): {
  success: boolean;
  stopped: string[];
} {
  const stopped: string[] = [];
  for (const [id] of runningServers) {
    const result = stopPresentationServer(id);
    if (result.success) {
      stopped.push(id);
    }
  }
  return { success: true, stopped };
}

export function getServersStatus(): Record<string, { port: number }> {
  const servers: Record<string, { port: number }> = {};
  for (const [id, server] of runningServers) {
    servers[id] = { port: server.port };
  }
  return servers;
}
