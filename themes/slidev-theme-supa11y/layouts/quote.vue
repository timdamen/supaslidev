<script setup lang="ts">
defineProps<{
  /** Attribution shown below the quote, outside the <blockquote> as the spec intends */
  author?: string;
}>();
</script>

<template>
  <div class="slidev-layout supa11y-quote quote">
    <figure>
      <blockquote>
        <slot />
      </blockquote>
      <figcaption v-if="author">— {{ author }}</figcaption>
    </figure>
  </div>
</template>
