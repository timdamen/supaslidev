import { ref, readonly } from 'vue';
import type { Presentation } from '../../src/shared/types';

interface ServerInfo {
  port: number;
}

const servers = ref<Record<string, ServerInfo>>({});

async function fetchStatus() {
  try {
    const response = await fetch('/api/servers');
    if (response.ok) {
      servers.value = await response.json();
    }
  } catch {
    // API server not running
  }
}

async function startServer(presentationId: string): Promise<{ success: boolean; port?: number }> {
  try {
    const response = await fetch(`/api/servers/${presentationId}`, { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      servers.value = { ...servers.value, [presentationId]: { port: result.port } };
      return { success: true, port: result.port };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

async function stopServer(presentationId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/servers/${presentationId}`, { method: 'DELETE' });
    const result = await response.json();
    if (result.success) {
      const newServers = { ...servers.value };
      delete newServers[presentationId];
      servers.value = newServers;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function stopAllServers(): Promise<boolean> {
  try {
    const response = await fetch('/api/servers', { method: 'DELETE' });
    const result = await response.json();
    if (result.success) {
      servers.value = {};
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isRunning(presentationId: string): boolean {
  return presentationId in servers.value;
}

async function exportPresentation(
  presentationId: string,
): Promise<{ success: boolean; pdfPath?: string; error?: string }> {
  try {
    const response = await fetch(`/api/export/${presentationId}`, { method: 'POST' });
    const result = await response.json();
    return result;
  } catch {
    return { success: false, error: 'Failed to connect to export service' };
  }
}

async function openInEditor(presentationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/open-editor/${presentationId}`, { method: 'POST' });
    return await response.json();
  } catch {
    return { success: false, error: 'Failed to open editor' };
  }
}

function getPort(presentationId: string): number | undefined {
  return servers.value[presentationId]?.port;
}

async function waitForServerReady(
  port: number,
  options: { timeout?: number; interval?: number } = {},
): Promise<boolean> {
  const { timeout = 30000, interval = 300 } = options;
  const startTime = Date.now();
  const url = `http://localhost:${port}`;

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      if (response.ok || response.type === 'opaque') {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return false;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (pollingInterval) return;
  fetchStatus();
  pollingInterval = setInterval(fetchStatus, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

export function useServers() {
  return {
    servers: readonly(servers),
    fetchStatus,
    startServer,
    stopServer,
    stopAllServers,
    isRunning,
    getPort,
    startPolling,
    stopPolling,
    exportPresentation,
    openInEditor,
    waitForServerReady,
  };
}

export type { Presentation };
