import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  parseFrontmatter,
  extractDescription,
  regeneratePresentationsJson,
  hasSharedPackage,
  addSharedAddonToSlides,
  SLUG_REGEX,
} from '../../../src/shared/index.js';
import { getProjectRoot, getPresentationsDir, getPresentationsJsonPath } from '../../utils/config';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { name, title, description, template = 'default' } = body;

  const projectRoot = getProjectRoot();
  const presentationsDir = getPresentationsDir();
  const presentationPath = join(presentationsDir, name);

  if (existsSync(presentationPath)) {
    throw createError({
      statusCode: 400,
      data: { field: 'name', message: 'A presentation with this name already exists' },
    });
  }

  if (!SLUG_REGEX.test(name)) {
    throw createError({
      statusCode: 400,
      data: {
        field: 'name',
        message: 'Name must be a valid slug (lowercase letters, numbers, hyphens only)',
      },
    });
  }

  return new Promise((resolve) => {
    const child = spawn('pnpm', ['create', 'slidev', name], {
      cwd: presentationsDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stderr = '';
    let scaffoldingDone = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const slidesPath = join(presentationPath, 'slides.md');

    const checkScaffoldingComplete = () => {
      if (existsSync(slidesPath) && !scaffoldingDone) {
        scaffoldingDone = true;
        if (pollInterval) clearInterval(pollInterval);
        child.kill('SIGTERM');
      }
    };

    pollInterval = setInterval(checkScaffoldingComplete, 200);

    const scaffoldTimeout = setTimeout(() => {
      if (!scaffoldingDone) {
        if (pollInterval) clearInterval(pollInterval);
        child.kill('SIGTERM');
      }
    }, 60000);

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err: Error) => {
      if (pollInterval) clearInterval(pollInterval);
      clearTimeout(scaffoldTimeout);
      resolve({ success: false, message: `Failed to create presentation: ${err.message}` });
    });

    child.on('close', () => {
      if (pollInterval) clearInterval(pollInterval);
      clearTimeout(scaffoldTimeout);

      if (!existsSync(slidesPath)) {
        resolve({ success: false, message: `Slidev CLI failed. ${stderr}` });
        return;
      }

      let slidesContent = readFileSync(slidesPath, 'utf-8');

      slidesContent = slidesContent.replace(
        /^(---\n[\s\S]*?)theme:\s*\S+/m,
        `$1theme: ${template}`,
      );

      if (title) {
        slidesContent = slidesContent.replace(
          /^(---\n[\s\S]*?)title:\s*.+$/m,
          `$1title: ${title}`,
        );
      }

      if (description) {
        slidesContent = slidesContent.replace(
          /^(---\n[\s\S]*?)info:\s*\|[\s\S]*?(?=\n[a-zA-Z]|\n---)/m,
          `$1info: |\n  ${description}\n`,
        );
      }

      writeFileSync(slidesPath, slidesContent);

      const sharedExists = hasSharedPackage(projectRoot);
      if (sharedExists) {
        addSharedAddonToSlides(slidesPath);
      }

      const frontmatter = parseFrontmatter(readFileSync(slidesPath, 'utf-8'));

      const packageJsonPath = join(presentationPath, 'package.json');
      const catalogPackageJson = {
        name: `@supaslidev/${name}`,
        private: true,
        type: 'module',
        scripts: {
          build: 'slidev build',
          dev: 'slidev --open',
          export: 'slidev export',
        },
        dependencies: {
          '@slidev/cli': 'catalog:',
          '@slidev/theme-default': 'catalog:',
          '@slidev/theme-seriph': 'catalog:',
          '@slidev/theme-apple-basic': 'catalog:',
          vue: 'catalog:',
        } as Record<string, string>,
        devDependencies: {},
      };

      if (sharedExists) {
        catalogPackageJson.dependencies['@supaslidev/shared'] = 'workspace:*';
      }

      writeFileSync(packageJsonPath, JSON.stringify(catalogPackageJson, null, 2) + '\n');

      regeneratePresentationsJson(presentationsDir, getPresentationsJsonPath());

      const presentation = {
        id: name,
        title: frontmatter.title || name,
        description: extractDescription(frontmatter.info) || '',
        theme: template || 'default',
        background: frontmatter.background || 'https://cover.sli.dev',
        duration: frontmatter.duration || '',
      };

      // Respond immediately so the UI updates, then run pnpm install in the
      // background to register the new workspace package.
      resolve({ success: true, presentation });

      const install = spawn('pnpm', ['install'], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: true,
      });

      install.on('close', (installCode: number | null) => {
        if (installCode !== 0) {
          console.error(`[create] pnpm install failed with code ${installCode}`);
        }
      });

      install.on('error', (err: Error) => {
        console.error(`[create] pnpm install error:`, err);
      });
    });
  });
});
