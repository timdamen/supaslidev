import pc from 'picocolors';
import { PACKAGE_NAME, checkForUpdates } from '../version.js';

interface UpdateResult {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  error: string | null;
}

async function getUpdateResult(): Promise<UpdateResult> {
  const check = await checkForUpdates();

  return {
    currentVersion: check.currentVersion,
    latestVersion: check.latestVersion,
    updateAvailable: check.updateAvailable,
    error: check.latestVersion === null ? 'Could not reach npm registry' : null,
  };
}

function formatUpdateResult(result: UpdateResult): string {
  const lines: string[] = [];

  lines.push(pc.bold('Supaslidev Update Check'));
  lines.push('─'.repeat(40));
  lines.push('');

  lines.push(`${pc.dim('Current Version:')}  ${result.currentVersion}`);

  if (result.error) {
    lines.push('');
    lines.push(pc.yellow(`⚠ ${result.error}`));
    return lines.join('\n');
  }

  lines.push(`${pc.dim('Latest Version:')}   ${result.latestVersion}`);
  lines.push('');

  if (result.updateAvailable) {
    lines.push(pc.yellow(`Update available: ${result.currentVersion} → ${result.latestVersion}`));
    lines.push('');
    lines.push(pc.bold('To update, run:'));
    lines.push(`  ${pc.cyan(`npm install -g ${PACKAGE_NAME}`)}`);
    lines.push('');
    lines.push(pc.dim('or with pnpm:'));
    lines.push(`  ${pc.cyan(`pnpm add -g ${PACKAGE_NAME}`)}`);
  } else {
    lines.push(pc.green('✓ You are using the latest version'));
  }

  return lines.join('\n');
}

export async function update(): Promise<void> {
  const result = await getUpdateResult();
  console.log(formatUpdateResult(result));

  if (result.error) {
    process.exit(1);
  }
}
