<script setup lang="ts">
import type { Presentation } from '../composables/useServers';

const props = defineProps<{
  presentation: Presentation;
}>();

const { deployMode, showDeployDemoToast } = useDeployMode();
const deployBasePath = computed(() => (import.meta.env.BASE_URL || '/').replace(/\/$/, ''));

const {
  isRunning,
  getPort,
  startServer,
  stopServer,
  exportPresentation,
  openInEditor,
  waitForServerReady,
} = useServers();

const emit = defineEmits<{
  exportError: [message: string];
  editorError: [message: string];
}>();

const loading = ref({
  dev: false,
  export: false,
  edit: false,
});

const running = computed(() => isRunning(props.presentation.id));
const port = computed(() => getPort(props.presentation.id));

async function handleDev(event: Event) {
  event.preventDefault();
  event.stopPropagation();

  if (deployMode.value) {
    showDeployDemoToast();
    return;
  }

  if (loading.value.dev) return;

  loading.value.dev = true;
  try {
    if (running.value) {
      await stopServer(props.presentation.id);
    } else {
      const result = await startServer(props.presentation.id);
      if (result.success && result.port) {
        const isReady = await waitForServerReady(result.port);
        if (isReady) {
          window.open(`http://localhost:${result.port}`, '_blank');
        }
      }
    }
  } finally {
    loading.value.dev = false;
  }
}

async function handleExport(event: Event) {
  event.preventDefault();
  event.stopPropagation();

  if (deployMode.value) {
    showDeployDemoToast();
    return;
  }

  if (loading.value.export) return;

  loading.value.export = true;
  try {
    const result = await exportPresentation(props.presentation.id);
    if (result.success && result.pdfPath) {
      window.open(result.pdfPath, '_blank');
    } else {
      emit('exportError', result.error || 'Export failed');
    }
  } catch {
    emit('exportError', 'Failed to export presentation');
  } finally {
    loading.value.export = false;
  }
}

async function handleEdit(event: Event) {
  event.preventDefault();
  event.stopPropagation();

  if (deployMode.value) {
    showDeployDemoToast();
    return;
  }

  if (loading.value.edit) return;

  loading.value.edit = true;
  try {
    const result = await openInEditor(props.presentation.id);
    if (!result.success) {
      emit('editorError', result.error || 'Failed to open editor');
    }
  } catch {
    emit('editorError', 'Failed to open editor');
  } finally {
    loading.value.edit = false;
  }
}

function handleCardClick() {
  if (deployMode.value) {
    window.open(`${deployBasePath.value}/presentations/${props.presentation.id}/`, '_blank');
  } else if (running.value && port.value) {
    window.open(`http://localhost:${port.value}`, '_blank');
  }
}
</script>

<template>
  <UCard
    as="div"
    :title="deployMode || (running && port) ? `Open ${presentation.title}` : undefined"
    class="card terminal-card group transition-all duration-300"
    :class="{
      'terminal-card--running': !deployMode && running,
      'cursor-pointer': deployMode || (running && port),
      'cursor-default': !deployMode && !running,
    }"
    :ui="{
      root: 'overflow-hidden',
      header: 'p-0 sm:px-0 bg-[var(--supaslidev-header-bg)]',
      body: 'p-0 sm:p-0',
    }"
    @click="handleCardClick"
  >
    <template #header>
      <div
        class="terminal-header flex items-center px-4 py-3 gap-1.5 border-b border-[var(--supaslidev-border)]"
      >
        <UIcon name="i-lucide-folder" class="chevron-icon" />
        <span class="font-mono text-xs opacity-80">~/{{ presentation.id }}</span>
        <div class="flex-1" />
        <UBadge
          v-if="running"
          color="success"
          variant="subtle"
          size="xs"
          class="terminal-badge terminal-badge--live font-mono uppercase tracking-wider"
        >
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />
          live
        </UBadge>
        <UBadge
          v-else
          color="neutral"
          variant="subtle"
          size="xs"
          class="terminal-badge font-mono uppercase tracking-wider"
        >
          idle
        </UBadge>
      </div>
    </template>

    <div class="terminal-body p-5 space-y-5">
      <div class="terminal-prompt">
        <div class="flex items-start gap-2">
          <span class="text-[var(--ui-success)] font-mono text-sm shrink-0">❯</span>
          <div class="min-w-0">
            <h3
              class="card-title font-mono text-base font-semibold text-[var(--ui-text)] leading-tight truncate"
            >
              {{ presentation.title }}
            </h3>
            <p
              v-if="presentation.description"
              class="font-mono text-xs text-[var(--ui-text-muted)] mt-1 line-clamp-2 leading-relaxed"
            >
              {{ presentation.description }}
            </p>
          </div>
        </div>
      </div>

      <div class="terminal-meta flex gap-2 flex-wrap items-center">
        <UBadge color="primary" variant="outline" size="xs" class="font-mono text-[10px]">
          --theme={{ presentation.theme }}
        </UBadge>
        <UBadge
          v-if="presentation.duration"
          color="neutral"
          variant="outline"
          size="xs"
          class="font-mono text-[10px]"
        >
          --duration={{ presentation.duration }}
        </UBadge>
      </div>

      <div class="terminal-actions flex gap-2">
        <UButton
          :color="running ? 'error' : 'success'"
          variant="soft"
          size="sm"
          class="present-button flex-1 terminal-btn font-mono"
          :loading="loading.dev"
          :disabled="loading.dev"
          loading-icon="i-lucide-loader-circle"
          @click="handleDev"
        >
          <template v-if="!loading.dev" #leading>
            <span class="terminal-prompt-symbol">$</span>
          </template>
          {{ running ? 'stop' : 'dev' }}
        </UButton>

        <UButton
          color="primary"
          variant="soft"
          size="sm"
          class="flex-1 terminal-btn font-mono"
          :loading="loading.export"
          :disabled="loading.export"
          loading-icon="i-lucide-loader-circle"
          @click="handleExport"
        >
          <template v-if="!loading.export" #leading>
            <span class="terminal-prompt-symbol">$</span>
          </template>
          export
        </UButton>

        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          class="flex-1 terminal-btn font-mono"
          :loading="loading.edit"
          :disabled="loading.edit"
          @click="handleEdit"
        >
          <template #leading>
            <span class="terminal-prompt-symbol">$</span>
          </template>
          edit
        </UButton>
      </div>

      <div
        v-if="!deployMode && running && port"
        class="terminal-status font-mono text-xs text-[var(--ui-text-muted)] flex items-center gap-2 pt-3 border-t border-[var(--ui-border-muted)]"
      >
        <span class="text-[var(--ui-success)] animate-pulse">●</span>
        <code class="text-[var(--ui-success)]">localhost:{{ port }}</code>
        <span class="text-[var(--ui-text-dimmed)]">|</span>
        <span class="text-[var(--ui-text-dimmed)]">click to open</span>
      </div>
    </div>
  </UCard>
</template>

<style scoped>
.terminal-card {
  --terminal-glow-color: rgba(39, 201, 63, 0.2);
  --terminal-glow-strong: rgba(39, 201, 63, 0.4);
  border: 1px solid var(--supaslidev-border);
  background: var(--ui-bg);
}

.terminal-card:hover {
  border-color: var(--ui-border-accented);
  box-shadow:
    0 0 0 1px var(--ui-border-accented),
    0 0 30px var(--terminal-glow-color),
    0 8px 32px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.terminal-card--running {
  --terminal-glow-color: rgba(39, 201, 63, 0.25);
  border-color: rgba(39, 201, 63, 0.3);
}

.terminal-card--running:hover {
  box-shadow:
    0 0 0 1px rgba(39, 201, 63, 0.4),
    0 0 40px var(--terminal-glow-strong),
    0 8px 32px rgba(0, 0, 0, 0.15);
}

.chevron-icon {
  width: 16px;
  height: 16px;
  color: var(--ui-text-muted);
  transition: all 0.3s ease;
}

.terminal-card:hover .chevron-icon {
  color: var(--ui-text);
}

.terminal-prompt-symbol {
  color: var(--ui-text-muted);
  margin-right: 2px;
}

.terminal-btn {
  transition: all 0.2s ease;
}

.terminal-btn:hover {
  text-shadow: 0 0 10px currentColor;
}

.terminal-btn:hover .terminal-kbd {
  opacity: 1;
  background: var(--ui-bg-elevated);
}

.terminal-kbd {
  opacity: 0.7;
  transition: opacity 0.2s ease;
  font-size: 9px;
}

.terminal-badge--live {
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(39, 201, 63, 0.4);
  }
  50% {
    box-shadow: 0 0 12px rgba(39, 201, 63, 0.6);
  }
}
</style>
