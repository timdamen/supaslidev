import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { findProjectRoot, getPresentations, printAvailablePresentations } from '../utils.js';

export interface ThumbnailOptions {
  output?: string;
}

export async function thumbnail(name: string, options: ThumbnailOptions = {}): Promise<void> {
  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    console.error('Error: Could not find a Supaslidev project.');
    console.error('Make sure you are in a directory with a "presentations" folder.');
    process.exit(1);
  }

  const presentationsDir = join(projectRoot, 'presentations');
  const thumbnailsDir = join(projectRoot, 'thumbnails');
  const presentations = getPresentations(presentationsDir);

  if (!presentations.includes(name)) {
    console.error(`Error: Presentation "${name}" not found`);
    printAvailablePresentations(presentations);
    process.exit(1);
  }

  const presentationDir = join(presentationsDir, name);
  const outputPath = options.output ?? join(thumbnailsDir, name);

  if (!existsSync(dirname(outputPath))) {
    mkdirSync(dirname(outputPath), { recursive: true });
  }

  console.log('\n' + '='.repeat(50));
  console.log(`  Generating thumbnail: ${name}`);
  console.log(`  Output: ${outputPath}.png`);
  console.log('='.repeat(50) + '\n');

  const slidevBin = join(presentationDir, 'node_modules', '.bin', 'slidev');
  const slidev = spawn(
    slidevBin,
    ['export', '--format', 'png', '--range', '1', '--output', outputPath],
    {
      cwd: presentationDir,
      stdio: 'inherit',
    },
  );

  slidev.on('error', (err) => {
    console.error(`Failed to generate thumbnail: ${err.message}`);
    process.exit(1);
  });

  slidev.on('close', (code) => {
    if (code !== 0) {
      console.error(`\nThumbnail generation failed with exit code ${code}`);
      process.exit(code ?? 1);
    }

    // Slidev exports into a directory <output>/<n>.png — move it to <output>.png
    const targetFile = `${outputPath}.png`;
    if (!existsSync(targetFile) && existsSync(outputPath)) {
      const pngs = readdirSync(outputPath)
        .filter((f) => f.endsWith('.png'))
        .sort();
      if (pngs.length > 0) {
        renameSync(join(outputPath, pngs[0]), targetFile);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`  Thumbnail generated!`);
    console.log(`  Output: ${targetFile}`);
    console.log('='.repeat(50) + '\n');
  });
}
