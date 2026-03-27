import { describe, it, expect } from 'vitest';
import { validateName } from '../../src/cli/commands/import.js';

describe('validateName', () => {
  it('rejects names with uppercase letters', () => {
    expect(() => validateName('MyPresentation')).toThrow('Name must be lowercase alphanumeric');
    expect(() => validateName('UPPERCASE')).toThrow('Name must be lowercase alphanumeric');
    expect(() => validateName('mixedCase')).toThrow('Name must be lowercase alphanumeric');
  });

  it('rejects names with special characters', () => {
    expect(() => validateName('my_presentation')).toThrow('Name must be lowercase alphanumeric');
    expect(() => validateName('my.presentation')).toThrow('Name must be lowercase alphanumeric');
    expect(() => validateName('my@presentation')).toThrow('Name must be lowercase alphanumeric');
    expect(() => validateName('my presentation')).toThrow('Name must be lowercase alphanumeric');
  });

  it('rejects names with leading hyphens', () => {
    expect(() => validateName('-my-presentation')).toThrow('Name must be lowercase alphanumeric');
    expect(() => validateName('-presentation')).toThrow('Name must be lowercase alphanumeric');
  });

  it('rejects names with trailing hyphens', () => {
    expect(() => validateName('my-presentation-')).toThrow('Name must be lowercase alphanumeric');
    expect(() => validateName('presentation-')).toThrow('Name must be lowercase alphanumeric');
  });

  it('rejects names with consecutive hyphens', () => {
    expect(() => validateName('my--presentation')).toThrow('Name must be lowercase alphanumeric');
  });

  it('accepts valid lowercase-hyphenated names', () => {
    expect(() => validateName('my-presentation')).not.toThrow();
    expect(() => validateName('my-awesome-slides')).not.toThrow();
    expect(() => validateName('intro-to-vue-3')).not.toThrow();
  });

  it('accepts valid lowercase names without hyphens', () => {
    expect(() => validateName('presentation')).not.toThrow();
    expect(() => validateName('slides')).not.toThrow();
    expect(() => validateName('demo2024')).not.toThrow();
  });
});
