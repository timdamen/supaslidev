<script setup lang="ts">
import { resolveAssetUrl } from '@slidev/client';
import { computed } from 'vue';
import { useAltBadge } from '../helpers/useAltBadge';

/**
 * Drop-in image with an enforced alt contract:
 * - meaningful image  -> <AccessibleImage src="…" alt="What it shows" />
 * - decorative image  -> <AccessibleImage src="…" decorative />
 * - neither           -> renders alt="" (AT never hears a filename) plus a
 *                        dev-only warning badge so it gets fixed before showtime.
 */
const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    /** Explicitly mark the image as decorative: alt="" and skipped by AT */
    decorative?: boolean;
    /** Visible caption; renders <figure>/<figcaption> semantics */
    caption?: string;
    width?: string | number;
    height?: string | number;
    fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  }>(),
  { fit: 'contain' },
);

const effectiveAlt = computed(() => (props.decorative ? '' : (props.alt ?? '')));
const invalid = computed(() => !props.decorative && (props.alt == null || props.alt.trim() === ''));
const showBadge = useAltBadge(
  invalid,
  `[slidev-theme-supa11y] <AccessibleImage src="${props.src}"> needs alt="…" or the decorative flag.`,
);
</script>

<template>
  <figure class="supa11y-inline-figure">
    <img
      :src="resolveAssetUrl(src)"
      :alt="effectiveAlt"
      :width="width"
      :height="height"
      :style="{ objectFit: fit }"
    />
    <figcaption v-if="caption">
      {{ caption }}
    </figcaption>
    <span v-if="showBadge" class="supa11y-alt-warning">Missing alt text</span>
  </figure>
</template>

<style scoped>
.supa11y-inline-figure {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  margin: 0;
  max-width: 100%;
}

.supa11y-inline-figure img {
  max-width: 100%;
}

.supa11y-inline-figure figcaption {
  font-size: 18px;
  color: var(--supa11y-muted);
  padding-top: 0.4rem;
}
</style>
