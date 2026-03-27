<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  description: string;
}>();
</script>

<template>
  <div class="empty-state flex flex-col items-center justify-center py-16 sm:py-24 text-center">
    <div class="empty-state-icon mb-4">
      <UIcon :name="icon" class="w-12 h-12 text-muted" />
    </div>
    <h3 class="font-mono text-lg font-semibold text-default mb-2">{{ title }}</h3>
    <p class="font-mono text-sm text-muted mb-6 max-w-sm">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  border: 1px dashed var(--supaslidev-border);
  border-radius: 0.75rem;
  background: var(--ui-bg);
}

.empty-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: var(--supaslidev-header-bg);
  border: 1px solid var(--supaslidev-border);
}
</style>
