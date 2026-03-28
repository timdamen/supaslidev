import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { isValidPresentationId } from '../../../src/shared/validation.js';
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
  const exportsDir = join(projectRoot, 'exports');
  const outputPath = join(exportsDir, `${presentationId}.pdf`);

  if (!existsSync(presentationPath)) {
    throw createError({
      statusCode: 404,
      data: { success: false, error: 'Presentation not found' },
    });
  }

  if (!existsSync(exportsDir)) {
    mkdirSync(exportsDir, { recursive: true });
  }

  return new Promise((resolve) => {
    const child = spawn('npx', ['slidev', 'export', '--output', outputPath], {
      cwd: presentationPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      console.log(`[export] ${data.toString().trim()}`);
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      console.error(`[export] ${data.toString().trim()}`);
    });

    child.on('error', (err: Error) => {
      resolve({ success: false, error: `Export failed: ${err.message}` });
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({
          success: true,
          pdfPath: `/exports/${presentationId}.pdf`,
          filename: `${presentationId}.pdf`,
        });
      } else {
        resolve({ success: false, error: `Export failed with exit code ${code}. ${stderr}` });
      }
    });
  });
});
