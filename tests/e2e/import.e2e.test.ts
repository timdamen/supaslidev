import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserContext, Page } from 'playwright';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  startDashboard,
  stopDashboardAsync,
  waitForServer,
  getTmpDir,
  scaffoldProject,
  installDependencies,
  createBrowserContext,
  createStandaloneSlidevProject,
  StandaloneSlidevProject,
} from './setup/test-utils.js';

const IMPORT_TEST_PROJECT = 'import-e2e-test';
const EXTERNAL_PROJECTS_DIR = 'external-slidev-projects';

interface InvalidProject {
  path: string;
  name: string;
}

function createProjectWithoutSlides(baseDir: string, name: string): InvalidProject {
  const projectPath = join(baseDir, name);
  mkdirSync(projectPath, { recursive: true });

  const packageJson = {
    name,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'slidev',
    },
  };
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

  return { path: projectPath, name };
}

async function openImportDialog(page: Page, dashboardUrl: string): Promise<void> {
  await page.goto(dashboardUrl);

  const terminalInput = page.locator('.terminal-input');
  await terminalInput.focus();
  await terminalInput.fill('import');
  await terminalInput.press('Enter');

  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
}

interface ValidationWaitOptions {
  expectedText?: string;
  expectSuccess?: boolean;
  expectError?: boolean;
  timeout?: number;
}

async function waitForValidationComplete(
  page: Page,
  options: ValidationWaitOptions = {},
): Promise<void> {
  const { expectedText, expectSuccess, expectError, timeout = 5000 } = options;
  const dialog = page.locator('[role="dialog"]');
  const validatingIndicator = page.locator('span.text-muted:has-text("Validating...")');

  await dialog.waitFor({ state: 'visible', timeout });

  const successIcon = page.locator('.text-success').first();
  const errorIcon = page.locator('.text-error').first();

  await Promise.race([
    validatingIndicator.waitFor({ state: 'hidden', timeout }).catch(() => {}),
    expectSuccess ? successIcon.waitFor({ state: 'visible', timeout }) : Promise.resolve(),
    expectError ? errorIcon.waitFor({ state: 'visible', timeout }) : Promise.resolve(),
  ]);

  if (expectedText) {
    await page
      .locator(`[role="dialog"]:has-text("${expectedText}")`)
      .waitFor({ state: 'visible', timeout });
  }

  if (expectSuccess) {
    await successIcon.waitFor({ state: 'visible', timeout });
  }

  if (expectError) {
    await errorIcon.waitFor({ state: 'visible', timeout });
  }
}

describe('Import E2E', () => {
  let context: BrowserContext;
  let page: Page;
  let dashboardUrl: string;
  let projectPath: string;
  let externalProjectsPath: string;
  let standaloneProject1: StandaloneSlidevProject;
  let standaloneProject2: StandaloneSlidevProject;
  let projectWithoutSlides: InvalidProject;

  beforeAll(async () => {
    const tmpDir = getTmpDir();

    projectPath = join(tmpDir, IMPORT_TEST_PROJECT);
    if (existsSync(projectPath)) {
      rmSync(projectPath, { recursive: true, force: true });
    }

    externalProjectsPath = join(tmpDir, EXTERNAL_PROJECTS_DIR);
    if (existsSync(externalProjectsPath)) {
      rmSync(externalProjectsPath, { recursive: true, force: true });
    }
    mkdirSync(externalProjectsPath, { recursive: true });

    standaloneProject1 = createStandaloneSlidevProject(externalProjectsPath, 'external-deck-one');
    standaloneProject2 = createStandaloneSlidevProject(externalProjectsPath, 'external-deck-two');
    projectWithoutSlides = createProjectWithoutSlides(externalProjectsPath, 'no-slides-project');

    scaffoldProject(IMPORT_TEST_PROJECT);
    installDependencies(projectPath);

    context = await createBrowserContext();
    page = await context.newPage();

    const dashboardInfo = await startDashboard(projectPath);
    dashboardUrl = dashboardInfo.url;

    await waitForServer(dashboardUrl);
  }, 120000);

  afterAll(async () => {
    await context?.close();
    await stopDashboardAsync();

    if (existsSync(projectPath)) {
      rmSync(projectPath, { recursive: true, force: true });
    }

    if (existsSync(externalProjectsPath)) {
      rmSync(externalProjectsPath, { recursive: true, force: true });
    }
  });

  describe('import dialog access', () => {
    it('opens import dialog via terminal command with autocomplete', async () => {
      await page.goto(dashboardUrl);

      const terminalInput = page.locator('.terminal-input');
      await terminalInput.focus();
      await terminalInput.fill('Im');

      // Verify autocomplete shows
      await page.waitForTimeout(100);
      const ghostText = page.locator('.ghost-suffix');
      expect(await ghostText.isVisible()).toBe(true);
      expect(await ghostText.textContent()).toBe('port');

      // Complete and submit command
      await terminalInput.fill('import');
      await terminalInput.press('Enter');

      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
      expect(await dialog.isVisible()).toBe(true);

      const dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('Import');
    });

    it('opens import dialog via command palette', async () => {
      await page.goto(dashboardUrl);

      // Open command palette
      await page.keyboard.press('ControlOrMeta+k');

      const modal = page.locator('[role="dialog"]');
      await modal.waitFor({ state: 'visible', timeout: 5000 });

      // Verify Actions section and Import option
      const paletteContent = await modal.textContent();
      expect(paletteContent).toContain('Actions');

      const importOption = modal.getByText('Import', { exact: true });
      expect(await importOption.isVisible()).toBe(true);

      // Click Import and verify import dialog opens
      await importOption.click();
      await page.waitForTimeout(300);

      const importDialog = page.locator('[role="dialog"]');
      await importDialog.waitFor({ state: 'visible', timeout: 5000 });

      const dialogContent = await importDialog.textContent();
      expect(dialogContent).toContain('Import');
    });
  });

  describe('path validation', () => {
    it('validates paths with appropriate error messages', async () => {
      await openImportDialog(page, dashboardUrl);

      const pathInput = page.locator('input[placeholder="/path/to/presentation"]');
      const dialog = page.locator('[role="dialog"]');

      // Test 1: Non-existent path
      await pathInput.fill('/path/that/does/not/exist/anywhere');
      await pathInput.blur();

      const validatingIndicator = page.locator('span.text-muted:has-text("Validating...")');
      if (await validatingIndicator.isVisible()) {
        await validatingIndicator.waitFor({ state: 'hidden', timeout: 5000 });
      }
      await page.waitForTimeout(500);

      let dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('Source directory does not exist');
      expect(await page.locator('.text-error').first().isVisible()).toBe(true);

      // Test 2: File instead of directory
      const slidesFilePath = join(standaloneProject1.path, 'slides.md');
      await pathInput.fill(slidesFilePath);
      await pathInput.blur();

      if (await validatingIndicator.isVisible()) {
        await validatingIndicator.waitFor({ state: 'hidden', timeout: 5000 });
      }
      await page.waitForTimeout(500);

      dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('Source path is not a directory');

      // Test 3: Directory without slides.md
      await pathInput.fill(projectWithoutSlides.path);
      await pathInput.blur();

      if (await validatingIndicator.isVisible()) {
        await validatingIndicator.waitFor({ state: 'hidden', timeout: 5000 });
      }
      await page.waitForTimeout(500);

      dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('No slides.md found');

      // Test 4: Valid path shows success
      await pathInput.fill(standaloneProject1.path);
      await pathInput.blur();

      await waitForValidationComplete(page, {
        expectedText: 'external-deck-one',
        expectSuccess: true,
      });

      dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('external-deck-one');
      expect(await page.locator('.text-success').first().isVisible()).toBe(true);
    });
  });

  describe('import flow', () => {
    it('imports single presentation and verifies complete flow', async () => {
      // Check if already imported from previous test
      await page.goto(dashboardUrl);
      await page.waitForTimeout(500);

      const alreadyImported = await page.locator('.card:has-text("external-deck-one")').isVisible();
      if (alreadyImported) {
        // Verify it's there and skip reimporting
        expect(alreadyImported).toBe(true);
        return;
      }

      // Step 1: Open import dialog
      await openImportDialog(page, dashboardUrl);
      const dialog = page.locator('[role="dialog"]');

      // Step 2: Enter path and validate
      const pathInput = page.locator('input[placeholder="/path/to/presentation"]');
      await pathInput.fill(standaloneProject1.path);
      await pathInput.blur();

      await waitForValidationComplete(page, {
        expectedText: 'external-deck-one',
        expectSuccess: true,
      });

      // Verify suggested name appears
      const dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('external-deck-one');

      // Step 3: Click import button inside dialog
      const importButton = dialog.locator('button:has-text("Import")').first();
      await importButton.waitFor({ state: 'visible', timeout: 5000 });
      await importButton.click({ force: true });

      // Step 4: Wait for import to complete
      await dialog.waitFor({ state: 'hidden', timeout: 60000 });

      // Step 5: Verify file system - presentation directory created in workspace
      const importedDir = join(projectPath, 'presentations', 'external-deck-one');
      expect(existsSync(importedDir)).toBe(true);

      // Step 6: Verify slides.md was copied
      const slidesPath = join(importedDir, 'slides.md');
      expect(existsSync(slidesPath)).toBe(true);

      // Step 7: Verify package.json uses catalog: syntax
      const packageJsonPath = join(importedDir, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.name).toBe('@supaslidev/external-deck-one');
      expect(packageJson.dependencies['@slidev/cli']).toBe('catalog:');
      expect(packageJson.dependencies['vue']).toBe('catalog:');

      // Step 8: Verify presentation appears in dashboard
      const card = page.locator('.card:has-text("external-deck-one")');
      await card.waitFor({ state: 'visible', timeout: 10000 });
      expect(await card.isVisible()).toBe(true);

      // Step 9: Verify dev button is present
      const devButton = card.locator('.present-button');
      expect(await devButton.isVisible()).toBe(true);
      expect(await devButton.textContent()).toContain('dev');
    }, 120000);

    it('imports multiple presentations with progress indicator', async () => {
      // Check if already imported
      await page.goto(dashboardUrl);
      await page.waitForTimeout(500);

      const alreadyImported = await page.locator('.card:has-text("external-deck-two")').isVisible();
      if (alreadyImported) {
        expect(alreadyImported).toBe(true);
        return;
      }

      // Step 1: Open dialog and enter multiple paths
      await openImportDialog(page, dashboardUrl);

      const pathInput = page.locator('input[placeholder="/path/to/presentation"]');
      const commaSeparatedPaths = `${standaloneProject1.path}, ${standaloneProject2.path}`;
      await pathInput.fill(commaSeparatedPaths);
      await pathInput.blur();

      // Step 2: Wait for validation to complete - wait for success icons or count to stabilize
      const dialog = page.locator('[role="dialog"]');
      const validatingIndicator = page.locator('span.text-muted:has-text("Validating...")');

      // First wait for validating indicator to appear (may be brief due to debounce)
      await page.waitForTimeout(400);

      // Then wait for it to disappear
      await validatingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

      // Wait for both success icons to appear (one for each valid path)
      const successIcons = page.locator('.text-success');
      await successIcons.nth(1).waitFor({ state: 'visible', timeout: 10000 });

      // Step 3: Verify both projects validated
      const dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('external-deck-one');
      expect(dialogContent).toContain('external-deck-two');

      const validIndicator = page.locator('text=2 of 2 valid');
      expect(await validIndicator.isVisible()).toBe(true);

      // Step 4: Click import button
      const importButton = page.locator('button:has-text("Import 2 Presentations")');
      await importButton.click();

      // Step 5: Verify progress indicator appears
      const progressIndicator = page.locator('p:has-text("Importing")');
      let sawProgress = false;
      const startTime = Date.now();
      const maxWaitTime = 120000;

      while (Date.now() - startTime < maxWaitTime) {
        const dialogVisible = await dialog.isVisible();

        if (!dialogVisible) {
          break;
        }

        if (!sawProgress && (await progressIndicator.isVisible())) {
          sawProgress = true;
          const progressText = await progressIndicator.textContent();
          expect(progressText).toMatch(/Importing \d+\/2/);
        }

        await page.waitForTimeout(500);
      }

      // Step 6: Verify both presentations in file system
      const deck1Dir = join(projectPath, 'presentations', 'external-deck-one');
      const deck2Dir = join(projectPath, 'presentations', 'external-deck-two');
      expect(existsSync(deck1Dir)).toBe(true);
      expect(existsSync(deck2Dir)).toBe(true);

      // Verify package.json for second deck
      const packageJsonPath = join(deck2Dir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.name).toBe('@supaslidev/external-deck-two');
      expect(packageJson.dependencies['@slidev/cli']).toBe('catalog:');

      // Step 7: Verify both appear in dashboard
      const deckOneCard = page.locator('.card:has-text("external-deck-one")');
      const deckTwoCard = page.locator('.card:has-text("external-deck-two")');

      await deckOneCard.waitFor({ state: 'visible', timeout: 10000 });
      await deckTwoCard.waitFor({ state: 'visible', timeout: 10000 });

      expect(await deckOneCard.isVisible()).toBe(true);
      expect(await deckTwoCard.isVisible()).toBe(true);
    }, 150000);

    it('shows mixed validation results for valid and invalid paths', async () => {
      await openImportDialog(page, dashboardUrl);

      const pathInput = page.locator('input[placeholder="/path/to/presentation"]');
      const mixedPaths = `${standaloneProject1.path}, ${projectWithoutSlides.path}`;
      await pathInput.fill(mixedPaths);
      await pathInput.blur();

      // Wait for validation to complete - wait for debounce and API call
      await page.waitForTimeout(400);

      const validatingIndicator = page.locator('span.text-muted:has-text("Validating...")');
      await validatingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

      // Wait for both success and error icons to appear (one valid, one invalid path)
      const successIcon = page.locator('.text-success').first();
      const errorIcon = page.locator('.text-error').first();
      await Promise.all([
        successIcon.waitFor({ state: 'visible', timeout: 10000 }),
        errorIcon.waitFor({ state: 'visible', timeout: 10000 }),
      ]);

      // Verify mixed results shown
      const dialog = page.locator('[role="dialog"]');
      const dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('1 of 2 valid');

      // Both success and error icons visible
      expect(await successIcon.isVisible()).toBe(true);
      expect(await errorIcon.isVisible()).toBe(true);
    });
  });
});
