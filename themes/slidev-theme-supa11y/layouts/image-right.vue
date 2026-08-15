<script setup lang="ts">
import { resolveAssetUrl } from '@slidev/client';
import { computed } from 'vue';
import { useAltBadge } from '../helpers/useAltBadge';

const props = defineProps<{
  image?: string;
  /** Description of the image; use alt: '' when purely decorative */
  alt?: string;
  /** Optional visible caption rendered as <figcaption> */
  caption?: string;
  fit?: 'cover' | 'contain';
  class?: string;
}>();

const missingAlt = computed(() => props.image != null && props.alt == null);
const showBadge = useAltBadge(
  missingAlt,
  `[slidev-theme-supa11y] image-right: image "${props.image}" has no "alt" in frontmatter. Add alt: '…', or alt: '' if it is decorative.`,
);
</script>

<template>
  <div class="supa11y-split">
    <div class="slidev-layout supa11y-content" :class="props.class">
      <slot />
    </div>
    <figure class="supa11y-figure">
      <img
        v-if="image"
        :src="resolveAssetUrl(image)"
        :alt="alt ?? ''"
        :style="{ objectFit: fit ?? 'cover' }"
      />
      <figcaption v-if="caption">
        {{ caption }}
      </figcaption>
      <span v-if="showBadge" class="supa11y-alt-warning">Missing alt text</span>
    </figure>
  </div>
</template>
