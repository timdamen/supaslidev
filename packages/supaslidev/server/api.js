import { createServer } from 'http';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, basename, extname, relative } from 'path';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
  cpSync,
  readFileSync,
  createReadStream,
} from 'fs';

const IS_WINDOWS = process.platform === 'win32';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveProjectRoot() {
  if (process.env.SUPASLIDEV_PROJECT_ROOT) {
    return process.env.SUPASLIDEV_PROJECT_ROOT;
  }
  return join(__dirname, '..', '..', '..');
}

function resolvePresentationsDir() {
  if (process.env.SUPASLIDEV_PRESENTATIONS_DIR) {
    return process.env.SUPASLIDEV_PRESENTATIONS_DIR;
  }
  return join(resolveProjectRoot(), 'presentations');
}

const projectRoot = resolveProjectRoot();
const presentationsDir = resolvePresentationsDir();
const packageDir = join(__dirname, '..');
const presentationsJsonPath = join(projectRoot, '.supaslidev', 'presentations.json');
const dashboardDir = process.env.SUPASLIDEV_DASHBOARD_DIR;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const runningServers = new Map();

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CATALOG_DEPENDENCIES = [
  '@slidev/cli',
  '@slidev/theme-default',
  '@slidev/theme-seriph',
  '@slidev/theme-apple-basic',
  'vue',
];

function hasSharedPackage() {
  const sharedPackagePath = join(projectRoot, 'packages', 'shared', 'package.json');
  return existsSync(sharedPackagePath);
}

function addSharedAddonToSlides(slidesPath) {
  const content = readFileSync(slidesPath, 'utf-8');
  const frontmatterMatch = content.match(/^(---\n)([\s\S]*?)\n(---)/);
  if (!frontmatterMatch) return;

  const [fullMatch, openDelim, frontmatter, closeDelim] = frontmatterMatch;
  const restOfFile = content.slice(fullMatch.length);
  const sharedAddon = '@supaslidev/shared';

  if (frontmatter.includes(sharedAddon)) return;

  let updatedFrontmatter = frontmatter;

  const addonsMatch = frontmatter.match(/^(addons:\s*)(\[.*?\])?$/m);
  if (addonsMatch) {
    if (addonsMatch[2]) {
      const arrayContent = addonsMatch[2].slice(1, -1).trim();
      if (arrayContent === '') {
        updatedFrontmatter = frontmatter.replace(addonsMatch[0], `addons: ['${sharedAddon}']`);
      } else {
        updatedFrontmatter = frontmatter.replace(
          addonsMatch[0],
          `addons: [${arrayContent}, '${sharedAddon}']`,
        );
      }
    } else {
      const addonsBlockMatch = frontmatter.match(/^addons:\s*\n((?:  - .+\n?)*)/m);
      if (addonsBlockMatch) {
        const existingBlock = addonsBlockMatch[0].trimEnd();
        updatedFrontmatter = frontmatter.replace(
          existingBlock,
          `${existingBlock}\n  - '${sharedAddon}'`,
        );
      }
    }
  } else {
    const themeMatch = frontmatter.match(/^(theme:\s*.+)$/m);
    if (themeMatch) {
      updatedFrontmatter = frontmatter.replace(
        themeMatch[1],
        `${themeMatch[1]}\naddons:\n  - '${sharedAddon}'`,
      );
    }
  }

  if (updatedFrontmatter !== frontmatter) {
    writeFileSync(slidesPath, `${openDelim}${updatedFrontmatter}\n${closeDelim}${restOfFile}`);
  }
}

function addSharedDependencyToPackageJson(packageJson) {
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  if (!packageJson.dependencies['@supaslidev/shared']) {
    packageJson.dependencies['@supaslidev/shared'] = 'workspace:*';
  }
}

function convertToCatalogDependencies(dependencies) {
  if (!dependencies || typeof dependencies !== 'object') {
    return {};
  }
  const converted = { ...dependencies };
  for (const dep of CATALOG_DEPENDENCIES) {
    if (dep in converted) {
      converted[dep] = 'catalog:';
    }
  }
  return converted;
}

function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};

  const frontmatter = frontmatterMatch[1];
  const result = {};

  let currentKey = null;
  let currentValue = [];
  let inMultiline = false;

  const lines = frontmatter.split('\n');

  for (const line of lines) {
    if (inMultiline) {
      if (line.match(/^[a-zA-Z]/)) {
        result[currentKey] = currentValue.join('\n').trim();
        inMultiline = false;
        currentKey = null;
        currentValue = [];
      } else {
        currentValue.push(line.replace(/^  /, ''));
        continue;
      }
    }

    const match = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;

      if (value === '|' || value === '>') {
        currentKey = key;
        currentValue = [];
        inMultiline = true;
      } else if (value.startsWith('"') && value.endsWith('"')) {
        result[key] = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        result[key] = value.slice(1, -1);
      } else {
        result[key] = value;
      }
    }
  }

  if (inMultiline && currentKey) {
    result[currentKey] = currentValue.join('\n').trim();
  }

  return result;
}

function extractDescription(info) {
  if (!info) return '';
  return info
    .replace(/^##?\s+.*$/gm, '')
    .replace(/\*\*/g, '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .join(' ');
}

function regeneratePresentationsJson() {
  console.log(`[regenerate] presentationsDir: ${presentationsDir}`);
  console.log(`[regenerate] presentationsJsonPath: ${presentationsJsonPath}`);

  if (!existsSync(presentationsDir)) {
    console.log(`[regenerate] presentationsDir does not exist!`);
    return;
  }

  const allDirs = readdirSync(presentationsDir);
  console.log(`[regenerate] All items in presentationsDir: ${allDirs.join(', ')}`);

  const dirs = allDirs.filter((name) => {
    const fullPath = join(presentationsDir, name);
    const isDir = statSync(fullPath).isDirectory();
    const hasSlides = existsSync(join(fullPath, 'slides.md'));
    console.log(`[regenerate] ${name}: isDir=${isDir}, hasSlides=${hasSlides}`);
    return isDir && hasSlides;
  });

  const presentations = dirs
    .map((name) => {
      const slidesPath = join(presentationsDir, name, 'slides.md');
      const content = readFileSync(slidesPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      return {
        id: name,
        title: frontmatter.title || name,
        description: extractDescription(frontmatter.info) || '',
        theme: frontmatter.theme || 'default',
        background: frontmatter.background || '',
        duration: frontmatter.duration || '',
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const outputDir = dirname(presentationsJsonPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(presentationsJsonPath, JSON.stringify(presentations, null, 2));
  console.log(`[regenerate] Updated presentations.json with ${presentations.length} presentations`);
}

function isValidPresentationId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 100 && SLUG_REGEX.test(id);
}

function getNextPort() {
  const usedPorts = new Set([...runningServers.values()].map((s) => s.port));
  let port = 3030;
  while (usedPorts.has(port)) {
    port++;
  }
  return port;
}

function startServer(presentationId) {
  if (!isValidPresentationId(presentationId)) {
    return { success: false, error: 'Invalid presentation id' };
  }

  if (runningServers.has(presentationId)) {
    return { success: true, port: runningServers.get(presentationId).port, alreadyRunning: true };
  }

  const presentationPath = join(projectRoot, 'presentations', presentationId);
  const slidevBin = join(presentationPath, 'node_modules', '.bin', 'slidev');

  if (!existsSync(presentationPath)) {
    return { success: false, error: 'Presentation not found' };
  }

  if (!existsSync(slidevBin)) {
    return { success: false, error: 'Dependencies not installed. Run pnpm install first.' };
  }

  const port = getNextPort();

  const child = spawn(slidevBin, ['--port', String(port), '--open', 'false'], {
    cwd: presentationPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: !IS_WINDOWS,
    shell: IS_WINDOWS,
  });

  child.unref();

  runningServers.set(presentationId, { process: child, port });

  child.stderr.on('data', (data) => {
    console.error(`[${presentationId}] stderr:`, data.toString());
  });

  child.on('close', (code) => {
    console.log(`[${presentationId}] process exited with code ${code}`);
    runningServers.delete(presentationId);
  });

  child.on('error', (err) => {
    console.error(`Failed to start server for ${presentationId}:`, err);
    runningServers.delete(presentationId);
  });

  return { success: true, port, alreadyRunning: false };
}

function stopServer(presentationId) {
  const server = runningServers.get(presentationId);
  if (!server) {
    return { success: false, error: 'Server not running' };
  }

  if (IS_WINDOWS) {
    try {
      execSync(`taskkill /pid ${server.process.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Process may have already exited
    }
  } else {
    server.process.kill('SIGTERM');
  }
  runningServers.delete(presentationId);
  return { success: true };
}

function stopAllServers() {
  const stopped = [];
  for (const [id] of runningServers) {
    const result = stopServer(id);
    if (result.success) {
      stopped.push(id);
    }
  }
  return { success: true, stopped };
}

function getStatus() {
  const servers = {};
  for (const [id, server] of runningServers) {
    servers[id] = { port: server.port };
  }
  return servers;
}

function exportPresentation(presentationId) {
  return new Promise((resolve) => {
    if (!isValidPresentationId(presentationId)) {
      resolve({ success: false, error: 'Invalid presentation id' });
      return;
    }

    const presentationPath = join(projectRoot, 'presentations', presentationId);
    const exportsDir = join(projectRoot, 'exports');
    const outputPath = join(exportsDir, `${presentationId}.pdf`);

    if (!existsSync(presentationPath)) {
      resolve({ success: false, error: 'Presentation not found' });
      return;
    }

    if (!existsSync(exportsDir)) {
      mkdirSync(exportsDir, { recursive: true });
    }

    console.log(`[export] Starting export for ${presentationId}`);
    console.log(`[export] Output: ${outputPath}`);

    const child = spawn('npx', ['slidev', 'export', '--output', outputPath], {
      cwd: presentationPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`[export] ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[export] ${data.toString().trim()}`);
    });

    child.on('error', (err) => {
      console.error(`[export] Failed to export ${presentationId}:`, err);
      resolve({ success: false, error: `Export failed: ${err.message}` });
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[export] Export complete for ${presentationId}`);
        resolve({
          success: true,
          pdfPath: `/exports/${presentationId}.pdf`,
          filename: `${presentationId}.pdf`,
        });
      } else {
        console.error(`[export] Export failed with code ${code}`);
        resolve({ success: false, error: `Export failed with exit code ${code}. ${stderr}` });
      }
    });
  });
}

function createPresentation({ name, title, description, template = 'default' }) {
  return new Promise((resolve) => {
    const presentationPath = join(presentationsDir, name);

    if (existsSync(presentationPath)) {
      resolve({
        success: false,
        field: 'name',
        message: 'A presentation with this name already exists',
      });
      return;
    }

    if (!SLUG_REGEX.test(name)) {
      resolve({
        success: false,
        field: 'name',
        message: 'Name must be a valid slug (lowercase letters, numbers, hyphens only)',
      });
      return;
    }

    const child = spawn('pnpm', ['create', 'slidev', name], {
      cwd: presentationsDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stderr = '';
    let scaffoldingDone = false;
    let pollInterval = null;
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

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
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
        slidesContent = slidesContent.replace(/^(---\n[\s\S]*?)title:\s*.+$/m, `$1title: ${title}`);
      }

      if (description) {
        slidesContent = slidesContent.replace(
          /^(---\n[\s\S]*?)info:\s*\|[\s\S]*?(?=\n[a-zA-Z]|\n---)/m,
          `$1info: |\n  ${description}\n`,
        );
      }

      writeFileSync(slidesPath, slidesContent);

      const sharedExists = hasSharedPackage();
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
        },
        devDependencies: {},
      };

      if (sharedExists) {
        catalogPackageJson.dependencies['@supaslidev/shared'] = 'workspace:*';
      }

      writeFileSync(packageJsonPath, JSON.stringify(catalogPackageJson, null, 2) + '\n');

      regeneratePresentationsJson();

      const presentation = {
        id: name,
        title: frontmatter.title || name,
        description: extractDescription(frontmatter.info) || '',
        theme: template || 'default',
        background: frontmatter.background || 'https://cover.sli.dev',
        duration: frontmatter.duration || '',
      };

      const install = spawn('pnpm', ['install'], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: true,
      });

      install.on('close', (installCode) => {
        if (installCode !== 0) {
          console.error(`[create] pnpm install failed with code ${installCode}`);
        }
        resolve({ success: true, presentation });
      });

      install.on('error', (err) => {
        console.error(`[create] pnpm install error:`, err);
        resolve({ success: true, presentation });
      });
    });
  });
}

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.nuxt',
  '.output',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '.DS_Store',
];

function shouldIgnore(name) {
  return IGNORE_PATTERNS.includes(name);
}

function copyDirectorySelective(source, destination) {
  mkdirSync(destination, { recursive: true });
  const entries = readdirSync(source);

  for (const entry of entries) {
    if (shouldIgnore(entry)) {
      continue;
    }

    const sourcePath = join(source, entry);
    const destPath = join(destination, entry);
    const stat = statSync(sourcePath);

    if (stat.isDirectory()) {
      cpSync(sourcePath, destPath, { recursive: true });
    } else {
      cpSync(sourcePath, destPath);
    }
  }
}

function validateSourceDirectory(sourcePath) {
  try {
    if (!existsSync(sourcePath)) {
      return { isValid: false, error: 'Source directory does not exist' };
    }

    if (!statSync(sourcePath).isDirectory()) {
      return { isValid: false, error: 'Source path is not a directory' };
    }

    const slidesPath = join(sourcePath, 'slides.md');
    if (!existsSync(slidesPath)) {
      return { isValid: false, error: 'No slides.md found in source directory' };
    }

    const packageJsonPath = join(sourcePath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return { isValid: false, error: 'No package.json found in source directory' };
    }

    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: `Validation error: ${err.message}` };
  }
}

function validatePath(path) {
  const sourcePath = resolve(path);
  const validation = validateSourceDirectory(sourcePath);

  if (!validation.isValid) {
    return {
      path,
      isValid: false,
      suggestedName: null,
      error: validation.error,
    };
  }

  const suggestedName = basename(sourcePath)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');

  return {
    path,
    isValid: true,
    suggestedName,
    error: null,
  };
}

function validatePaths(paths) {
  return paths.map(validatePath);
}

function importPresentation({ source, name }) {
  return new Promise((resolvePromise) => {
    const sourcePath = resolve(source);
    const validation = validateSourceDirectory(sourcePath);

    if (!validation.isValid) {
      resolvePromise({
        success: false,
        field: 'source',
        message: validation.error,
      });
      return;
    }

    const presentationName =
      name ||
      basename(sourcePath)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-');

    if (!SLUG_REGEX.test(presentationName)) {
      resolvePromise({
        success: false,
        field: 'name',
        message: 'Name must be a valid slug (lowercase letters, numbers, hyphens only)',
      });
      return;
    }

    const destinationPath = join(presentationsDir, presentationName);

    if (existsSync(destinationPath)) {
      resolvePromise({
        success: false,
        field: 'name',
        message: 'A presentation with this name already exists',
      });
      return;
    }

    console.log(`[import] Importing from: ${sourcePath}`);
    console.log(`[import] Destination: ${destinationPath}`);

    copyDirectorySelective(sourcePath, destinationPath);

    const sourcePackageJsonPath = join(sourcePath, 'package.json');
    const packageJsonContent = readFileSync(sourcePackageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.name = `@supaslidev/${presentationName}`;
    packageJson.private = true;
    packageJson.scripts = {
      dev: 'slidev --open',
      build: 'slidev build',
      export: 'slidev export',
    };

    if (packageJson.dependencies) {
      packageJson.dependencies = convertToCatalogDependencies(packageJson.dependencies);
    }
    if (packageJson.devDependencies) {
      packageJson.devDependencies = convertToCatalogDependencies(packageJson.devDependencies);
    }

    const sharedExists = hasSharedPackage();
    if (sharedExists) {
      addSharedDependencyToPackageJson(packageJson);
    }

    writeFileSync(
      join(destinationPath, 'package.json'),
      JSON.stringify(packageJson, null, 2) + '\n',
    );

    if (sharedExists) {
      const slidesPath = join(destinationPath, 'slides.md');
      if (existsSync(slidesPath)) {
        addSharedAddonToSlides(slidesPath);
      }
    }

    console.log('[import] Files copied successfully');
    console.log('[import] Running pnpm install...');

    const install = spawn('pnpm', ['install'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    });

    install.on('close', (code) => {
      if (code === 0) {
        console.log('[import] pnpm install completed');
        regeneratePresentationsJson();
        resolvePromise({
          success: true,
          presentation: {
            id: presentationName,
            title: presentationName,
            description: '',
            theme: 'default',
            background: 'https://cover.sli.dev',
            duration: '',
          },
        });
      } else {
        console.error(`[import] pnpm install failed with code ${code}`);
        resolvePromise({
          success: false,
          field: 'install',
          message: `Failed to install dependencies (exit code ${code})`,
        });
      }
    });

    install.on('error', (err) => {
      console.error('[import] pnpm install error:', err);
      resolvePromise({
        success: false,
        field: 'install',
        message: `Failed to install dependencies: ${err.message}`,
      });
    });
  });
}

function uploadPresentation({ files, name, folderName }) {
  return new Promise((resolvePromise) => {
    if (!Array.isArray(files) || files.length === 0) {
      resolvePromise({
        success: false,
        field: 'files',
        message: 'No files provided',
      });
      return;
    }

    const hasSlides = files.some((f) => f.path === 'slides.md');
    const hasPackageJson = files.some((f) => f.path === 'package.json');

    if (!hasSlides) {
      resolvePromise({
        success: false,
        field: 'files',
        message: 'No slides.md found in uploaded files',
      });
      return;
    }

    if (!hasPackageJson) {
      resolvePromise({
        success: false,
        field: 'files',
        message: 'No package.json found in uploaded files',
      });
      return;
    }

    const presentationName =
      name || (folderName || 'presentation').toLowerCase().replace(/[^a-z0-9-]/g, '-');

    if (!SLUG_REGEX.test(presentationName)) {
      resolvePromise({
        success: false,
        field: 'name',
        message: 'Name must be a valid slug (lowercase letters, numbers, hyphens only)',
      });
      return;
    }

    const destinationPath = join(presentationsDir, presentationName);

    if (existsSync(destinationPath)) {
      resolvePromise({
        success: false,
        field: 'name',
        message: 'A presentation with this name already exists',
      });
      return;
    }

    console.log(`[upload] Creating presentation: ${presentationName}`);
    console.log(`[upload] Destination: ${destinationPath}`);
    console.log(`[upload] Files to write: ${files.length}`);

    mkdirSync(destinationPath, { recursive: true });

    for (const file of files) {
      if (shouldIgnore(file.path.split('/')[0])) {
        continue;
      }

      const filePath = join(destinationPath, file.path);
      const fileDir = dirname(filePath);

      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }

      if (file.encoding === 'base64') {
        writeFileSync(filePath, Buffer.from(file.content, 'base64'));
      } else {
        writeFileSync(filePath, file.content, 'utf-8');
      }
    }

    const packageJsonPath = join(destinationPath, 'package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.name = `@supaslidev/${presentationName}`;
    packageJson.private = true;
    packageJson.scripts = {
      dev: 'slidev --open',
      build: 'slidev build',
      export: 'slidev export',
    };

    if (packageJson.dependencies) {
      packageJson.dependencies = convertToCatalogDependencies(packageJson.dependencies);
    }
    if (packageJson.devDependencies) {
      packageJson.devDependencies = convertToCatalogDependencies(packageJson.devDependencies);
    }

    const sharedExists = hasSharedPackage();
    if (sharedExists) {
      addSharedDependencyToPackageJson(packageJson);
    }

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    if (sharedExists) {
      const slidesPath = join(destinationPath, 'slides.md');
      if (existsSync(slidesPath)) {
        addSharedAddonToSlides(slidesPath);
      }
    }

    console.log('[upload] Files written successfully');
    console.log('[upload] Running pnpm install...');

    const install = spawn('pnpm', ['install'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    });

    install.on('close', (code) => {
      if (code === 0) {
        console.log('[upload] pnpm install completed');
        regeneratePresentationsJson();
        resolvePromise({
          success: true,
          presentation: {
            id: presentationName,
            title: presentationName,
            description: '',
            theme: 'default',
            background: 'https://cover.sli.dev',
            duration: '',
          },
        });
      } else {
        console.error(`[upload] pnpm install failed with code ${code}`);
        resolvePromise({
          success: false,
          field: 'install',
          message: `Failed to install dependencies (exit code ${code})`,
        });
      }
    });

    install.on('error', (err) => {
      console.error('[upload] pnpm install error:', err);
      resolvePromise({
        success: false,
        field: 'install',
        message: `Failed to install dependencies: ${err.message}`,
      });
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === '/api/presentations' && req.method === 'GET') {
    try {
      if (existsSync(presentationsJsonPath)) {
        const data = readFileSync(presentationsJsonPath, 'utf-8');
        res.writeHead(200);
        res.end(data);
      } else {
        res.writeHead(200);
        res.end('[]');
      }
    } catch {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to read presentations' }));
    }
    return;
  }

  if (path === '/api/servers' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(getStatus()));
    return;
  }

  if (path === '/api/servers' && req.method === 'DELETE') {
    const result = stopAllServers();
    res.writeHead(200);
    res.end(JSON.stringify(result));
    return;
  }

  if (path === '/api/servers/stop-all' && req.method === 'POST') {
    const result = stopAllServers();
    res.writeHead(200);
    res.end(JSON.stringify(result));
    return;
  }

  if (path.startsWith('/api/servers/') && req.method === 'POST') {
    const presentationId = path.split('/api/servers/')[1];
    const result = startServer(presentationId);
    res.writeHead(result.success ? 200 : 500);
    res.end(JSON.stringify(result));
    return;
  }

  if (path.startsWith('/api/servers/') && req.method === 'DELETE') {
    const presentationId = path.split('/api/servers/')[1];
    const result = stopServer(presentationId);
    res.writeHead(result.success ? 200 : 404);
    res.end(JSON.stringify(result));
    return;
  }

  if (path === '/api/presentations' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const result = await createPresentation(data);
        if (result.success) {
          res.writeHead(201);
          res.end(JSON.stringify(result.presentation));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ field: result.field, message: result.message }));
        }
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (path === '/api/presentations/validate' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
        return;
      }

      if (!Array.isArray(data.paths)) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: 'paths must be an array' }));
        return;
      }

      try {
        const results = validatePaths(data.paths);
        res.writeHead(200);
        res.end(JSON.stringify(results));
      } catch (err) {
        console.error('[validate] Error validating paths:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ message: `Validation failed: ${err.message}` }));
      }
    });
    return;
  }

  if (path === '/api/presentations/import' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const result = await importPresentation(data);
        if (result.success) {
          res.writeHead(201);
          res.end(JSON.stringify(result.presentation));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ field: result.field, message: result.message }));
        }
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (path === '/api/presentations/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const result = await uploadPresentation(data);
        if (result.success) {
          res.writeHead(201);
          res.end(JSON.stringify(result.presentation));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ field: result.field, message: result.message }));
        }
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ message: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (path.startsWith('/api/export/') && req.method === 'POST') {
    const presentationId = path.split('/api/export/')[1];
    const result = await exportPresentation(presentationId);
    res.writeHead(result.success ? 200 : 400);
    res.end(JSON.stringify(result));
    return;
  }

  if (path.startsWith('/api/open-editor/') && req.method === 'POST') {
    const presentationId = path.split('/api/open-editor/')[1];
    if (!isValidPresentationId(presentationId)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: 'Invalid presentation id' }));
      return;
    }
    const slidesPath = join(projectRoot, 'presentations', presentationId, 'slides.md');
    if (!existsSync(slidesPath)) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: 'Presentation not found' }));
      return;
    }
    spawn('code', [slidesPath], { detached: true, stdio: 'ignore' }).unref();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (path.startsWith('/exports/') && req.method === 'GET') {
    const exportsDir = join(projectRoot, 'exports');
    const filePath = join(exportsDir, path.slice('/exports/'.length));
    const rel = relative(exportsDir, filePath);
    if (
      !rel.startsWith('..') &&
      filePath.startsWith(exportsDir) &&
      existsSync(filePath) &&
      filePath.endsWith('.pdf')
    ) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${basename(filePath)}"`);
      createReadStream(filePath).pipe(res);
      return;
    }
  }

  if (dashboardDir) {
    const requestedFile = path === '/' ? '/index.html' : path;
    const filePath = join(dashboardDir, requestedFile);
    const normalizedPath = resolve(filePath);

    if (
      normalizedPath.startsWith(resolve(dashboardDir)) &&
      existsSync(filePath) &&
      statSync(filePath).isFile()
    ) {
      const ext = extname(filePath);
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      createReadStream(filePath).pipe(res);
      return;
    }

    const indexPath = join(dashboardDir, 'index.html');
    if (existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html');
      createReadStream(indexPath).pipe(res);
      return;
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

const API_PORT = dashboardDir ? 3000 : 7777;

server.listen(API_PORT, () => {
  if (dashboardDir) {
    console.log(`Supaslidev dashboard: http://localhost:${API_PORT}`);
    const openCmd =
      process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(openCmd, [`http://localhost:${API_PORT}`], {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    }).unref();
  } else {
    console.log(`API server running on http://localhost:${API_PORT}`);
  }
});

process.on('SIGINT', () => {
  console.log('\nShutting down servers...');
  for (const [id] of runningServers) {
    stopServer(id);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  for (const [id] of runningServers) {
    stopServer(id);
  }
  process.exit(0);
});
