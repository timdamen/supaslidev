import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import * as p from '@clack/prompts';
import ejs from 'ejs';
import pc from 'picocolors';

import { CLI_VERSION, fetchLatestPackageVersion } from './version.js';
const SUPASLIDEV_FALLBACK_VERSION = '0.1.4';

interface SafeSpinner {
  start: (msg?: string) => void;
  stop: (msg?: string) => void;
  message: (msg?: string) => void;
}

function createSafeSpinner(): SafeSpinner {
  const isTTY = process.stdout.isTTY && process.stdin.isTTY;

  if (isTTY) {
    const spinner = p.spinner();
    return {
      start: (msg?: string) => spinner.start(msg),
      stop: (msg?: string) => spinner.stop(msg),
      message: (msg?: string) => spinner.message(msg),
    };
  }

  return {
    start: () => {},
    stop: () => {},
    message: () => {},
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, '..', 'templates');

export interface CreateOptions {
  name?: string;
  presentation?: string;
  template?: string;
  git?: boolean;
  install?: boolean;
}

interface TemplateData {
  projectName: string;
  presentationName: string;
  description: string;
  cliVersion: string;
  createdAt: string;
  supaslidevVersion: string;
}

const createdPaths: string[] = [];

function trackPath(path: string): void {
  createdPaths.push(path);
}

function cleanup(): void {
  for (const path of createdPaths.reverse()) {
    try {
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function renderTemplate(templatePath: string, data: TemplateData): Promise<string> {
  return ejs.renderFile(templatePath, data);
}

function getOutputFileName(templateFileName: string): string {
  const name = templateFileName.replace('.ejs', '');
  if (name === 'gitignore') return '.gitignore';
  if (name === 'npmrc') return '.npmrc';
  return name;
}

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${command} ${args.join(' ')}" exited with code ${code}`));
      }
    });
  });
}

async function renderWorkspaceTemplates(
  targetDir: string,
  templateName: string,
  data: TemplateData,
): Promise<void> {
  const templateDir = join(templatesDir, templateName);

  if (!existsSync(templateDir)) {
    throw new Error(`Template "${templateName}" not found`);
  }

  await renderTemplatesRecursively(templateDir, targetDir, data);
}

async function renderTemplatesRecursively(
  sourceDir: string,
  targetDir: string,
  data: TemplateData,
): Promise<void> {
  const entries = readdirSync(sourceDir);

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry);
    const stat = statSync(sourcePath);

    if (stat.isDirectory()) {
      const subTargetDir = join(targetDir, entry);
      mkdirSync(subTargetDir, { recursive: true });
      await renderTemplatesRecursively(sourcePath, subTargetDir, data);
    } else if (entry.endsWith('.ejs')) {
      const outputFileName = getOutputFileName(entry);
      const outputPath = join(targetDir, outputFileName);
      const content = await renderTemplate(sourcePath, data);
      writeFileSync(outputPath, content, 'utf-8');
    }
  }
}

function createDirectoryStructure(targetDir: string): void {
  const directories = ['presentations', 'packages'];

  for (const dir of directories) {
    const fullPath = join(targetDir, dir);
    mkdirSync(fullPath, { recursive: true });
    trackPath(fullPath);
  }
}

async function createPresentation(targetDir: string, presentationName: string): Promise<void> {
  const presentationDir = join(targetDir, 'presentations', presentationName);
  mkdirSync(presentationDir, { recursive: true });
  trackPath(presentationDir);

  const packageJson = {
    name: `@supaslidev/${presentationName}`,
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
      '@supaslidev/shared': 'workspace:*',
      vue: 'catalog:',
    },
    devDependencies: {},
  };

  writeFileSync(
    join(presentationDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8',
  );

  const slidesContent = `---
theme: default
title: ${presentationName}
addons:
  - '@supaslidev/shared'
info: |
  A new Slidev presentation
class: text-center
transition: slide-left
mdc: true
---

# ${presentationName}

Welcome to your new presentation

---

# Slide 2

Add your content here

---

# Learn More

[Slidev Documentation](https://sli.dev/)
`;

  writeFileSync(join(presentationDir, 'slides.md'), slidesContent, 'utf-8');

  writeFileSync(
    join(presentationDir, '.gitignore'),
    'node_modules\n.DS_Store\ndist\n*.local\n.vite-inspect\n.remote-assets\ncomponents.d.ts\n',
    'utf-8',
  );
}

export function createSharedPackage(targetDir: string): void {
  const sharedDir = join(targetDir, 'packages', 'shared');
  mkdirSync(sharedDir, { recursive: true });
  trackPath(sharedDir);

  const subdirs = ['components', 'layouts', 'styles'];
  for (const subdir of subdirs) {
    const fullPath = join(sharedDir, subdir);
    mkdirSync(fullPath, { recursive: true });
    trackPath(fullPath);
  }

  const packageJson = {
    name: '@supaslidev/shared',
    private: true,
    type: 'module',
    keywords: ['slidev-addon', 'slidev'],
    dependencies: {
      vue: 'catalog:',
    },
  };

  writeFileSync(
    join(sharedDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8',
  );

  const sharedBadgeContent = `<script setup lang="ts">
defineProps<{
  text?: string;
}>();
</script>

<template>
  <span class="shared-badge">{{ text ?? 'Shared' }}</span>
</template>

<style scoped>
.shared-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 9999px;
}
</style>
`;

  writeFileSync(join(sharedDir, 'components', 'SharedBadge.vue'), sharedBadgeContent, 'utf-8');

  const readmeContent = `# @supaslidev/shared

A local Slidev addon for sharing components, layouts, and styles across all presentations in your workspace.

## How It Works

This package follows the [Slidev addon pattern](https://sli.dev/guide/write-addon). Slidev automatically discovers and imports resources from the following directories:

- **components/** - Vue components available in all slides
- **layouts/** - Custom slide layouts
- **styles/** - Shared CSS/SCSS styles

## Using This Addon

Add the addon to your presentation's frontmatter:

\\\`\\\`\\\`yaml
---
addons:
  - '@supaslidev/shared'
---
\\\`\\\`\\\`

## Example: Using SharedBadge

The \\\`SharedBadge\\\` component is available globally once the addon is configured:

\\\`\\\`\\\`md
---
addons:
  - '@supaslidev/shared'
---

# My Slide

<SharedBadge text="New" />
\\\`\\\`\\\`

## Directory Structure

\\\`\\\`\\\`
shared/
├── components/       # Vue components (auto-imported)
│   └── SharedBadge.vue
├── layouts/          # Custom layouts
├── styles/           # Shared styles
├── package.json
└── README.md
\\\`\\\`\\\`

## Adding New Components

Create a \\\`.vue\\\` file in \\\`components/\\\`:

\\\`\\\`\\\`vue
<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <div class="my-component">{{ label }}</div>
</template>
\\\`\\\`\\\`

The component is immediately available in all presentations using this addon.
`;

  writeFileSync(join(sharedDir, 'README.md'), readmeContent, 'utf-8');
}

export async function create(options: CreateOptions = {}): Promise<void> {
  const spinner = createSafeSpinner();

  try {
    let projectName: string;
    let presentationName: string;
    let initGit: boolean;
    let runInstall: boolean;

    const hasInteractiveFlags = options.name !== undefined || options.presentation !== undefined;

    if (hasInteractiveFlags) {
      projectName = options.name ?? 'my-presentations';
      presentationName = options.presentation ?? 'my-first-deck';
      initGit = options.git ?? true;
      runInstall = options.install ?? true;

      if (!/^[a-z0-9-]+$/.test(projectName)) {
        p.log.error('Project name must be lowercase alphanumeric with hyphens only');
        process.exit(1);
      }
      if (projectName.startsWith('-') || projectName.endsWith('-')) {
        p.log.error('Project name cannot start or end with a hyphen');
        process.exit(1);
      }
      if (!/^[a-z0-9-]+$/.test(presentationName)) {
        p.log.error('Presentation name must be lowercase alphanumeric with hyphens only');
        process.exit(1);
      }
      if (presentationName.startsWith('-') || presentationName.endsWith('-')) {
        p.log.error('Presentation name cannot start or end with a hyphen');
        process.exit(1);
      }
    } else {
      p.intro(pc.cyan('Create a new Supaslidev workspace'));

      const projectNameResult = await p.text({
        message: 'What is your project name?',
        placeholder: 'my-presentations',
        validate: (value) => {
          if (!value.trim()) return 'Project name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Project name must be lowercase alphanumeric with hyphens only';
          }
          if (value.startsWith('-') || value.endsWith('-')) {
            return 'Project name cannot start or end with a hyphen';
          }
          return undefined;
        },
      });

      if (p.isCancel(projectNameResult)) {
        p.cancel('Operation cancelled');
        process.exit(0);
      }

      projectName = projectNameResult;

      const presentationNameResult = await p.text({
        message: 'What is the name of your first presentation?',
        placeholder: 'my-first-deck',
        initialValue: 'my-first-deck',
        validate: (value) => {
          if (!value.trim()) return 'Presentation name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Presentation name must be lowercase alphanumeric with hyphens only';
          }
          if (value.startsWith('-') || value.endsWith('-')) {
            return 'Presentation name cannot start or end with a hyphen';
          }
          return undefined;
        },
      });

      if (p.isCancel(presentationNameResult)) {
        p.cancel('Operation cancelled');
        process.exit(0);
      }

      presentationName = presentationNameResult;

      const initGitResult = await p.confirm({
        message: 'Initialize a git repository?',
        initialValue: true,
      });

      if (p.isCancel(initGitResult)) {
        p.cancel('Operation cancelled');
        process.exit(0);
      }

      initGit = initGitResult;

      const runInstallResult = await p.confirm({
        message: 'Run pnpm install after scaffolding?',
        initialValue: true,
      });

      if (p.isCancel(runInstallResult)) {
        p.cancel('Operation cancelled');
        process.exit(0);
      }

      runInstall = runInstallResult;
    }

    const targetDir = join(process.cwd(), projectName);

    if (existsSync(targetDir)) {
      p.log.error(`Directory "${projectName}" already exists`);
      process.exit(1);
    }

    mkdirSync(targetDir, { recursive: true });
    trackPath(targetDir);

    spinner.start('Creating workspace structure...');

    createDirectoryStructure(targetDir);

    const latestSupaslidev = await fetchLatestPackageVersion('supaslidev');
    const supaslidevVersion = `^${latestSupaslidev ?? SUPASLIDEV_FALLBACK_VERSION}`;

    const templateData: TemplateData = {
      projectName,
      presentationName,
      description: `${projectName} - Slidev presentations monorepo`,
      cliVersion: CLI_VERSION,
      createdAt: new Date().toISOString(),
      supaslidevVersion,
    };

    const templateName = options.template ?? 'default';
    await renderWorkspaceTemplates(targetDir, templateName, templateData);

    spinner.message('Creating presentation...');
    await createPresentation(targetDir, presentationName);

    spinner.message('Creating shared package...');
    createSharedPackage(targetDir);

    spinner.stop('Workspace structure created');

    if (initGit) {
      spinner.start('Initializing git repository...');
      try {
        await runCommand('git', ['init'], targetDir);
        spinner.stop('Git repository initialized');
      } catch {
        spinner.stop('Failed to initialize git repository');
        p.log.warn('Git initialization failed. You can run "git init" manually.');
      }
    }

    if (runInstall) {
      spinner.start('Installing dependencies (this may take a while)...');
      try {
        await runCommand('pnpm', ['install'], targetDir);
        spinner.stop('Dependencies installed');
      } catch {
        spinner.stop('Failed to install dependencies');
        p.log.warn('Dependency installation failed. You can run "pnpm install" manually.');
      }
    }

    createdPaths.length = 0;

    p.outro(pc.green('Workspace created successfully!'));

    console.log('');
    console.log(pc.cyan('Next steps:'));
    console.log(`  ${pc.dim('$')} cd ${projectName}`);
    if (!runInstall) {
      console.log(`  ${pc.dim('$')} pnpm install`);
    }
    console.log(`  ${pc.dim('$')} pnpm dev ${presentationName}`);
    console.log('');
  } catch (error) {
    spinner.stop('Failed');

    if (createdPaths.length > 0) {
      p.log.warn('Cleaning up partial files...');
      cleanup();
      p.log.info('Cleanup complete');
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    p.log.error(message);
    process.exit(1);
  }
}
