import { defineShikiSetup } from '@slidev/types';

/**
 * Default code highlighting to GitHub's high-contrast themes.
 *
 * Measured against WCAG 2.x: every token in github-dark-high-contrast is
 * >= 9.2:1 on its #0a0c10 background (AAA); github-light-high-contrast is
 * fully AA with only comments (5.04:1) below AAA on #ffffff.
 *
 * Decks can still override this with their own `setup/shiki.ts` —
 * user-project setups load after theme setups and win.
 */
export default defineShikiSetup(() => {
  return {
    themes: {
      dark: 'github-dark-high-contrast',
      light: 'github-light-high-contrast',
    },
  };
});
