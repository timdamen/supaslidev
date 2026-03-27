<script setup lang="ts">
import type { Presentation } from '../composables/useServers';

interface Template {
  value: string;
  label: string;
  description: string;
  icon: string;
}

const templates: Template[] = [
  {
    value: 'default',
    label: 'Default',
    description: 'Clean and minimal starter template',
    icon: 'i-lucide-layout-template',
  },
  {
    value: 'seriph',
    label: 'Seriph',
    description: 'Elegant theme with serif typography',
    icon: 'i-lucide-type',
  },
  {
    value: 'apple-basic',
    label: 'Apple Basic',
    description: 'Minimalist Apple-inspired design',
    icon: 'i-lucide-apple',
  },
];

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  created: [presentation: Presentation];
}>();

const name = ref('');
const title = ref('');
const description = ref('');
const selectedTemplate = ref('default');
const isSubmitting = ref(false);
const nameError = ref('');
const touched = ref(false);

const isValid = computed(() => {
  if (!name.value.trim()) return false;
  if (nameError.value) return false;
  return true;
});

function validateName(value: string) {
  if (!touched.value) return;

  if (!value.trim()) {
    nameError.value = 'Name is required';
    return;
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(value)) {
    nameError.value = 'Use lowercase letters, numbers, and hyphens only';
    return;
  }

  nameError.value = '';
}

watch(name, (value) => {
  if (touched.value) {
    validateName(value);
  }
});

function handleBlur() {
  touched.value = true;
  validateName(name.value);
}

function resetForm() {
  name.value = '';
  title.value = '';
  description.value = '';
  selectedTemplate.value = 'default';
  nameError.value = '';
  isSubmitting.value = false;
  touched.value = false;
}

function handleClose() {
  resetForm();
  emit('close');
}

async function handleSubmit() {
  touched.value = true;
  validateName(name.value);
  if (!isValid.value || isSubmitting.value) return;

  isSubmitting.value = true;

  try {
    const response = await fetch('/api/presentations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value,
        title: title.value || undefined,
        description: description.value || undefined,
        template: selectedTemplate.value,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.field === 'name') {
        nameError.value = error.message;
      }
      return;
    }

    const result = await response.json();
    emit('created', result.presentation ?? result);
    handleClose();
  } catch {
    nameError.value = 'Failed to create presentation';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UModal :open="props.open" :ui="{ content: 'sm:max-w-xl' }" @close="handleClose">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <UIcon name="i-lucide-presentation" class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 class="text-lg font-semibold">Create New Presentation</h2>
          <p class="text-sm text-muted">Set up your new Slidev presentation</p>
        </div>
      </div>
    </template>

    <template #body>
      <form class="flex flex-col gap-6" @submit.prevent="handleSubmit">
        <UFormField
          label="Presentation Name"
          required
          :error="nameError || undefined"
          hint="This will be used as the folder name"
        >
          <UInput
            v-model="name"
            placeholder="my-presentation"
            :color="nameError ? 'error' : undefined"
            :ui="{ base: 'font-mono' }"
            class="w-full"
            autocomplete="off"
            @blur="handleBlur"
          />
        </UFormField>

        <UFormField label="Title" hint="Display title for the presentation">
          <UInput
            v-model="title"
            placeholder="Welcome to My Presentation"
            class="w-full"
            autocomplete="off"
          />
        </UFormField>

        <UFormField label="Description" hint="Brief description of the presentation">
          <UTextarea
            v-model="description"
            placeholder="A presentation about..."
            class="w-full"
            :rows="2"
            autoresize
          />
        </UFormField>

        <UFormField label="Template">
          <URadioGroup
            v-model="selectedTemplate"
            :items="templates"
            variant="card"
            orientation="horizontal"
            indicator="hidden"
            :ui="{ item: 'flex-1 items-start', wrapper: 'text-left' }"
          >
            <template #label="{ item }">
              <div class="flex items-center gap-2">
                <UIcon :name="(item as Template).icon" class="w-4 h-4 text-muted" />
                <span>{{ (item as Template).label }}</span>
              </div>
            </template>
            <template #description="{ item }">
              <span class="text-xs">{{ (item as Template).description }}</span>
            </template>
          </URadioGroup>
        </UFormField>

        <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <UIcon name="i-lucide-info" class="w-4 h-4 text-muted mt-0.5 shrink-0" />
          <p class="text-sm text-muted">
            You can customize the title, theme, and content by editing
            <code class="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">slides.md</code>
            after creation.
          </p>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end">
        <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="handleClose">
          Cancel
        </UButton>
        <UButton
          :disabled="!isValid || isSubmitting"
          :loading="isSubmitting"
          icon="i-lucide-plus"
          @click="handleSubmit"
        >
          {{ isSubmitting ? 'Creating...' : 'Create Presentation' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
