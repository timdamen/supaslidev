<script setup lang="ts">
import type { AccentColor, NeutralColor } from '../composables/useSettings';
import { ACCENT_COLORS, NEUTRAL_COLORS, useSettings } from '../composables/useSettings';

const router = useRouter();
const colorMode = useColorMode();
const { settings } = useSettings();

const ACCENT_HEX: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  teal: '#14b8a6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
};

const NEUTRAL_HEX: Record<string, string> = {
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
};

const accentColorSwatches = ACCENT_COLORS.map((name: string) => ({
  name,
  value: ACCENT_HEX[name] ?? '#000000',
}));

const neutralColorSwatches = NEUTRAL_COLORS.map((name: string) => ({
  name,
  value: NEUTRAL_HEX[name] ?? '#000000',
}));

const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];
</script>

<template>
  <div>
    <header class="mb-10">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h1 class="text-2xl sm:text-3xl font-semibold font-mono">$ settings</h1>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          class="cursor-pointer"
          @click="router.push('/')"
        >
          Back
        </UButton>
      </div>
      <p class="text-sm font-mono" style="color: var(--supaslidev-text-muted)">
        Customize the dashboard appearance.
      </p>
    </header>

    <div class="max-w-2xl space-y-8">
      <section>
        <h2
          class="text-xs uppercase tracking-wider mb-4 font-mono"
          style="color: var(--supaslidev-text-muted)"
        >
          Appearance
        </h2>
        <div class="settings-card space-y-6">
          <div class="space-y-2">
            <label for="theme-select" class="block text-sm font-medium font-mono"> Theme </label>
            <USelect
              id="theme-select"
              v-model="colorMode.preference"
              :items="themeOptions"
              value-key="value"
              class="max-w-48 cursor-pointer"
            />
          </div>

          <div class="space-y-3">
            <span class="block text-sm font-medium font-mono"> Accent color </span>
            <SettingsColorPicker
              :colors="accentColorSwatches"
              :model-value="settings.accentColor"
              label="Accent color"
              name="accent-color"
              @update:model-value="settings.accentColor = ($event ?? 'teal') as AccentColor"
            />
          </div>

          <div class="space-y-3">
            <span class="block text-sm font-medium font-mono"> Background shade </span>
            <SettingsColorPicker
              :colors="neutralColorSwatches"
              :model-value="settings.neutralColor"
              label="Background shade"
              name="background-shade"
              @update:model-value="settings.neutralColor = ($event ?? 'slate') as NeutralColor"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-card {
  background: var(--ui-bg-elevated);
  border: 1px solid var(--supaslidev-border);
  border-radius: 0.75rem;
  padding: 1.5rem;
}
</style>
