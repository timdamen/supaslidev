<script setup lang="ts">
import { resolveAssetUrl } from '@slidev/client';
import { computed } from 'vue';
import { useAltBadge } from '../helpers/useAltBadge';

const props = defineProps<{
  /** Optional background image; rendered as a real <img> so it can carry alt text */
  image?: string;
  /** Description of the image; use alt: '' when purely decorative */
  alt?: string;
  class?: string;
}>();

const missingAlt = computed(() => props.image != null && props.alt == null);
const showBadge = useAltBadge(
  missingAlt,
  `[slidev-theme-supa11y] cover: image "${props.image}" has no "alt" in frontmatter. Add alt: '…', or alt: '' if it is decorative.`,
);
</script>

<template>
  <div class="slidev-layout supa11y-cover cover" :class="[props.class, { 'has-image': image }]">
    <img v-if="image" class="supa11y-cover-image" :src="resolveAssetUrl(image)" :alt="alt ?? ''" />
    <div v-if="image" class="supa11y-cover-scrim" aria-hidden="true" />
    <div class="supa11y-cover-content">
      <slot />
    </div>
    <span v-if="showBadge" class="supa11y-alt-warning">Missing alt text</span>
  </div>
</template>
