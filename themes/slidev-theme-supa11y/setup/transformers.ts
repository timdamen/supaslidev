import type { MarkdownTransformContext } from '@slidev/types';
import { defineTransformersSetup } from '@slidev/types';

const RE_MD_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;

/**
 * Dev/build-time lint: warn about markdown images without alt text.
 *
 * `![](photo.png)` renders as `<img alt="">`, which screen readers skip —
 * fine for decoration, silent data loss for meaningful images. Since intent
 * is invisible in `![](...)`, we warn and let the author decide.
 * Warning only; never fails a build.
 */
function lintImageAltText(ctx: MarkdownTransformContext) {
  const source = ctx.s.original;
  // Blank out fenced/inline code and HTML comments (speaker notes, commented-out
  // content) so documentation examples don't trigger warnings
  const masked = source.replace(/```[\s\S]*?```|`[^`\n]*`|<!--[\s\S]*?-->/g, (m) =>
    ' '.repeat(m.length),
  );
  for (const match of masked.matchAll(RE_MD_IMAGE)) {
    if (match[1].trim() === '') {
      const file = ctx.slide.source?.filepath ?? 'slides.md';
      console.warn(
        `\n[slidev-theme-supa11y] slide ${ctx.slide.index + 1} (${file}): ` +
          `image "${match[2]}" has no alt text. ` +
          `Write ![description](${match[2]}), or use <AccessibleImage decorative /> for decorative images.`,
      );
    }
  }
}

export default defineTransformersSetup(() => {
  return {
    pre: [lintImageAltText],
  };
});
