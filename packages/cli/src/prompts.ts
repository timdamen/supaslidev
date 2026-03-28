import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { PresentationInfo } from './migrations/types.ts';

export interface ScaffoldOptions {
  projectName: string;
  presentationName: string;
  initGit: boolean;
}

export interface CatalogSelectionResult {
  selectedForCatalog: string[];
  cancelled: boolean;
}

function validateProjectName(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return 'Project name is required';
  }
  if (!/^[a-z0-9-]+$/.test(value!)) {
    return 'Project name must be lowercase alphanumeric with hyphens only';
  }
  if (value!.startsWith('-') || value!.endsWith('-')) {
    return 'Project name cannot start or end with a hyphen';
  }
  return undefined;
}

function validatePresentationName(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return 'Presentation name is required';
  }
  if (!/^[a-z0-9-]+$/.test(value!)) {
    return 'Presentation name must be lowercase alphanumeric with hyphens only';
  }
  if (value!.startsWith('-') || value!.endsWith('-')) {
    return 'Presentation name cannot start or end with a hyphen';
  }
  return undefined;
}

export async function promptForScaffoldOptions(): Promise<ScaffoldOptions | null> {
  p.intro(pc.cyan('Create a new Supaslidev workspace'));

  const projectName = await p.text({
    message: 'What is your project name?',
    placeholder: 'my-presentations',
    validate: validateProjectName,
  });

  if (p.isCancel(projectName)) {
    p.cancel('Operation cancelled');
    return null;
  }

  const presentationName = await p.text({
    message: 'What is the name of your first presentation?',
    placeholder: 'my-first-deck',
    defaultValue: 'my-first-deck',
    validate: validatePresentationName,
  });

  if (p.isCancel(presentationName)) {
    p.cancel('Operation cancelled');
    return null;
  }

  const initGit = await p.confirm({
    message: 'Initialize a git repository?',
    initialValue: true,
  });

  if (p.isCancel(initGit)) {
    p.cancel('Operation cancelled');
    return null;
  }

  p.outro(pc.green('Configuration complete!'));

  return {
    projectName,
    presentationName,
    initGit,
  };
}

export async function promptForCatalogSelection(
  presentations: PresentationInfo[],
): Promise<CatalogSelectionResult> {
  p.intro(pc.cyan('Catalog Conversion Selection'));

  p.note(
    `${pc.bold('Select presentations to convert to catalog: references')}\n\n` +
      `Selected presentations will use ${pc.green('catalog:')} (managed versions)\n` +
      `Unselected presentations will use ${pc.yellow('^52.11.3')} (pinned version)\n\n` +
      `${pc.dim('Controls:')} ${pc.bold('Space')} ${pc.dim('toggle |')} ${pc.bold('a')} ${pc.dim('toggle all |')} ${pc.bold('Enter')} ${pc.dim('confirm')}`,
    'Migration Options',
  );

  const options = presentations.map((pres) => ({
    value: pres.name,
    label: pres.name,
    hint: `currently ${pres.currentVersion}`,
  }));

  const selected = await p.multiselect({
    message: 'Which presentations should use catalog: references?',
    options,
    initialValues: presentations.map((p) => p.name),
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel('Migration cancelled');
    return { selectedForCatalog: [], cancelled: true };
  }

  const selectedCount = selected.length;
  const pinnedCount = presentations.length - selectedCount;

  if (selectedCount > 0) {
    p.log.success(`${selectedCount} presentation(s) will use catalog: references`);
  }
  if (pinnedCount > 0) {
    p.log.info(`${pinnedCount} presentation(s) will use pinned ^52.11.3`);
  }

  return { selectedForCatalog: selected, cancelled: false };
}
