---
theme: ./
title: supa11y — an accessibility-first Slidev theme
info: |
  ## slidev-theme-supa11y
  An accessibility-first Slidev theme aiming at WCAG 2.2:
  AAA contrast tokens, hyperlegible self-hosted fonts, screen-reader fixes,
  real image elements with alt text, and high-contrast code highlighting.
drawings:
  persist: false
mdc: true
---

# supa11y

A Slidev theme where accessibility **is** the design

<div class="supa11y-muted mt-8">

Clean slides for everyone
</div>

<!--
If you are running a screen reader right now: navigating to this deck's next
slide will be announced as "Slide 2 of 21" plus the slide title. Slidev does
not do that out of the box — this theme adds a polite aria-live region, moves
focus to the new slide, and labels each slide as a group with
aria-roledescription "slide".

Every slide in this deck explains one thing the theme does for you.
-->

---

## Why accessible slides?

<v-clicks>

- Decks outlive the talk: they get **shared, embedded, and read** in browsers — often with assistive technology.
- Rooms are hostile environments: **distance, glare, small screens** turn every viewer into a low-vision viewer.
- Slidev decks are web pages, so **WCAG applies** — and most slide themes fail it badly.
- Accessible defaults cost the author nothing when the **theme does the work**.

</v-clicks>

<!--
By the way: these bullets appear with v-click. In stock Slidev, hidden v-click
content is only hidden with opacity: 0 — screen readers read all of it
upfront, and the keyboard can Tab into invisible links. This theme layers
visibility: hidden on top, so unrevealed content is hidden from assistive
tech too, and appears to it exactly when it appears visually.
-->

---

## What the theme does for you

- **Fonts**: Atkinson Hyperlegible Next + Mono, self-hosted — no Google CDN
- **Contrast**: AAA (7:1+) body text tokens in light _and_ dark scheme
- **Code**: GitHub high-contrast Shiki themes, readable line highlighting
- **Images**: layouts with real `<img>` elements, alt text as a first-class prop
- **Screen readers**: slide announcements, focus management, v-click fixes
- **Motion**: gentle fade by default, `prefers-reduced-motion` respected
- **Details**: 3px focus rings, 44px nav targets, underlined links

<!--
The rest of the deck demonstrates each of these. The theme is opinionated
where accessibility demands it, and stays out of your way everywhere else —
all built-in Slidev layouts and syntax keep working.
-->

---

## Typography: hyperlegible by default

The theme ships **Atkinson Hyperlegible Next**, commissioned by the Braille Institute. Every character is designed to be unmistakable at a distance:

<div class="text-4xl font-mono my-6" aria-label="Examples of easily confused characters: capital I, lowercase l, digit one; capital O and zero; capital B and eight">

`Il1` — `O0` — `B8` — `rn m`

</div>

- Slashed zero, serifed capital I, tailed lowercase l
- Fonts are **bundled with the theme** — GDPR-clean, works offline at venues
- System font fallbacks stay enabled; override per deck via `fonts:` headmatter

<!--
Evidence note: so-called dyslexia fonts like OpenDyslexic repeatedly fail in
studies — a 15-study meta-analysis found no reliable benefit. What actually
helps every reader: a clean sans-serif, generous sizes, and real spacing.
That is exactly what this theme defaults to.

The mono sibling, Atkinson Hyperlegible Mono, handles all code you will see
later in this deck.
-->

---

## Readable by default

| Element     | Canvas size | On a 1080p projector |
| ----------- | ----------- | -------------------- |
| Body text   | 22px        | ~43px (≈32pt)        |
| Slide title | 36px        | ~71px                |
| Code        | 15px        | ~29px                |

- Line height **1.5** — survives WCAG text-spacing overrides (SC 1.4.12)
- Prose capped at **65ch** — under the 80-character AAA ceiling (SC 1.4.8)
- No thin font weights: 400 / 600 / 700 only

<!--
Slide fonts are sized on Slidev's 980 by 552 canvas and scale up with the
display, so 22 pixel body text lands well above the "30pt when projected"
guidance used by universities and government a11y teams.
-->

---

## Color: contrast you can count on

Every token is measured, in both schemes:

| Token      | Light     | Ratio      | Dark      | Ratio      |
| ---------- | --------- | ---------- | --------- | ---------- |
| Body text  | `#1A1A1A` | **17.4:1** | `#E5E7EB` | **14.4:1** |
| Muted text | `#4B5563` | **7.6:1**  | `#A5B4C4` | **8.4:1**  |
| Links      | `#1E40AF` | **8.7:1**  | `#93C5FD` | **9.9:1**  |
| Accent     | `#1D4ED8` | 6.7:1      | `#60A5FA` | **7.0:1**  |

Links are also <a href="https://sli.dev">underlined</a> — never color alone (SC 1.4.1).

<!--
Toggle dark mode with the moon button in the nav bar: every pairing stays
AAA for body text. The tokens are exposed as CSS custom properties
(--supa11y-bg, --supa11y-fg, --supa11y-muted, --supa11y-accent, and so on),
so anything you build on top inherits accessible colors by default.
-->

---

## Code: high contrast by default

```ts
// github-dark-high-contrast / github-light-high-contrast
function announce(no: number, total: number, title?: string): string {
  const base = `Slide ${no} of ${total}`;
  return title ? `${base}: ${title}` : base;
}
```

- Dark scheme: every token ≥ **9.2:1** — AAA across the board
- Light scheme: fully AA, nearly all AAA
- Ligatures disabled: `=>` is always the two characters you type

<!--
The Shiki setup ships in the theme, so you write ordinary fenced code blocks
and get accessible highlighting for free. Your own setup/shiki.ts still wins
if you want something else.

Ligatures matter in teaching contexts: the audience has to type what they
see, so the glyphs should match the characters, one to one.
-->

---

## Line highlighting that stays readable

```ts {1|3-4|all}
const palette = defineTokens('supa11y');

palette.body.contrast = '17.4:1'; // AAA
palette.muted.contrast = '7.6:1'; // still AAA

export default palette;
```

Highlighted lines get a **background tint + left bar** — position and shape, not color alone.

<!--
Stock Slidev dims non-highlighted lines to 30 percent opacity, which drops
every token below 2.5 to 1 — unreadable. This theme keeps dimming mild on
dark (everything stays above 4.9 to 1) and disables it entirely on light,
where even mild dimming would push comments below AA.
-->

---

## Line numbers

```ts {2|4}{lines:true}
const total = slides.length;
const current = page.no;

announce(current, total);
```

Numbers are CSS counters in the gutter: skipped by screen readers, excluded
from copy, recolored to the GitHub high-contrast gutter grays.

<!--
Line highlighting and line numbers combine: the highlighted line keeps its
tint and left bar, and the numbers stay aligned in the gutter.
-->

---

## Magic Move

````md magic-move {lines: true}
```ts
const msg = 'hello';
console.log(msg);
```
```ts {2}
const msg = 'hello supa11y';
console.log(msg.toUpperCase());
```
````

Magic Move renders one span per token, not per line — the theme only tints
tokens while a range is active, and never gives them line geometry.

<!--
Click once: the code morphs and line 2 gets its range tint. Both states keep
their line numbers in the gutter.
-->

---
layout: image-right
image: /demo-chart.svg
alt: Bar chart showing assistive technology use growing each year from 2022 to 2025
caption: A real <img> element — screen readers announce the alt text
---

## Images with real alt text

Built-in image layouts paint images as CSS `background-image` — **alt text is impossible there**.

This theme's `image`, `image-left`, and `image-right` layouts render a real `<img>`:

```yaml
layout: image-right
image: /demo-chart.svg
alt: Bar chart showing assistive
  technology use growing each year
caption: Optional visible caption
```

<!--
The alt you see in this slide's frontmatter is exactly what VoiceOver reads
for the chart on the right. Set alt to an empty string for purely decorative
images, and the theme stays silent about them.
-->

---

## Inline images: `<AccessibleImage>`

<div class="grid grid-cols-[1.5fr_1fr] gap-8 items-start">
<div>

```html
<AccessibleImage
  src="/demo-chart.svg"
  alt="Bar chart of assistive tech use, 2022 to 2025"
  caption="Rendered as figure + figcaption"
  width="220"
/>

<AccessibleImage src="/divider.svg" decorative />
```

</div>

<AccessibleImage src="/demo-chart.svg"
  alt="Bar chart of assistive tech use, 2022 to 2025"
  caption="Rendered as figure + figcaption" width="220" height="253" fit="contain" />

</div>

<!--
The component enforces a simple contract: either you describe the image, or
you explicitly mark it decorative. Forget both and the deck still renders
safely with empty alt — but you get a red "Missing alt text" badge in dev
and a console warning, so it never survives to showtime unnoticed.
-->

---

## The theme lints your alt text

Forget the alt on a plain markdown image…

```md
![](team-photo.png)
```

…and the dev server and build both tell you:

```text
[slidev-theme-supa11y] slide 11 (slides.md): image "team-photo.png"
has no alt text. Write ![description](team-photo.png), or use
<AccessibleImage decorative /> for decorative images.
```

Warnings only — your build never breaks.

<!--
This runs as a Slidev markdown transformer that ships inside the theme, so
it also fires in CI builds. Markdown images with alt text already work
perfectly in Slidev — the lint just catches the empty ones.
-->

---

## What screen readers get

- **Slide announcements** — "Slide 12 of 21: What screen readers get" via a polite live region
- **Focus follows navigation** — the new slide container is focused, so the virtual cursor never sits on stale content
- **Landmarks** — each slide is a `group` with `aria-roledescription="slide"`
- **Real page titles** — the browser tab tracks the current slide (SC 2.4.2)
- **v-click content is truly hidden** until revealed — no reading ahead, no tabbing into invisible links

<!--
All of this ships in one small global component inside the theme. None of it
requires anything from the deck author — write markdown, get semantics.
-->

---

## Motion, only when welcome

- Default transition is a **gentle fade** — no sliding, the common vestibular trigger
- Under `prefers-reduced-motion: reduce`, **all** CSS transitions and animations collapse to 1ms — including v-click fades
- One honest caveat: JS-driven `v-motion` animations can't be stopped by CSS — avoid them, or gate them on the user's motion preference

<!--
Try it: enable "Reduce motion" in your OS settings and reload — slides now
switch instantly. WCAG 2.3.3 asks for exactly this, and Slidev itself
currently has no reduced-motion support at all.
-->

---
layout: section
---

## The layouts

<!--
This is the section layout: a divider with a strong left accent bar. The next
three slides demo quote, fact, and statement. All other built-in Slidev
layouts — two-cols, center, iframe, and friends — keep working and inherit the
theme's typography and colors.
-->

---
layout: quote
author: Sir Tim Berners-Lee
---

The power of the Web is in its universality. Access by everyone regardless of disability is an essential aspect.

<!--
The quote layout renders a real blockquote element, with the attribution
outside it in a figcaption — as the HTML spec intends. Screen readers
announce the quotation semantics.
-->

---
layout: fact
---

## Minimum contrast for this theme's body text

7:1+

AAA in light and dark — measured, not eyeballed

<!--
The fact layout: a modest kicker heading (which is also what gets announced
as the slide title), and the fact itself in 84px accent type.
-->

---
layout: statement
---

## Accessibility is a design constraint, not a checklist item.

<!--
The statement layout for a single strong claim, set at 44px and centered.
-->

---
layout: two-cols
---

## Built-ins still work

This is Slidev's own `two-cols` layout — untouched by the theme, but inheriting its type and colors.

::right::

<div class="pl-6">

- All built-in layouts remain available
- All Slidev syntax and components work
- Override anything per deck: fonts, transitions, Shiki themes

</div>

<!--
The theme only replaces layouts where accessibility demanded different
markup — cover, the image layouts, quote, fact, statement, section, intro,
and end. Everything else is stock Slidev.
-->

---

## Your part: a short checklist

The theme can't write your content. Keep it accessible:

1. **One `#` title** on the cover, **one `##` per slide** — never skip levels
2. **Describe every meaningful image** (`alt:`), mark the rest decorative
3. Don't convey meaning by **color alone** — pair it with text or shape
4. Custom colors? Check them: aim for **7:1**, minimum 4.5:1
5. Set your deck's language when it isn't English (per-slide `lang:` frontmatter)
6. Share the **hosted HTML build** — Slidev's exported PDFs are untagged and inaccessible

<!--
The heading rule exists because a deck is one single-page app, not many
documents: one h1 for the deck, h2 for each slide. That is also what
Slidev's own table of contents expects.
-->

---

## Honest limitations

A theme can't fix everything. Still upstream in Slidev:

- `<html lang="en">` is hardcoded — override `index.html` in your project for other languages
- PDF exports are untagged (slidev#2273) — prefer the HTML build
- Presenter/overview UI strings are English-only (slidev#2205)
- `v-motion` ignores reduced-motion preferences

<!--
Being honest about the boundary matters: claiming full WCAG 2.2 compliance
would be false advertising. The theme moves every lever a theme can reach,
and documents the ones it cannot.
-->

---
layout: end
---

# Thanks

**slidev-theme-supa11y**

[github.com/timdamen/supaslidev](https://github.com/timdamen/supaslidev/themes/slidev-theme-supa11y)

<!--
Use it with: theme: supa11y in your deck's headmatter.
Feedback and audits welcome — accessibility is never finished.
-->
