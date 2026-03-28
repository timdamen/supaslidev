<script setup lang="ts">
import type { Presentation } from '../composables/useServers';

type ImportStatus = 'idle' | 'validating' | 'importing' | 'success' | 'error';

interface ImportProject {
  path: string;
  name: string;
  isValid: boolean;
  error: string;
  status: ImportStatus;
}

interface ValidationResult {
  path: string;
  isValid: boolean;
  suggestedName: string | null;
  error: string | null;
}

interface ImportProgress {
  currentIndex: number;
  total: number;
  currentProjectName: string;
}

interface ImportSummary {
  successCount: number;
  failureCount: number;
  errors: Array<{ path: string; error: string }>;
}

interface UploadedFile {
  path: string;
  content: string;
  encoding: 'utf8' | 'base64';
}

interface UploadedProject {
  folderName: string;
  files: UploadedFile[];
  isValid: boolean;
  error: string | null;
  suggestedName: string;
}

function createEmptyImportProject(): ImportProject {
  return {
    path: '',
    name: '',
    isValid: false,
    error: '',
    status: 'idle',
  };
}

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  imported: [presentations: Presentation[]];
}>();

const importProject = ref<ImportProject>(createEmptyImportProject());
const isSubmitting = ref(false);
const nameError = ref('');
const touched = ref({ path: false, name: false });
const folderInputRef = ref<HTMLInputElement | null>(null);
const dragCounter = ref(0);
const validationResults = ref<ValidationResult[]>([]);
const isValidating = ref(false);
const importProgress = ref<ImportProgress | null>(null);
const importSummary = ref<ImportSummary | null>(null);
const uploadedProjects = ref<Map<string, UploadedProject>>(new Map());
const isReadingFiles = ref(false);
let validationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.json',
  '.vue',
  '.ts',
  '.js',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.yaml',
  '.yml',
  '.txt',
  '.svg',
  '.gitignore',
  '.npmrc',
  '.env',
]);

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.nuxt',
  '.output',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '.DS_Store',
];

function shouldIgnoreFile(path: string): boolean {
  const parts = path.split('/');
  return parts.some((part) => IGNORE_PATTERNS.includes(part));
}

function isTextFile(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || !filename.includes('.');
}

async function readFileContent(file: File): Promise<UploadedFile> {
  const isText = isTextFile(file.name);

  if (isText) {
    const content = await file.text();
    return {
      path: file.webkitRelativePath.split('/').slice(1).join('/'),
      content,
      encoding: 'utf8',
    };
  } else {
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    );
    return {
      path: file.webkitRelativePath.split('/').slice(1).join('/'),
      content: base64,
      encoding: 'base64',
    };
  }
}

async function readDirectoryEntry(entry: FileSystemDirectoryEntry): Promise<UploadedFile[]> {
  const files: UploadedFile[] = [];

  async function readEntry(dirEntry: FileSystemDirectoryEntry, basePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = dirEntry.createReader();
      const readEntries = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve();
            return;
          }

          for (const entry of entries) {
            const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

            if (shouldIgnoreFile(entryPath)) {
              continue;
            }

            if (entry.isFile) {
              const fileEntry = entry as FileSystemFileEntry;
              const file = await new Promise<File>((res, rej) => {
                fileEntry.file(res, rej);
              });

              const isText = isTextFile(file.name);
              if (isText) {
                const content = await file.text();
                files.push({ path: entryPath, content, encoding: 'utf8' });
              } else {
                const buffer = await file.arrayBuffer();
                const base64 = btoa(
                  new Uint8Array(buffer).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    '',
                  ),
                );
                files.push({ path: entryPath, content: base64, encoding: 'base64' });
              }
            } else if (entry.isDirectory) {
              await readEntry(entry as FileSystemDirectoryEntry, entryPath);
            }
          }

          readEntries();
        }, reject);
      };

      readEntries();
    });
  }

  await readEntry(entry, '');
  return files;
}

function validateUploadedFiles(files: UploadedFile[]): { isValid: boolean; error: string | null } {
  const hasSlides = files.some((f) => f.path === 'slides.md');
  const hasPackageJson = files.some((f) => f.path === 'package.json');

  if (!hasSlides) {
    return { isValid: false, error: 'No slides.md found' };
  }
  if (!hasPackageJson) {
    return { isValid: false, error: 'No package.json found' };
  }
  return { isValid: true, error: null };
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

const isDraggingOver = computed(() => dragCounter.value > 0);

const validProjects = computed(() => {
  return validationResults.value.filter((r) => r.isValid);
});

const validUploadedProjects = computed(() => {
  return Array.from(uploadedProjects.value.values()).filter((p) => p.isValid);
});

const hasValidProjects = computed(() => {
  return validProjects.value.length > 0 || validUploadedProjects.value.length > 0;
});

const isValid = computed(() => {
  return hasValidProjects.value && !nameError.value && !isValidating.value && !isReadingFiles.value;
});

const hasMultiplePaths = computed(() => {
  const pathCount = parsePaths(importProject.value.path).length;
  const uploadCount = uploadedProjects.value.size;
  return pathCount + uploadCount > 1;
});

const showPreviewList = computed(() => {
  return (
    validationResults.value.length > 0 ||
    uploadedProjects.value.size > 0 ||
    isValidating.value ||
    isReadingFiles.value
  );
});

const hasUploadedProjects = computed(() => {
  return uploadedProjects.value.size > 0;
});

function parsePaths(input: string): string[] {
  return input
    .split(',')
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
}

async function validatePathsOnServer(paths: string[]): Promise<ValidationResult[]> {
  if (paths.length === 0) return [];

  try {
    const response = await fetch('/api/presentations/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });

    if (!response.ok) {
      return paths.map((path) => ({
        path,
        isValid: false,
        suggestedName: null,
        error: 'Validation request failed',
      }));
    }

    return await response.json();
  } catch {
    return paths.map((path) => ({
      path,
      isValid: false,
      suggestedName: null,
      error: 'Failed to validate path',
    }));
  }
}

function triggerValidation(paths: string[]) {
  if (validationDebounceTimer) {
    clearTimeout(validationDebounceTimer);
  }

  if (paths.length === 0) {
    validationResults.value = [];
    isValidating.value = false;
    return;
  }

  isValidating.value = true;
  validationDebounceTimer = setTimeout(async () => {
    const results = await validatePathsOnServer(paths);
    validationResults.value = results;
    isValidating.value = false;

    const hasValid = results.some((r) => r.isValid);
    importProject.value.isValid = hasValid;
    importProject.value.error = hasValid ? '' : 'No valid projects found';
  }, 300);
}

function validateName(value: string) {
  if (!touched.value.name) return;
  if (!value.trim()) {
    nameError.value = '';
    return;
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(value)) {
    nameError.value = 'Use lowercase letters, numbers, and hyphens only';
    return;
  }

  nameError.value = '';
}

watch(
  () => importProject.value.path,
  (value) => {
    if (touched.value.path) {
      const paths = parsePaths(value);
      triggerValidation(paths);
    }
  },
);

watch(
  () => importProject.value.name,
  (value) => {
    if (touched.value.name) {
      validateName(value);
    }
  },
);

function handlePathBlur() {
  touched.value.path = true;
  const paths = parsePaths(importProject.value.path);
  triggerValidation(paths);
}

function handleNameBlur() {
  touched.value.name = true;
  validateName(importProject.value.name);
}

function openFolderPicker() {
  folderInputRef.value?.click();
}

async function handleFolderSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;

  isReadingFiles.value = true;

  const filesByFolder = new Map<string, File[]>();
  for (const file of files) {
    const pathParts = file.webkitRelativePath.split('/');
    if (pathParts.length > 1) {
      const folderName = pathParts[0];
      if (!filesByFolder.has(folderName)) {
        filesByFolder.set(folderName, []);
      }
      filesByFolder.get(folderName)!.push(file);
    }
  }

  for (const [folderName, folderFiles] of filesByFolder) {
    if (uploadedProjects.value.has(folderName)) {
      continue;
    }

    const uploadedFiles: UploadedFile[] = [];
    for (const file of folderFiles) {
      const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
      if (shouldIgnoreFile(relativePath)) {
        continue;
      }

      const uploadedFile = await readFileContent(file);
      uploadedFiles.push(uploadedFile);
    }

    const validation = validateUploadedFiles(uploadedFiles);
    const project: UploadedProject = {
      folderName,
      files: uploadedFiles,
      isValid: validation.isValid,
      error: validation.error,
      suggestedName: toSlug(folderName),
    };

    uploadedProjects.value.set(folderName, project);
  }

  uploadedProjects.value = new Map(uploadedProjects.value);
  isReadingFiles.value = false;
  input.value = '';
}

function handleDragEnter(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer?.types.includes('Files')) {
    dragCounter.value++;
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  dragCounter.value--;
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  dragCounter.value = 0;

  const items = event.dataTransfer?.items;
  if (!items) return;

  const directoryEntries: FileSystemDirectoryEntry[] = [];

  for (const item of items) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        directoryEntries.push(entry as FileSystemDirectoryEntry);
      }
    }
  }

  if (directoryEntries.length === 0) return;

  isReadingFiles.value = true;

  for (const entry of directoryEntries) {
    const folderName = entry.name;
    if (uploadedProjects.value.has(folderName)) {
      continue;
    }

    const files = await readDirectoryEntry(entry);
    const validation = validateUploadedFiles(files);

    const project: UploadedProject = {
      folderName,
      files,
      isValid: validation.isValid,
      error: validation.error,
      suggestedName: toSlug(folderName),
    };

    uploadedProjects.value.set(folderName, project);
  }

  uploadedProjects.value = new Map(uploadedProjects.value);
  isReadingFiles.value = false;
}

function resetForm() {
  importProject.value = createEmptyImportProject();
  nameError.value = '';
  isSubmitting.value = false;
  touched.value = { path: false, name: false };
  validationResults.value = [];
  isValidating.value = false;
  importProgress.value = null;
  importSummary.value = null;
  uploadedProjects.value = new Map();
  isReadingFiles.value = false;
  dragCounter.value = 0;
  if (validationDebounceTimer) {
    clearTimeout(validationDebounceTimer);
    validationDebounceTimer = null;
  }
}

function handleClose() {
  resetForm();
  emit('close');
}

async function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;

  const pathProjects = validProjects.value;
  const uploadProjects = validUploadedProjects.value;
  const totalProjects = pathProjects.length + uploadProjects.length;

  if (totalProjects === 0) return;

  const isSingleProject = totalProjects === 1;

  isSubmitting.value = true;
  importProject.value.status = 'importing';
  importSummary.value = null;

  const importedPresentations: Presentation[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  let currentIndex = 0;

  for (const project of pathProjects) {
    currentIndex++;
    importProgress.value = {
      currentIndex,
      total: totalProjects,
      currentProjectName: project.suggestedName || project.path,
    };

    try {
      const response = await fetch('/api/presentations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: project.path,
          name: isSingleProject ? importProject.value.name || undefined : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        errors.push({ path: project.path, error: error.message });
        continue;
      }

      const presentation = await response.json();
      importedPresentations.push(presentation);
    } catch {
      errors.push({ path: project.path, error: 'Failed to import' });
    }
  }

  for (const project of uploadProjects) {
    currentIndex++;
    importProgress.value = {
      currentIndex,
      total: totalProjects,
      currentProjectName: project.suggestedName || project.folderName,
    };

    try {
      const response = await fetch('/api/presentations/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: project.files,
          folderName: project.folderName,
          name: isSingleProject ? importProject.value.name || undefined : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        errors.push({ path: project.folderName, error: error.message });
        continue;
      }

      const presentation = await response.json();
      importedPresentations.push(presentation);
    } catch {
      errors.push({ path: project.folderName, error: 'Failed to upload' });
    }
  }

  importProgress.value = null;

  if (importedPresentations.length > 0) {
    emit('imported', importedPresentations);
  }

  importSummary.value = {
    successCount: importedPresentations.length,
    failureCount: errors.length,
    errors,
  };

  if (errors.length === 0) {
    importProject.value.status = 'success';
    handleClose();
  } else {
    importProject.value.status = 'error';
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UModal :open="props.open" :ui="{ content: 'sm:max-w-xl' }" @close="handleClose">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <UIcon name="i-lucide-import" class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-semibold">Import Presentations</h2>
          <p class="text-sm text-muted">Import existing Slidev presentations</p>
        </div>
      </div>
    </template>

    <template #body>
      <form
        class="flex flex-col gap-6 relative"
        @submit.prevent="handleSubmit"
        @dragenter="handleDragEnter"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <div
          v-show="isDraggingOver"
          class="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-(--ui-bg)/95 backdrop-blur-sm pointer-events-none"
        >
          <div class="flex flex-col items-center gap-2 text-primary">
            <UIcon name="i-lucide-folder-down" class="w-8 h-8" />
            <span class="font-medium">Drop folders here</span>
          </div>
        </div>

        <UFormField
          label="Source Path(s)"
          :required="!hasUploadedProjects"
          :error="importProject.error || undefined"
          hint="Enter paths, browse multiple times, or drag-drop folders"
        >
          <div class="flex gap-2">
            <UInput
              v-model="importProject.path"
              placeholder="/path/to/presentation"
              :color="importProject.error ? 'error' : undefined"
              :ui="{ base: 'font-mono' }"
              class="flex-1"
              autocomplete="off"
              @blur="handlePathBlur"
            />
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-folder-open"
              @click="openFolderPicker"
            >
              Browse
            </UButton>
            <input
              ref="folderInputRef"
              type="file"
              webkitdirectory
              multiple
              class="hidden"
              @change="handleFolderSelect"
            />
          </div>
        </UFormField>

        <div v-if="showPreviewList" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-default">Projects to Import</label>
            <span
              v-if="isValidating || isReadingFiles"
              class="text-xs text-muted flex items-center gap-1"
            >
              <UIcon name="i-lucide-loader-2" class="w-3 h-3 animate-spin" />
              {{ isReadingFiles ? 'Reading files...' : 'Validating...' }}
            </span>
            <span v-else class="text-xs text-muted">
              {{ validProjects.length + validUploadedProjects.length }} of
              {{ validationResults.length + uploadedProjects.size }} valid
            </span>
          </div>
          <div
            class="border border-default rounded-lg divide-y divide-default max-h-48 overflow-y-auto"
          >
            <div
              v-for="result in validationResults"
              :key="result.path"
              class="flex items-center gap-3 px-3 py-2"
              :class="result.isValid ? 'bg-success/5' : 'bg-error/5'"
            >
              <UIcon
                :name="result.isValid ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                class="w-4 h-4 shrink-0"
                :class="result.isValid ? 'text-success' : 'text-error'"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs truncate">{{ result.path }}</span>
                  <UIcon name="i-lucide-arrow-right" class="w-3 h-3 text-muted shrink-0" />
                  <span class="font-mono text-xs text-primary font-medium">
                    {{ result.suggestedName || '—' }}
                  </span>
                </div>
                <p v-if="result.error" class="text-xs text-error mt-0.5">{{ result.error }}</p>
              </div>
            </div>
            <div
              v-for="[folderName, project] in uploadedProjects"
              :key="folderName"
              class="flex items-center gap-3 px-3 py-2"
              :class="project.isValid ? 'bg-success/5' : 'bg-error/5'"
            >
              <UIcon
                :name="project.isValid ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                class="w-4 h-4 shrink-0"
                :class="project.isValid ? 'text-success' : 'text-error'"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-folder" class="w-3 h-3 text-muted shrink-0" />
                  <span class="font-mono text-xs truncate">{{ folderName }}</span>
                  <UIcon name="i-lucide-arrow-right" class="w-3 h-3 text-muted shrink-0" />
                  <span class="font-mono text-xs text-primary font-medium">
                    {{ project.suggestedName }}
                  </span>
                  <span class="text-xs text-muted">({{ project.files.length }} files)</span>
                </div>
                <p v-if="project.error" class="text-xs text-error mt-0.5">{{ project.error }}</p>
              </div>
            </div>
          </div>
        </div>

        <UFormField
          v-if="!hasMultiplePaths"
          label="Name"
          :error="nameError || undefined"
          hint="Optional: Custom name for the imported presentation"
        >
          <UInput
            v-model="importProject.name"
            placeholder="my-presentation (optional)"
            :color="nameError ? 'error' : undefined"
            :ui="{ base: 'font-mono' }"
            class="w-full"
            autocomplete="off"
            @blur="handleNameBlur"
          />
        </UFormField>

        <div
          v-if="importProgress"
          class="flex flex-col gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-loader-2" class="w-5 h-5 text-primary animate-spin" />
            <div class="flex-1">
              <p class="text-sm font-medium text-default">
                Importing {{ importProgress.currentIndex }}/{{ importProgress.total }}...
              </p>
              <p class="text-xs text-muted font-mono truncate">
                {{ importProgress.currentProjectName }}
              </p>
            </div>
          </div>
          <div class="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-300"
              :style="{ width: `${(importProgress.currentIndex / importProgress.total) * 100}%` }"
            />
          </div>
        </div>

        <div
          v-else-if="importSummary && importSummary.failureCount > 0"
          class="flex flex-col gap-3"
        >
          <div
            class="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20"
          >
            <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-warning shrink-0" />
            <div class="flex-1">
              <p class="text-sm font-medium text-default">Import Partially Completed</p>
              <p class="text-xs text-muted">
                {{ importSummary.successCount }} succeeded, {{ importSummary.failureCount }} failed
              </p>
            </div>
          </div>
          <div
            v-if="importSummary.errors.length > 0"
            class="border border-error/20 rounded-lg divide-y divide-error/10 max-h-32 overflow-y-auto"
          >
            <div
              v-for="error in importSummary.errors"
              :key="error.path"
              class="flex items-start gap-2 px-3 py-2 bg-error/5"
            >
              <UIcon name="i-lucide-x-circle" class="w-4 h-4 text-error shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <span class="font-mono text-xs text-default truncate block">{{ error.path }}</span>
                <span class="text-xs text-error">{{ error.error }}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="!importProgress && !importSummary"
          class="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
        >
          <UIcon name="i-lucide-info" class="w-4 h-4 text-muted mt-0.5 shrink-0" />
          <p class="text-sm text-muted">
            {{ hasMultiplePaths ? 'Presentations' : 'The presentation' }} will be copied to your
            workspace. Files like
            <code class="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">node_modules</code>
            and lock files will be ignored.
          </p>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end">
        <UButton
          v-if="importSummary && importSummary.failureCount > 0"
          color="neutral"
          variant="solid"
          @click="handleClose"
        >
          Close
        </UButton>
        <template v-else>
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="handleClose">
            Cancel
          </UButton>
          <UButton
            :disabled="!isValid || isSubmitting || isValidating"
            :loading="isSubmitting || isValidating"
            icon="i-lucide-import"
            @click="handleSubmit"
          >
            {{
              isSubmitting
                ? 'Importing...'
                : isValidating
                  ? 'Validating...'
                  : validProjects.length > 1
                    ? `Import ${validProjects.length} Presentations`
                    : validProjects.length === 1
                      ? 'Import Presentation'
                      : 'Import'
            }}
          </UButton>
        </template>
      </div>
    </template>
  </UModal>
</template>
