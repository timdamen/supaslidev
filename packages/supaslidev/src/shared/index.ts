export type { Presentation, PackageJson, ValidationResult, PathValidationResult } from './types.js';

export {
  SLUG_REGEX,
  IGNORE_PATTERNS,
  isValidPresentationId,
  validateName,
  shouldIgnore,
  validateSourceDirectory,
  validateSourceDirectoryResult,
  validatePath,
  validatePaths,
} from './validation.js';

export {
  parseFrontmatter,
  extractDescription,
  regeneratePresentationsJson,
} from './presentations.js';

export {
  CATALOG_DEPENDENCIES,
  hasSharedPackage,
  addSharedAddonToSlides,
  addSharedDependencyToPackageJson,
  convertToCatalogDependencies,
} from './catalog.js';

export { copyDirectorySelective } from './copy.js';
