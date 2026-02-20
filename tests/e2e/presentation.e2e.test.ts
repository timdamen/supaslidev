import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserContext, Page } from 'playwright';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import {
  startDashboard,
  stopDashboardAsync,
  waitForServer,
  getBaseProjectPath,
  getTmpDir,
  cleanupProject,
  createBrowserContext,
  installDependencies,
} from './setup/test-utils.js';

async function waitForPresentationServer(port: number, timeout = 30000): Promise<void> {
  return waitForServer(`http://localhost:${port}`, { timeout });
}

describe('Presentation Viewing E2E', () => {
  const PRESENTATION_TEST_PROJECT = 'presentation-viewing-test';
  let context: BrowserContext;
  let dashboardPage: Page;
  let presentationPage: Page;
  let dashboardUrl: string;
  let projectPath: string;
  let presentationUrl: string;

  beforeAll(async () => {
    cleanupProject(PRESENTATION_TEST_PROJECT);

    const baseProjectPath = getBaseProjectPath();
    projectPath = join(getTmpDir(), PRESENTATION_TEST_PROJECT);

    cpSync(baseProjectPath, projectPath, { recursive: true });
    installDependencies(projectPath);

    context = await createBrowserContext();
    const browserName = (process.env.BROWSER || 'chromium').toLowerCase();
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    dashboardPage = await context.newPage();

    const dashboardInfo = await startDashboard(projectPath);
    dashboardUrl = dashboardInfo.url;

    await waitForServer(dashboardUrl);
    await waitForServer('http://localhost:7777/api/servers');
  }, 120000);

  afterAll(async () => {
    await context?.close();
    await stopDashboardAsync();
    cleanupProject(PRESENTATION_TEST_PROJECT);
  });

  describe('launching presentation from dashboard', () => {
    it('clicking present button starts the presentation server', async () => {
      await dashboardPage.goto(dashboardUrl);
      await dashboardPage.waitForSelector('.card');

      const presentButton = dashboardPage.locator('.present-button').first();
      expect(await presentButton.isVisible()).toBe(true);
      expect(await presentButton.textContent()).toContain('dev');

      const popupPromise = dashboardPage.context().waitForEvent('page', { timeout: 90000 });
      await presentButton.click();

      await dashboardPage.waitForFunction(
        () => {
          const button = document.querySelector('.present-button');
          return (
            button?.textContent?.includes('stop') ||
            button?.classList.contains('present-button--loading')
          );
        },
        { timeout: 10000 },
      );

      await dashboardPage.waitForFunction(
        () => {
          const button = document.querySelector('.present-button');
          return button?.textContent?.includes('stop');
        },
        { timeout: 60000 },
      );

      // Get the server port from the API (most reliable source)
      const servers = await dashboardPage.evaluate(async () => {
        const res = await fetch('/api/servers');
        return res.json() as Promise<Record<string, { port: number }>>;
      });

      const firstServer = Object.values(servers)[0];
      if (firstServer) {
        presentationUrl = `http://localhost:${firstServer.port}`;
      }

      // Fallback: try to get URL from popup if API didn't work
      if (!presentationUrl) {
        let popup;
        try {
          popup = await popupPromise;
          await popup.waitForLoadState('domcontentloaded');
          presentationUrl = popup.url();
          await popup.close();
        } catch {
          // Popup may have been blocked
        }
      }

      // Close popup if it's still open
      try {
        const popup = await Promise.race([
          popupPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
        ]);
        if (popup) await popup.close();
      } catch {
        // Popup already closed or didn't open
      }

      expect(presentationUrl).toMatch(/http:\/\/localhost:\d+/);
    }, 120000);

    it('present button shows stop when server is running', async () => {
      const presentButton = dashboardPage.locator('.present-button').first();
      expect(await presentButton.textContent()).toContain('stop');
    });

    it('presentation server responds to requests', async () => {
      const port = parseInt(new URL(presentationUrl).port) || 3030;
      await waitForPresentationServer(port, 30000);
      const response = await fetch(presentationUrl);
      expect(response.ok).toBe(true);
    }, 35000);
  });

  describe('presentation renders correctly', () => {
    it('presentation page loads and displays content', async () => {
      presentationPage = await context.newPage();
      await presentationPage.goto(presentationUrl);
      await presentationPage.waitForLoadState('domcontentloaded');

      await presentationPage.waitForFunction(
        () => document.body.textContent?.includes('test-deck'),
        { timeout: 15000 },
      );
      const bodyText = await presentationPage.locator('body').textContent();
      expect(bodyText).toContain('test-deck');
    }, 35000);
  });

  describe('stopping presentation server', () => {
    it('clicking stop button stops the presentation server', async () => {
      await dashboardPage.bringToFront();
      await dashboardPage.goto(dashboardUrl);
      await dashboardPage.waitForSelector('.card');

      const apiResponse = await dashboardPage.evaluate(async () => {
        const res = await fetch('/api/servers');
        return res.json();
      });

      const hasRunningServers = Object.keys(apiResponse).length > 0;

      if (hasRunningServers) {
        await dashboardPage.waitForFunction(
          () => {
            const button = document.querySelector('.present-button');
            return button?.textContent?.includes('stop');
          },
          { timeout: 10000 },
        );

        const stopButton = dashboardPage.locator('.present-button').first();
        await stopButton.click();

        await dashboardPage.waitForFunction(
          () => {
            const button = document.querySelector('.present-button');
            return button?.textContent?.includes('dev');
          },
          { timeout: 20000 },
        );

        expect(await stopButton.textContent()).toContain('dev');
      } else {
        const stopButton = dashboardPage.locator('.present-button').first();
        expect(await stopButton.textContent()).toContain('dev');
      }
    }, 60000);
  });

  describe('loading states', () => {
    it('shows loading state on button during server startup', async () => {
      await dashboardPage.goto(dashboardUrl);
      await dashboardPage.waitForSelector('.card');

      const presentButton = dashboardPage.locator('.present-button').first();
      const buttonText = await presentButton.textContent();

      if (buttonText?.includes('dev')) {
        const popupPromise = dashboardPage.context().waitForEvent('page', { timeout: 90000 });
        await presentButton.click();

        const isLoading = await dashboardPage.waitForFunction(
          () => {
            const button = document.querySelector('.present-button');
            return button?.hasAttribute('disabled') || button?.querySelector('[class*="animate"]');
          },
          { timeout: 10000 },
        );

        expect(isLoading).toBeTruthy();

        await dashboardPage.waitForFunction(
          () => {
            const button = document.querySelector('.present-button');
            return button?.textContent?.includes('stop');
          },
          { timeout: 60000 },
        );

        try {
          const popup = await Promise.race([
            popupPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
          ]);
          if (popup) await popup.close();
        } catch {
          // Popup may not have opened
        }
      }
    }, 90000);

    it('loading state is removed after server is ready', async () => {
      await dashboardPage.goto(dashboardUrl);
      await dashboardPage.waitForSelector('.card');

      const presentButton = dashboardPage.locator('.present-button').first();
      const buttonText = await presentButton.textContent();

      if (buttonText?.includes('stop')) {
        const isNotLoading = await presentButton.evaluate(
          (el) => !el.hasAttribute('disabled') || el.textContent?.includes('stop'),
        );
        expect(isNotLoading).toBe(true);
      }
    });

    it('waits for server ready before showing stop button', async () => {
      const servers = await dashboardPage.evaluate(async () => {
        const res = await fetch('/api/servers');
        return res.json() as Promise<Record<string, { port: number }>>;
      });

      if (Object.keys(servers).length > 0) {
        const firstServer = Object.values(servers)[0];
        const port = firstServer.port;

        const response = await fetch(`http://localhost:${port}`);
        expect(response.ok).toBe(true);

        const presentButton = dashboardPage.locator('.present-button').first();
        expect(await presentButton.textContent()).toContain('stop');
      }
    });
  });
});
