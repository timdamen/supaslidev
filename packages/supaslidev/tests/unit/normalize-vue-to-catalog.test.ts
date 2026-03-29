import { describe, it, expect } from 'vitest';
import { normalizeVueToCatalog } from '../../src/shared/catalog.js';
import type { PackageJson } from '../../src/shared/types.js';

describe('normalizeVueToCatalog', () => {
  it('normalizes vue in dependencies to catalog:', () => {
    const packageJson: PackageJson = {
      dependencies: {
        '@slidev/cli': '^0.50.0',
        vue: '^3.4.0',
      },
    };

    normalizeVueToCatalog(packageJson);

    expect(packageJson.dependencies!['vue']).toBe('catalog:');
    expect(packageJson.dependencies!['@slidev/cli']).toBe('^0.50.0');
  });

  it('normalizes vue in devDependencies to catalog:', () => {
    const packageJson: PackageJson = {
      dependencies: {
        '@slidev/cli': '^0.50.0',
      },
      devDependencies: {
        vue: '^3.5.0',
      },
    };

    normalizeVueToCatalog(packageJson);

    expect(packageJson.devDependencies!['vue']).toBe('catalog:');
  });

  it('normalizes vue in both dependencies and devDependencies', () => {
    const packageJson: PackageJson = {
      dependencies: {
        vue: '^3.4.0',
      },
      devDependencies: {
        vue: '^3.5.0',
      },
    };

    normalizeVueToCatalog(packageJson);

    expect(packageJson.dependencies!['vue']).toBe('catalog:');
    expect(packageJson.devDependencies!['vue']).toBe('catalog:');
  });

  it('does nothing when vue is not present', () => {
    const packageJson: PackageJson = {
      dependencies: {
        '@slidev/cli': '^0.50.0',
        '@slidev/theme-default': '^0.25.0',
      },
    };

    normalizeVueToCatalog(packageJson);

    expect(packageJson.dependencies).toEqual({
      '@slidev/cli': '^0.50.0',
      '@slidev/theme-default': '^0.25.0',
    });
  });

  it('does nothing when dependencies are undefined', () => {
    const packageJson: PackageJson = {};

    normalizeVueToCatalog(packageJson);

    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.devDependencies).toBeUndefined();
  });
});
