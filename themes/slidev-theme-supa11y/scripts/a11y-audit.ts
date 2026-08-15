/**
 * axe-core accessibility audit for a Slidev deck.
 *
 * Boots the deck's dev server, walks every slide one by one (with all
 * v-clicks revealed via ?clicks=999), runs axe-core on each, and reports:
 *   - a per-slide summary + violation details in the terminal
 *   - a Markdown report (a11y-report.md) when problems are found
 *
 * Exit code 1 when any violation is found, so it works as a CI gate.
 *
 * Usage:
 *   tsx scripts/a11y-audit.ts [entry.md] [--port 3041] [--report a11y-report.md]
 */
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-chromium';

const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf-8');

/*
 * Rules that don't apply to a slide deck SPA where slides toggle with
 * v-show (hidden slides are display:none, so each scan sees one slide):
 * - page-has-heading-one: the deck's single h1 lives on the cover slide;
 *   content slides correctly start at h2.
 * - region / landmark-one-main: slides are not landmark-structured pages.
 */
const DISABLED_RULES = ['page-has-heading-one', 'region', 'landmark-one-main'];

interface AxeNode {
  target: string[];
  html: string;
  failureSummary?: string;
  /** true when the node is inside the slide content (or <html>/<body>), not Slidev's UI chrome */
  inDeck: boolean;
}

interface AxeViolation {
  id: string;
  impact?: string;
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
}

interface SlideResult {
  no: number;
  title: string;
  /** Violations in deck content — these gate the audit */
  violations: AxeViolation[];
  /** Violations only in Slidev's built-in UI — upstream, reported as informational */
  chrome: AxeViolation[];
}

const args = process.argv.slice(2);
function flagValue(name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--'))
    i++; // skip the flag's value too
  else positional.push(args[i]);
}
const entry = positional[0] ?? 'example.md';
const port = Number(flagValue('--port', '3041'));
const reportPath = resolve(themeRoot, flagValue('--report', 'a11y-report.md'));

const c = {
  red: (s: string) => `\x1B[31m${s}\x1B[0m`,
  green: (s: string) => `\x1B[32m${s}\x1B[0m`,
  yellow: (s: string) => `\x1B[33m${s}\x1B[0m`,
  dim: (s: string) => `\x1B[2m${s}\x1B[0m`,
  bold: (s: string) => `\x1B[1m${s}\x1B[0m`,
};
const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'] as const;
const impactColor = (impact?: string) =>
  impact === 'critical' || impact === 'serious'
    ? c.red(impact ?? '?')
    : c.yellow(impact ?? 'unknown');

async function waitForServer(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Slidev dev server did not become ready at ${url}`);
}

async function main() {
  console.log(c.bold(`\nsupa11y axe-core audit — ${entry}\n`));

  const server: ChildProcess = spawn(
    join(themeRoot, 'node_modules', '.bin', 'slidev'),
    [entry, '--port', String(port)],
    { cwd: themeRoot, stdio: 'ignore' },
  );

  const browser = await chromium.launch();
  const results: SlideResult[] = [];
  let deckTitle = entry;

  try {
    await waitForServer(`http://localhost:${port}/1`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    await page.goto(`http://localhost:${port}/1`);
    await page.waitForSelector('[data-slidev-no]');
    // The theme's announcer stamps aria-label="Slide 1 of N" on the slide
    // container; that's the reliable total (wrappers are lazy-rendered).
    await page.waitForFunction(() =>
      /of \d+/.test(document.querySelector('[data-slidev-no]')?.getAttribute('aria-label') ?? ''),
    );
    const total = await page.evaluate(() => {
      const label = document.querySelector('[data-slidev-no]')?.getAttribute('aria-label') ?? '';
      const m = label.match(/of (\d+)/);
      return m ? Number(m[1]) : document.querySelectorAll('[data-slidev-no]').length;
    });
    deckTitle = await page.title();
    console.log(c.dim(`${total} slides found\n`));

    for (let no = 1; no <= total; no++) {
      // clicks=999 reveals all v-click content so nothing escapes the scan
      await page.goto(`http://localhost:${port}/${no}?clicks=999`);
      await page.waitForSelector(`[data-slidev-no="${no}"]`);
      // let the fade transition and async content settle
      await page.waitForTimeout(500);
      await page.addScriptTag({ content: axeSource });
      const { title, violations } = await page.evaluate(
        async ({ disabledRules, no }) => {
          const axe = (window as any).axe;
          const rules: Record<string, { enabled: boolean }> = {};
          for (const r of disabledRules) rules[r] = { enabled: false };
          const res = await axe.run(document, { rules });
          const slideEl = document.querySelector(`[data-slidev-no="${no}"]`);
          const heading = slideEl?.querySelector('h1, h2, h3');
          return {
            title: heading?.textContent?.trim() || `Slide ${no}`,
            violations: res.violations.map((v: any) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              help: v.help,
              helpUrl: v.helpUrl,
              nodes: v.nodes.map((n: any) => {
                const selector = String(n.target[0] ?? '');
                let inDeck = true;
                try {
                  const el = document.querySelector(selector);
                  // Deck content lives in #slideshow; <html>/<body> issues (e.g.
                  // lang) are the deck's too. Everything else is Slidev's UI.
                  inDeck =
                    !el ||
                    el === document.documentElement ||
                    el === document.body ||
                    !!el.closest('#slideshow');
                } catch {}
                return {
                  target: n.target.map(String),
                  html: n.html,
                  failureSummary: n.failureSummary,
                  inDeck,
                };
              }),
            })),
          };
        },
        { disabledRules: DISABLED_RULES, no },
      );

      const deckViolations: AxeViolation[] = [];
      const chromeViolations: AxeViolation[] = [];
      for (const v of violations as AxeViolation[]) {
        const deckNodes = v.nodes.filter((n) => n.inDeck);
        const chromeNodes = v.nodes.filter((n) => !n.inDeck);
        if (deckNodes.length > 0) deckViolations.push({ ...v, nodes: deckNodes });
        if (chromeNodes.length > 0) chromeViolations.push({ ...v, nodes: chromeNodes });
      }

      results.push({ no, title, violations: deckViolations, chrome: chromeViolations });
      const status =
        deckViolations.length === 0
          ? c.green('✓ pass')
          : c.red(`✗ ${deckViolations.length} violation${deckViolations.length > 1 ? 's' : ''}`);
      const chromeNote =
        chromeViolations.length > 0 ? c.dim(` (+${chromeViolations.length} upstream UI)`) : '';
      console.log(
        `  Slide ${String(no).padStart(2)} / ${total}  ${status}${chromeNote}  ${c.dim(title)}`,
      );
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  const failed = results.filter((r) => r.violations.length > 0);
  const totalViolations = failed.reduce((sum, r) => sum + r.violations.length, 0);

  // Upstream Slidev-UI violations are identical on every slide — dedupe by rule
  const chromeById = new Map<string, AxeViolation>();
  for (const r of results) {
    for (const v of r.chrome) {
      if (!chromeById.has(v.id)) chromeById.set(v.id, v);
    }
  }
  if (chromeById.size > 0) {
    console.log(
      c.yellow(
        `\nUpstream Slidev UI issues (informational, not gating — report at github.com/slidevjs/slidev):`,
      ),
    );
    for (const v of chromeById.values()) {
      console.log(`  [${impactColor(v.impact)}] ${v.id} — ${v.help}`);
      console.log(c.dim(`    ${v.helpUrl}`));
    }
  }

  if (failed.length === 0) {
    console.log(
      c.green(c.bold(`\nAll ${results.length} slides pass the axe-core audit (deck content).\n`)),
    );
    return;
  }

  // ---- Terminal detail report -------------------------------------------
  console.log(c.red(c.bold(`\n${totalViolations} violation(s) on ${failed.length} slide(s):\n`)));
  for (const r of failed) {
    console.log(c.bold(`Slide ${r.no}: ${r.title}`));
    for (const v of r.violations) {
      console.log(`  [${impactColor(v.impact)}] ${v.id} — ${v.help}`);
      console.log(c.dim(`    ${v.helpUrl}`));
      for (const n of v.nodes.slice(0, 3)) {
        console.log(c.dim(`    ${n.target.join(' ')} → ${n.html.slice(0, 100)}`));
      }
      if (v.nodes.length > 3) console.log(c.dim(`    …and ${v.nodes.length - 3} more node(s)`));
    }
    console.log('');
  }

  // ---- Markdown report ---------------------------------------------------
  const sortedImpacts = (vs: AxeViolation[]) =>
    [...vs].sort(
      (a, b) => IMPACT_ORDER.indexOf(a.impact as any) - IMPACT_ORDER.indexOf(b.impact as any),
    );
  const lines: string[] = [
    `# Accessibility audit report`,
    ``,
    `- **Deck**: ${deckTitle} (\`${entry}\`)`,
    `- **Date**: ${new Date().toISOString()}`,
    `- **Tool**: axe-core (all v-clicks revealed per slide)`,
    `- **Result**: ${totalViolations} deck violation(s) on ${failed.length} of ${results.length} slides`,
    ``,
    `## Summary`,
    ``,
    `| Slide | Title | Violations | Worst impact |`,
    `| --- | --- | --- | --- |`,
    ...results.map((r) => {
      const worst = sortedImpacts(r.violations)[0]?.impact ?? '—';
      return `| ${r.no} | ${r.title.replace(/\|/g, '\\|')} | ${r.violations.length === 0 ? '✅ 0' : `❌ ${r.violations.length}`} | ${worst} |`;
    }),
    ``,
    `## Details`,
  ];
  for (const r of failed) {
    lines.push(``, `### Slide ${r.no}: ${r.title}`);
    for (const v of sortedImpacts(r.violations)) {
      lines.push(
        ``,
        `#### \`${v.id}\` (${v.impact ?? 'unknown'})`,
        ``,
        `${v.help} — [how to fix](${v.helpUrl})`,
        ``,
      );
      for (const n of v.nodes) {
        lines.push(`- \`${n.target.join(' ')}\``, `  \`\`\`html`, `  ${n.html}`, `  \`\`\``);
        if (n.failureSummary) lines.push(`  ${n.failureSummary.replace(/\n/g, '\n  ')}`);
      }
    }
  }
  if (chromeById.size > 0) {
    lines.push(
      ``,
      `## Upstream Slidev UI issues (informational)`,
      ``,
      `These occur in Slidev's built-in interface, not in the deck content, and do not fail the audit. Consider reporting them at [slidevjs/slidev](https://github.com/slidevjs/slidev/issues).`,
      ``,
    );
    for (const v of chromeById.values()) {
      lines.push(`- \`${v.id}\` (${v.impact ?? 'unknown'}): ${v.help} — [details](${v.helpUrl})`);
    }
  }
  writeFileSync(reportPath, `${lines.join('\n')}\n`);
  console.log(c.bold(`Markdown report written to ${reportPath}\n`));

  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
