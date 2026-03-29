import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { PresentationInfo } from './migrations/types.ts';

export interface CatalogSelectionResult {
  selectedForCatalog: string[];
  cancelled: boolean;
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
