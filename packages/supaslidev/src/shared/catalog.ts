import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PackageJson } from './types.js';

export const CATALOG_DEPENDENCIES = [
  '@slidev/cli',
  '@slidev/theme-default',
  '@slidev/theme-seriph',
  '@slidev/theme-apple-basic',
  'vue',
];

export function hasSharedPackage(projectRoot: string): boolean {
  const sharedPackagePath = join(projectRoot, 'packages', 'shared', 'package.json');
  return existsSync(sharedPackagePath);
}

export function addSharedAddonToSlides(slidesPath: string): void {
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
      } else {
        updatedFrontmatter = frontmatter.replace(addonsMatch[0], `addons:\n  - '${sharedAddon}'`);
      }
    }
  } else {
    const themeMatch = frontmatter.match(/^(theme:\s*.+)$/m);
    if (themeMatch) {
      updatedFrontmatter = frontmatter.replace(
        themeMatch[1],
        `${themeMatch[1]}\naddons:\n  - '${sharedAddon}'`,
      );
    } else {
      updatedFrontmatter = `${frontmatter}\naddons:\n  - '${sharedAddon}'`;
    }
  }

  if (updatedFrontmatter !== frontmatter) {
    writeFileSync(slidesPath, `${openDelim}${updatedFrontmatter}\n${closeDelim}${restOfFile}`);
  }
}

export function addSharedDependencyToPackageJson(packageJson: PackageJson): void {
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  if (!packageJson.dependencies['@supaslidev/shared']) {
    packageJson.dependencies['@supaslidev/shared'] = 'workspace:*';
  }
}

export function convertToCatalogDependencies(
  dependencies: Record<string, string>,
): Record<string, string> {
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
