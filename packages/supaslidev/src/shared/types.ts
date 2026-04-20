export interface Presentation {
  id: string;
  title: string;
  description: string;
  theme: string;
  background: string;
  duration: string;
  thumbnail?: string;
}

export interface PackageJson {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface PathValidationResult {
  path: string;
  isValid: boolean;
  suggestedName: string | null;
  error: string | null;
}
