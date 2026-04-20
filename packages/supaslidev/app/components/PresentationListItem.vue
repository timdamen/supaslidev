<script setup lang="ts">
import type { Presentation } from '../composables/useServers';

const props = defineProps<{
  presentation: Presentation;
}>();

const { deployMode, showDeployDemoToast } = useDeployMode();
const toast = useToast();
const deployBasePath = computed(() => (import.meta.env.BASE_URL || '/').replace(/\/$/, ''));

const {
  isRunning,
  getPort,
  startServer,
  stopServer,
  exportPresentation,
  generateThumbnail,
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
  thumbnail: false,
  edit: false,
});

const running = computed(() => isRunning(props.presentation.id));
const port = computed(() => getPort(props.presentation.id));

async function handleDev(event: Event) {
  event.preventDefault();
  event.stopPropagation();

  if (deployMode.value) {
    window.open(`${deployBasePath.value}/presentations/${props.presentation.id}/`, '_blank');
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

async function handleThumbnail(event: Event) {
  event.preventDefault();
  event.stopPropagation();

  if (deployMode.value) {
    showDeployDemoToast();
    return;
  }

  if (loading.value.thumbnail) return;

  loading.value.thumbnail = true;
  try {
    const result = await generateThumbnail(props.presentation.id);
    if (result.success && result.thumbnailPath) {
      toast.add({
        title: 'Thumbnail ready',
        description: `${props.presentation.title} thumbnail generated`,
        color: 'success',
        icon: 'i-lucide-image',
        actions: [
          {
            label: 'Open',
            onClick: () => window.open(result.thumbnailPath, '_blank'),
          },
        ],
      });
    } else {
      emit('exportError', result.error || 'Thumbnail generation failed');
    }
  } catch {
    emit('exportError', 'Failed to generate thumbnail');
  } finally {
    loading.value.thumbnail = false;
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

function handleRowClick() {
  if (deployMode.value) {
    window.open(`${deployBasePath.value}/presentations/${props.presentation.id}/`, '_blank');
  } else if (running.value && port.value) {
    window.open(`http://localhost:${port.value}`, '_blank');
  }
}

function handleOpen(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  if (port.value) {
    window.open(`http://localhost:${port.value}`, '_blank');
  }
}
</script>

<template>
  <div
    :class="[
      'list-item-v font-mono flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
      {
        'list-item--running': !deployMode && running,
        'cursor-pointer': deployMode || (running && port),
      },
    ]"
    @click="handleRowClick"
  >
    <span
      class="status-dot w-2 h-2 rounded-full shrink-0"
      :class="running ? 'bg-[var(--ui-success)] animate-pulse' : 'bg-[var(--ui-text-muted)]'"
    />

    <span class="text-xs text-[var(--ui-text-muted)] shrink-0">~/{{ presentation.id }}</span>

    <span class="text-sm text-[var(--ui-text)] truncate min-w-0 flex-1">
      {{ presentation.title }}
    </span>

    <UBadge
      color="primary"
      variant="outline"
      size="xs"
      class="font-mono text-[10px] hidden sm:inline-flex shrink-0"
    >
      {{ presentation.theme }}
    </UBadge>

    <UBadge
      v-if="presentation.duration"
      color="neutral"
      variant="outline"
      size="xs"
      class="font-mono text-[10px] hidden sm:inline-flex shrink-0"
    >
      {{ presentation.duration }}
    </UBadge>

    <div v-if="running && port" class="flex items-center gap-1 shrink-0">
      <a
        :href="`http://localhost:${port}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-[var(--ui-success)] hover:underline"
        @click.stop
      >
        :{{ port }}
      </a>
      <UButton
        color="success"
        variant="ghost"
        size="xs"
        icon="i-lucide-external-link"
        class="action-btn"
        title="Open in browser"
        @click="handleOpen"
      />
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <UButton
        :color="running ? 'error' : 'success'"
        variant="ghost"
        size="xs"
        :icon="loading.dev ? '' : running ? 'i-lucide-square' : 'i-lucide-play'"
        :loading="loading.dev"
        :disabled="loading.dev"
        loading-icon="i-lucide-loader-circle"
        class="action-btn"
        :title="running ? 'Stop server' : 'Start dev server'"
        @click="handleDev"
      />

      <UButton
        color="primary"
        variant="ghost"
        size="xs"
        :icon="loading.export ? '' : 'i-lucide-download'"
        :loading="loading.export"
        :disabled="loading.export"
        loading-icon="i-lucide-loader-circle"
        class="action-btn"
        title="Export to PDF"
        @click="handleExport"
      />

      <UButton
        color="info"
        variant="ghost"
        size="xs"
        :icon="loading.thumbnail ? '' : 'i-lucide-image'"
        :loading="loading.thumbnail"
        :disabled="loading.thumbnail"
        loading-icon="i-lucide-loader-circle"
        class="action-btn"
        title="Generate thumbnail"
        @click="handleThumbnail"
      />

      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-pencil"
        :loading="loading.edit"
        :disabled="loading.edit"
        class="action-btn"
        title="Edit in VS Code"
        @click="handleEdit"
      />
    </div>
  </div>
</template>

<style scoped>
.list-item-v {
  --terminal-glow-color: rgba(39, 201, 63, 0.2);
  background: var(--ui-bg);
  border: 1px solid var(--supaslidev-border);
}

.list-item-v:hover {
  background: var(--ui-bg-elevated);
  border-color: var(--ui-border-accented);
}

.list-item-v--running {
  border-color: rgba(39, 201, 63, 0.3);
  box-shadow: 0 0 20px var(--terminal-glow-color);
}

.list-item-v--running:hover {
  box-shadow: 0 0 30px rgba(39, 201, 63, 0.3);
}

.action-btn {
  opacity: 0.75;
  transition: opacity 0.2s ease;
}

.list-item-v:hover .action-btn {
  opacity: 1;
}
</style>
