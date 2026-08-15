import { useNav, useSlideContext } from '@slidev/client';
import type { Ref } from 'vue';
import { computed } from 'vue';

/**
 * Shared gating for the red "Missing alt text" badge.
 *
 * import.meta.env.DEV alone is NOT enough: `slidev export` runs the deck on a
 * Vite dev server, so DEV is true while PDFs/PNGs/thumbnails are captured.
 * isPrintMode covers the /print and /export routes; the render-context check
 * keeps the badge out of overview and presenter next-slide previews.
 */
export function useAltBadge(invalid: Ref<boolean>, message: string) {
  const { isPrintMode } = useNav();
  const { $renderContext } = useSlideContext();
  const showBadge = computed(
    () =>
      import.meta.env.DEV &&
      invalid.value &&
      !isPrintMode.value &&
      ['slide', 'presenter'].includes($renderContext.value),
  );
  if (import.meta.env.DEV && invalid.value) console.warn(message);
  return showBadge;
}
