# slidev-theme-supa11y

An accessibility-first [Slidev](https://sli.dev) theme aiming at WCAG 2.2 — clean, modern slides that also work for people using VoiceOver, NVDA, switch access, high zoom, or reduced motion.

> The theme moves every accessibility lever a Slidev theme _can_ reach, and documents the ones it can't (see [Limitations](#limitations)).

## Usage

```yaml
---
theme: supa11y
---
```

Slidev will offer to install `slidev-theme-supa11y` on first run, or add it yourself:

```bash
pnpm add slidev-theme-supa11y
```

## What you get

| Area           | Default                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fonts          | [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/) (sans) + Atkinson Hyperlegible Mono (code), **self-hosted** via Fontsource — no Google Fonts CDN, GDPR-clean, works offline                                                               |
| Contrast       | Token palette measured per scheme: body text 17.4:1 light / 14.4:1 dark (AAA), muted and links ≥ 7:1, focus ring ≥ 3:1 non-text                                                                                                                                    |
| Color scheme   | `both` — follows the viewer's OS preference; pin with `colorSchema:` headmatter                                                                                                                                                                                    |
| Code           | Shiki `github-light-high-contrast` / `github-dark-high-contrast`; ligatures disabled; line highlighting via background tint + left bar instead of Slidev's contrast-destroying opacity dimming; fixed line-number gutter contrast                                  |
| Images         | `image`, `image-left`, `image-right`, and `cover` layouts render a real `<img>` with an `alt` frontmatter prop (built-in layouts use CSS `background-image`, where alt text is impossible)                                                                         |
| Alt-text lint  | A markdown transformer warns in dev _and_ build output about `![](img.png)` images with no alt text — warnings only, never fails a build                                                                                                                           |
| Screen readers | aria-live slide announcements ("Slide 4 of 21: Title"), focus moves to the new slide, slides labeled `role="group"` + `aria-roledescription="slide"`, per-slide `document.title`, and v-click content hidden with `visibility` so AT can't read unrevealed content |
| Motion         | Default `transition: fade`; `prefers-reduced-motion: reduce` collapses all CSS transitions/animations to 1ms                                                                                                                                                       |
| Details        | 3px `:focus-visible` outline (SC 2.4.13), 44×44px nav buttons (SC 2.5.8 AAA size), underlined links (SC 1.4.1), 1.5 line height and ≤65ch measure (SC 1.4.8/1.4.12), no thin font weights                                                                          |

## Layouts

Overridden by the theme (all others inherit from Slidev and pick up the theme's typography):

| Layout                               | Frontmatter props                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `cover`                              | `image?`, `alt?` — image renders as a real `<img>` behind a contrast-guaranteeing scrim |
| `intro`, `end`, `section`            | —                                                                                       |
| `quote`                              | `author?` — attribution rendered as `<figcaption>` outside the `<blockquote>`           |
| `fact`                               | first paragraph becomes the 84px fact; the `##` heading is the kicker/slide title       |
| `statement`                          | —                                                                                       |
| `image`, `image-left`, `image-right` | `image`, `alt?`, `caption?`, `fit?` (`cover`/`contain`)                                 |

**Alt contract for all image layouts:** `alt: '…'` describes the image; `alt: ''` marks it decorative (silent); _omitting_ `alt` renders safe `alt=""` but shows a red dev-only badge + console warning.

## Components

- `<AccessibleImage src alt|decorative caption? width? height? fit? />` — inline images with enforced alt-or-decorative, `<figure>`/`<figcaption>` semantics, and a dev-only missing-alt badge.
- `<VisuallyHidden>` — content announced by screen readers but not displayed.

## Authoring checklist

The theme can't write your content. Keep decks accessible:

1. One `#` (h1) on the cover, one `##` (h2) per slide, `###` within slides — never skip levels. A deck is a single page; per-slide h1s produce a document with dozens of h1s.
2. Describe every meaningful image; explicitly mark the rest decorative.
3. Never rely on color alone; pair it with text, shape, or position.
4. Check custom colors — aim for 7:1, minimum 4.5:1 (3:1 for ≥24px text).
5. Non-English decks: set per-slide `lang:` frontmatter and override `index.html` for the document language.
6. Share the hosted HTML build; Slidev's PDF exports are untagged.

## Overriding defaults

Everything is a default, not a lock-in:

- **Fonts**: set `fonts:` in headmatter (e.g. `provider: google` to load different families).
- **Shiki themes**: add your own `setup/shiki.ts` — user setups win over the theme's.
- **Colors**: redefine the `--supa11y-*` custom properties in your deck's `style` block (keep them ≥ 4.5:1, please).
- **Transition**: any `transition:` headmatter overrides the default fade.

## Limitations

Upstream issues a theme cannot fix:

- `<html lang="en">` is hardcoded in Slidev's `index.html` — override `index.html` in your project root for other languages ([per-slide `lang:` works](https://sli.dev)).
- PDF exports are untagged and inaccessible ([slidev#2273](https://github.com/slidevjs/slidev/issues/2273)) — distribute the HTML build.
- Built-in UI strings are English-only ([slidev#2205](https://github.com/slidevjs/slidev/issues/2205)).
- `v-motion` animations are JS-driven and ignore `prefers-reduced-motion` — avoid them or gate them yourself.

## Development

```bash
pnpm --filter slidev-theme-supa11y dev       # example deck with live theme editing
pnpm --filter slidev-theme-supa11y build     # build the example deck
pnpm --filter slidev-theme-supa11y export    # export the example deck
pnpm --filter slidev-theme-supa11y test:a11y # axe-core audit of every slide
```

### Automated axe-core audit

`test:a11y` boots the deck, walks **every slide one by one** (with all v-clicks revealed), and runs [axe-core](https://github.com/dequelabs/axe-core) on each:

- per-slide pass/fail summary + violation details in the terminal
- a Markdown report (`a11y-report.md`) written when deck violations are found
- exit code 1 on violations, so it works as a CI gate
- violations inside Slidev's built-in UI (not fixable from a deck or theme) are reported separately as informational and don't fail the audit

Audit any other deck with `tsx scripts/a11y-audit.ts path/to/slides.md --port 3041 --report my-report.md`.

The theme releases on its own cycle, independent of the supaslidev packages:

```bash
pnpm release:theme   # bumps + tags theme-vX.Y.Z; CI publishes to npm
```

## License

MIT © [Tim Damen](https://timdamen.io)
