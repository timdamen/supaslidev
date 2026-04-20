import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { isValidPresentationId } from '../../../src/shared/validation.js';
import { optimizeThumbnail } from '../../../src/shared/optimize-thumbnail.js';
import { getProjectRoot } from '../../utils/config';

export default defineEventHandler(async (event) => {
  const presentationId = getRouterParam(event, 'id')!;
  const projectRoot = getProjectRoot();

  if (!isValidPresentationId(presentationId)) {
    throw createError({
      statusCode: 400,
      data: { success: false, error: 'Invalid presentation id' },
    });
  }

  const presentationPath = join(projectRoot, 'presentations', presentationId);
  const thumbnailsDir = join(projectRoot, 'thumbnails');
  const outputBase = join(thumbnailsDir, presentationId);

  if (!existsSync(presentationPath)) {
    throw createError({
      statusCode: 404,
      data: { success: false, error: 'Presentation not found' },
    });
  }

  if (!existsSync(thumbnailsDir)) {
    mkdirSync(thumbnailsDir, { recursive: true });
  }

  // Step 1: Export PNG with Slidev
  const exportResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    const slidevBin = join(presentationPath, 'node_modules', '.bin', 'slidev');
    const child = spawn(
      slidevBin,
      ['export', '--format', 'png', '--range', '1', '--output', outputBase],
      {
        cwd: presentationPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.log(`[thumbnail] ${line}`);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      stderr += data.toString();
      if (
        line &&
        !line.includes('outside of Vite serving allow list') &&
        !line.includes('Refer to docs https://vite.dev')
      ) {
        console.error(`[thumbnail] ${line}`);
      }
    });

    child.on('error', (err: Error) => {
      resolve({ success: false, error: `Thumbnail generation failed: ${err.message}` });
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        const pngDirect = `${outputBase}.png`;
        const pngDir = outputBase;
        const targetFile = join(thumbnailsDir, `${presentationId}.png`);

        if (!existsSync(pngDirect) && existsSync(pngDir)) {
          const pngs = readdirSync(pngDir)
            .filter((f) => f.endsWith('.png'))
            .sort();
          if (pngs.length > 0) {
            renameSync(join(pngDir, pngs[0]), targetFile);
          }
        }

        resolve({ success: existsSync(targetFile) });
      } else {
        resolve({
          success: false,
          error: `Thumbnail generation failed with exit code ${code}. ${stderr}`,
        });
      }
    });
  });

  if (!exportResult.success) {
    return exportResult;
  }

  // Step 2: Optimize PNG to WebP
  const pngFile = join(thumbnailsDir, `${presentationId}.png`);
  try {
    await optimizeThumbnail(pngFile);
    return {
      success: true,
      thumbnailPath: `/thumbnails/${presentationId}.webp`,
      filename: `${presentationId}.webp`,
    };
  } catch {
    // Fall back to PNG if optimization fails
    return {
      success: true,
      thumbnailPath: `/thumbnails/${presentationId}.png`,
      filename: `${presentationId}.png`,
    };
  }
});
