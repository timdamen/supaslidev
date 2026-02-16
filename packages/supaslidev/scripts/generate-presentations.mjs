#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = join(__dirname, '..');

function resolveProjectRoot() {
  if (process.env.SUPASLIDEV_PROJECT_ROOT) {
    return process.env.SUPASLIDEV_PROJECT_ROOT;
  }
  return join(packageDir, '..', '..', '..');
}

function resolvePresentationsDir() {
  if (process.env.SUPASLIDEV_PRESENTATIONS_DIR) {
    return process.env.SUPASLIDEV_PRESENTATIONS_DIR;
  }
  return join(resolveProjectRoot(), 'presentations');
}

const projectRoot = resolveProjectRoot();
const presentationsDir = resolvePresentationsDir();
const outputDir = join(projectRoot, '.supaslidev');
const outputFile = join(outputDir, 'presentations.json');

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

function getPresentations() {
  if (!existsSync(presentationsDir)) {
    return [];
  }

  const dirs = readdirSync(presentationsDir).filter((name) => {
    const fullPath = join(presentationsDir, name);
    return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'slides.md'));
  });

  return dirs
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
}

function main() {
  const presentations = getPresentations();

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputFile, JSON.stringify(presentations, null, 2));
  console.log(`Generated ${outputFile} with ${presentations.length} presentations`);
}

main();
