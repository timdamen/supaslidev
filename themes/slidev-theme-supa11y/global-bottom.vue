<script setup lang="ts">
import { slidesTitle, useNav } from '@slidev/client';
import { onMounted, onUnmounted, ref, watch } from 'vue';

/**
 * Screen-reader support Slidev doesn't ship:
 *
 * 1. An aria-live region announcing "Slide N of M: Title" on navigation —
 *    without it, slide changes are completely silent to screen readers.
 * 2. Per-slide document.title (SC 2.4.2), which Slidev leaves static.
 * 3. Focus + landmark management: the current slide container gets
 *    role="group", aria-roledescription="slide", an aria-label, and focus,
 *    so the virtual cursor lands on the new content instead of staying on
 *    stale text.
 */
const { currentSlideNo, currentSlideRoute, total, isPresenter } = useNav();

const announcement = ref('');
let announceTimer: ReturnType<typeof setTimeout> | undefined;

function slideTitle(): string | undefined {
  return currentSlideRoute.value?.meta?.slide?.title;
}

function slideLabel(): string {
  const base = `Slide ${currentSlideNo.value} of ${total.value}`;
  const title = slideTitle();
  return title ? `${base}: ${title}` : base;
}

function currentSlideElement(): HTMLElement | null {
  // Scoped to #slideshow: overview/presenter previews also render slide
  // wrappers with data-slidev-no, and those must not be stamped or focused
  return document.querySelector<HTMLElement>(
    `#slideshow [data-slidev-no="${currentSlideNo.value}"]`,
  );
}

function stampSlideSemantics(moveFocus: boolean) {
  const el = currentSlideElement();
  if (!el) return;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-roledescription', 'slide');
  el.setAttribute('aria-label', slideLabel());
  if (moveFocus && !isPresenter.value) {
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
}

onMounted(() => stampSlideSemantics(false));
onUnmounted(() => clearTimeout(announceTimer));

watch(currentSlideNo, () => {
  if (typeof document === 'undefined') return;
  const title = slideTitle();
  document.title = title
    ? `${title} · ${slidesTitle}`
    : `${slidesTitle} (${currentSlideNo.value}/${total.value})`;
  // Debounce past the slide transition so AT picks up one clean announcement
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    announcement.value = slideLabel();
    stampSlideSemantics(true);
  }, 150);
});
</script>

<template>
  <div class="supa11y-sr-only" role="status" aria-live="polite">
    {{ announcement }}
  </div>
</template>
