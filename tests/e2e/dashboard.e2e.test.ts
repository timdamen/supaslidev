import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserContext, Page } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  startDashboard,
  stopDashboardAsync,
  waitForServer,
  getBaseProjectPath,
  getTmpDir,
  cleanupProject,
  createBrowserContext,
} from './setup/test-utils.js';

function createSecondPresentation(projectPath: string): void {
  const presentationsDir = join(projectPath, 'presentations');
  const secondPresentationDir = join(presentationsDir, 'second-deck');

  mkdirSync(secondPresentationDir, { recursive: true });

  const packageJson = {
    name: '@supaslidev/second-deck',
    private: true,
    type: 'module',
    scripts: {
      dev: 'slidev --open',
      build: 'slidev build',
      export: 'slidev export',
    },
    dependencies: {
      '@slidev/cli': 'catalog:',
      '@slidev/theme-default': 'catalog:',
      vue: 'catalog:',
    },
  };

  writeFileSync(join(secondPresentationDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  const slidesContent = `---
title: second-deck
theme: default
---

# second-deck

Welcome to the second presentation

---

## Slide 2

Content for the second slide
`;

  writeFileSync(join(secondPresentationDir, 'slides.md'), slidesContent);
  writeFileSync(join(secondPresentationDir, '.gitignore'), 'node_modules\ndist\n');
  writeFileSync(join(secondPresentationDir, '.npmrc'), 'shamefully-hoist=true\n');
}

describe('Dashboard Display E2E', () => {
  const DASHBOARD_TEST_PROJECT = 'dashboard-display-test';
  let context: BrowserContext;
  let page: Page;
  let dashboardUrl: string;
  let projectPath: string;

  beforeAll(async () => {
    cleanupProject(DASHBOARD_TEST_PROJECT);

    const baseProjectPath = getBaseProjectPath();
    projectPath = join(getTmpDir(), DASHBOARD_TEST_PROJECT);

    cpSync(baseProjectPath, projectPath, { recursive: true });

    context = await createBrowserContext();
    page = await context.newPage();

    const dashboardInfo = await startDashboard(projectPath);
    dashboardUrl = dashboardInfo.url;

    await waitForServer(dashboardUrl);
  }, 120000);

  afterAll(async () => {
    await context?.close();
    await stopDashboardAsync();
    cleanupProject(DASHBOARD_TEST_PROJECT);
  });

  describe('dashboard startup', () => {
    it('starts and loads without errors', async () => {
      const response = await page.goto(dashboardUrl);

      expect(response?.ok()).toBe(true);

      const pageTitle = await page.locator('h1').textContent();
      expect(pageTitle).toBe('Supaslidev');
    });
  });

  describe('presentation display', () => {
    it('shows presentation name correctly', async () => {
      await page.goto(dashboardUrl);
      await page.waitForSelector('.card');

      const cardTitle = await page.locator('.card-title').first().textContent();
      expect(cardTitle).toBe('test-deck');
    });

    it('shows presentation card with expected elements', async () => {
      await page.goto(dashboardUrl);
      await page.waitForSelector('.card');

      const card = page.locator('.card').first();
      expect(await card.isVisible()).toBe(true);

      const cardTitle = card.locator('.card-title');
      expect(await cardTitle.isVisible()).toBe(true);

      const presentButton = card.locator('.present-button');
      expect(await presentButton.isVisible()).toBe(true);
    });

    it('each presentation card has a present button', async () => {
      await page.goto(dashboardUrl);
      await page.waitForSelector('.card');

      const cards = page.locator('.card');
      const cardCount = await cards.count();

      for (let i = 0; i < cardCount; i++) {
        const card = cards.nth(i);
        const presentButton = card.locator('.present-button');

        expect(await presentButton.isVisible()).toBe(true);
        expect(await presentButton.textContent()).toContain('dev');
        expect(await presentButton.isEnabled()).toBe(true);
      }
    });
  });

  describe('multiple presentations', () => {
    beforeAll(async () => {
      createSecondPresentation(projectPath);

      await stopDashboardAsync();

      const dashboardInfo = await startDashboard(projectPath);
      dashboardUrl = dashboardInfo.url;

      await waitForServer(dashboardUrl);
    }, 60000);

    it('shows 2 presentation cards after creating second presentation', async () => {
      await page.goto(dashboardUrl);
      await page.waitForSelector('.card');

      const cards = page.locator('.card');
      const cardCount = await cards.count();

      expect(cardCount).toBe(2);
    });

    it('displays both presentation names correctly', async () => {
      await page.goto(dashboardUrl);
      await page.waitForSelector('.card');

      const cardTitles = await page.locator('.card-title').allTextContents();

      expect(cardTitles).toContain('test-deck');
      expect(cardTitles).toContain('second-deck');
    });

    it('each card in multiple presentations view has a present button', async () => {
      await page.goto(dashboardUrl);
      await page.waitForSelector('.card');

      const presentButtons = page.locator('.present-button');
      const buttonCount = await presentButtons.count();

      expect(buttonCount).toBe(2);

      for (let i = 0; i < buttonCount; i++) {
        const button = presentButtons.nth(i);
        expect(await button.isVisible()).toBe(true);
        expect(await button.textContent()).toContain('dev');
      }
    });
  });

  describe('UI elements', () => {
    it('has a New Presentation button', async () => {
      await page.goto(dashboardUrl);

      const newButton = page.locator('.btn-new');
      expect(await newButton.isVisible()).toBe(true);
      expect(await newButton.textContent()).toContain('new');
    });

    it('has a search input', async () => {
      await page.goto(dashboardUrl);

      const searchInput = page.locator('.filter-input input');
      expect(await searchInput.isVisible()).toBe(true);
      expect(await searchInput.getAttribute('placeholder')).toBe(
        'Search presentations by title...',
      );
    });

    it('search filters presentations correctly', async () => {
      await page.goto(dashboardUrl);
      await page.waitForSelector('.card');

      const searchInput = page.locator('.filter-input input');
      await searchInput.fill('second');

      await page.waitForTimeout(400);

      const visibleCards = page.locator('.card');
      expect(await visibleCards.count()).toBe(1);

      const cardTitle = await visibleCards.first().locator('.card-title').textContent();
      expect(cardTitle).toBe('second-deck');
    });
  });

  describe('terminal bar', () => {
    it('has a terminal input field', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      expect(await terminalInput.isVisible()).toBe(true);
      expect(await terminalInput.getAttribute('placeholder')).toBe('Type a command...');
    });

    it('shows ghost text autocomplete when typing', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      await terminalInput.focus();
      await terminalInput.fill('Ne');

      await page.waitForTimeout(100);

      const ghostText = page.locator('.ghost-suffix');
      expect(await ghostText.isVisible()).toBe(true);
      expect(await ghostText.textContent()).toBe('w');
    });

    it('shows dropdown with matching commands', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      await terminalInput.focus();
      await terminalInput.fill('Present');

      await page.waitForTimeout(100);

      const dropdown = page.locator('.dropdown');
      expect(await dropdown.isVisible()).toBe(true);

      const dropdownItems = page.locator('.dropdown-item');
      expect(await dropdownItems.count()).toBeGreaterThan(0);
    });

    it('clears input after executing command', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      await terminalInput.focus();
      await terminalInput.fill('new');
      await terminalInput.press('Enter');

      await page.waitForTimeout(200);

      expect(await terminalInput.inputValue()).toBe('');
    });
  });

  describe('terminal command validation', () => {
    it('shows warning toast for present command with non-existent presentation', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      await terminalInput.focus();
      await terminalInput.fill('present non-existent-deck');
      await terminalInput.press('Enter');

      const toastTitle = page.locator('[data-slot="title"]').getByText('Presentation not found');
      await toastTitle.waitFor({ state: 'visible', timeout: 5000 });

      expect(await toastTitle.isVisible()).toBe(true);
    });

    it('shows warning toast for export command with non-existent presentation', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      await terminalInput.focus();
      await terminalInput.fill('export non-existent-deck');
      await terminalInput.press('Enter');

      const toastTitle = page.locator('[data-slot="title"]').getByText('Presentation not found');
      await toastTitle.waitFor({ state: 'visible', timeout: 5000 });

      expect(await toastTitle.isVisible()).toBe(true);
    });

    it('shows warning toast for unknown command', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      await terminalInput.focus();
      await terminalInput.fill('unknowncommand');
      await terminalInput.press('Enter');

      const toastTitle = page.locator('[data-slot="title"]').getByText('Unknown command');
      await toastTitle.waitFor({ state: 'visible', timeout: 5000 });

      expect(await toastTitle.isVisible()).toBe(true);
    });

    it('opens create dialog when executing new command', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      await terminalInput.focus();
      await terminalInput.fill('new');
      await terminalInput.press('Enter');

      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });

      expect(await dialog.isVisible()).toBe(true);
    });
  });

  describe('CreatePresentationDialog', () => {
    async function openCreateDialog() {
      await page.goto(dashboardUrl);
      const newButton = page.locator('.btn-new');
      await newButton.click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 });
    }

    async function closeDialog() {
      const cancelButton = page.locator('[role="dialog"] button:has-text("Cancel")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 5000 });
      }
    }

    describe('form validation', () => {
      it('validates name field with appropriate error messages', async () => {
        await openCreateDialog();

        const nameInput = page.locator('[role="dialog"] input[placeholder="my-presentation"]');
        const dialog = page.locator('[role="dialog"]');

        // Initially no error
        const hasErrorColor = await nameInput.evaluate((el) => {
          const classes = el.className;
          return classes.includes('error') || classes.includes('ring-red');
        });
        expect(hasErrorColor).toBe(false);

        // Empty name shows error on blur
        await nameInput.focus();
        await nameInput.blur();
        await page.waitForTimeout(100);
        const requiredError = dialog.getByText('Name is required');
        expect(await requiredError.isVisible()).toBe(true);

        // Invalid format shows format error
        await nameInput.fill('Invalid Name');
        await nameInput.blur();
        await page.waitForTimeout(100);
        const formatError = dialog.getByText('Use lowercase letters, numbers, and hyphens only');
        expect(await formatError.isVisible()).toBe(true);

        // Valid name clears error
        await nameInput.fill('valid-name');
        await page.waitForTimeout(100);
        expect(await formatError.isVisible()).toBe(false);

        await closeDialog();
      });
    });

    describe('presentation creation flow', () => {
      it('creates presentation with all options and verifies complete flow', async () => {
        const presentationName = 'complete-flow-test';
        const presentationTitle = 'Complete Flow Test Presentation';
        const presentationDescription = 'Testing the complete creation flow end-to-end';
        const presentationDir = join(projectPath, 'presentations', presentationName);

        // Step 1: Open dialog and verify UI elements
        await openCreateDialog();
        const dialog = page.locator('[role="dialog"]');

        // Verify template options are present
        const templates = dialog.locator('label');
        expect(await templates.count()).toBeGreaterThanOrEqual(3);

        const defaultTemplate = dialog.locator('label:has-text("Default")');
        const seriphTemplate = dialog.locator('label:has-text("Seriph")');
        const appleTemplate = dialog.locator('label:has-text("Apple Basic")');
        expect(await defaultTemplate.isVisible()).toBe(true);
        expect(await seriphTemplate.isVisible()).toBe(true);
        expect(await appleTemplate.isVisible()).toBe(true);

        // Step 2: Fill form with all fields
        const nameInput = dialog.locator('input[placeholder="my-presentation"]');
        const titleInput = dialog.locator('input[placeholder="Welcome to My Presentation"]');
        const descriptionInput = dialog.locator('textarea[placeholder="A presentation about..."]');
        const createButton = dialog.locator('button:has-text("Create Presentation")');

        await nameInput.fill(presentationName);
        await titleInput.fill(presentationTitle);
        await descriptionInput.fill(presentationDescription);
        await seriphTemplate.click();

        // Step 3: Submit and verify loading state
        await createButton.click();

        // Check for loading state (button text changes or becomes disabled)
        const loadingState = await Promise.race([
          dialog
            .locator('button:has-text("Creating...")')
            .waitFor({ state: 'visible', timeout: 2000 })
            .then(() => true),
          createButton.evaluate((el) => el.hasAttribute('disabled')).then((disabled) => disabled),
        ]).catch(() => false);

        // Loading state should appear (either "Creating..." text or disabled button)
        expect(loadingState).toBeTruthy();

        // Wait for dialog to close
        await dialog.waitFor({ state: 'hidden', timeout: 60000 });

        // Step 4: Verify file system - presentation directory created
        expect(existsSync(presentationDir)).toBe(true);

        // Step 5: Verify slides.md content
        const slidesPath = join(presentationDir, 'slides.md');
        expect(existsSync(slidesPath)).toBe(true);
        const slidesContent = readFileSync(slidesPath, 'utf-8');

        // Verify frontmatter
        expect(slidesContent).toContain('title: ' + presentationTitle);
        expect(slidesContent).toContain('theme: seriph');
        // Verify description is in the content
        expect(slidesContent).toContain(presentationDescription);

        // Step 6: Verify package.json with catalog dependencies
        const packageJsonPath = join(presentationDir, 'package.json');
        expect(existsSync(packageJsonPath)).toBe(true);
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        expect(packageJson.name).toBe(`@supaslidev/${presentationName}`);
        expect(packageJson.private).toBe(true);
        expect(packageJson.dependencies['@slidev/cli']).toBe('catalog:');
        expect(packageJson.dependencies['vue']).toBe('catalog:');

        // Step 7: Verify presentation appears in dashboard
        await page.waitForFunction(
          (title) => {
            const cards = document.querySelectorAll('.card-title');
            return Array.from(cards).some((el) => el.textContent?.includes(title));
          },
          presentationTitle,
          { timeout: 10000 },
        );

        const card = page.locator(`.card:has-text("${presentationTitle}")`);
        expect(await card.isVisible()).toBe(true);

        // Verify theme badge on card
        const themeBadge = card.locator('text=--theme=seriph');
        expect(await themeBadge.count()).toBeGreaterThan(0);

        // Step 8: Verify dev button is present and enabled
        const devButton = card.locator('.present-button');
        expect(await devButton.isVisible()).toBe(true);
        expect(await devButton.textContent()).toContain('dev');
        expect(await devButton.isEnabled()).toBe(true);
      }, 120000);

      it('creates presentation with apple-basic template and minimal fields', async () => {
        const presentationName = 'apple-minimal-test';
        const presentationDir = join(projectPath, 'presentations', presentationName);

        await openCreateDialog();
        const dialog = page.locator('[role="dialog"]');

        // Fill only required field and select template
        const nameInput = dialog.locator('input[placeholder="my-presentation"]');
        const appleTemplate = dialog.locator('label:has-text("Apple Basic")');
        const createButton = dialog.locator('button:has-text("Create Presentation")');

        await nameInput.fill(presentationName);
        await appleTemplate.click();
        await createButton.click();

        await dialog.waitFor({ state: 'hidden', timeout: 60000 });

        // Verify files created with correct theme
        const slidesPath = join(presentationDir, 'slides.md');
        expect(existsSync(slidesPath)).toBe(true);
        const slidesContent = readFileSync(slidesPath, 'utf-8');
        expect(slidesContent).toContain('theme: apple-basic');

        // Verify package.json includes apple-basic theme dependency
        const packageJsonPath = join(presentationDir, 'package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        expect(packageJson.dependencies['@slidev/theme-apple-basic']).toBe('catalog:');

        // Verify appears in dashboard
        await page.goto(dashboardUrl);
        await page.waitForSelector('.card');
        const card = page.locator(`.card:has-text("${presentationName}")`);
        expect(await card.isVisible()).toBe(true);
      }, 90000);
    });
  });
});
