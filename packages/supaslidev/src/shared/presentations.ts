import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Presentation } from './types.js';

export function parseFrontmatter(content: string): Record<string, string> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};

  const frontmatter = frontmatterMatch[1];
  const result: Record<string, string> = {};

  let currentKey: string | null = null;
  let currentValue: string[] = [];
  let inMultiline = false;

  const lines = frontmatter.split('\n');

  for (const line of lines) {
    if (inMultiline) {
      if (line.match(/^[a-zA-Z]/)) {
        result[currentKey!] = currentValue.join('\n').trim();
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

export function extractDescription(info: string | undefined): string {
  if (!info) return '';
  return info
    .replace(/^##?\s+.*$/gm, '')
    .replace(/\*\*/g, '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .join(' ');
}

export function regeneratePresentationsJson(
  presentationsDir: string,
  presentationsJsonPath: string,
): void {
  if (!existsSync(presentationsDir)) {
    return;
  }

  const allDirs = readdirSync(presentationsDir);

  const dirs = allDirs.filter((name) => {
    const fullPath = join(presentationsDir, name);
    const isDir = statSync(fullPath).isDirectory();
    const hasSlides = existsSync(join(fullPath, 'slides.md'));
    return isDir && hasSlides;
  });

  const presentations: Presentation[] = dirs
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
}
