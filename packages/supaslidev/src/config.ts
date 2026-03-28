type DateString = `${number}-${number}-${number}`;

const DEFAULT_COMPAT_DATE: DateString = '2025-05-01';

export function defineSupaslidevConfig<T extends Record<string, unknown>>(
  userConfig: T = {} as T,
): T & { extends: string[]; compatibilityDate: DateString } {
  const configExtends = (userConfig as Record<string, unknown>).extends;
  let userExtends: unknown[] = [];
  if (Array.isArray(configExtends)) {
    userExtends = configExtends;
  } else if (configExtends) {
    userExtends = [configExtends];
  }

  return {
    ...userConfig,
    extends: ['supaslidev/layer', ...userExtends],
    compatibilityDate: (userConfig.compatibilityDate as DateString) ?? DEFAULT_COMPAT_DATE,
  } as T & { extends: string[]; compatibilityDate: DateString };
}
