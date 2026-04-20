import sharp from 'sharp';
import { existsSync, unlinkSync } from 'node:fs';

const THUMBNAIL_WIDTH = 1280;
const WEBP_QUALITY = 80;

export async function optimizeThumbnail(pngPath: string): Promise<string> {
  if (!existsSync(pngPath)) {
    throw new Error(`Thumbnail not found: ${pngPath}`);
  }

  const webpPath = pngPath.replace(/\.png$/, '.webp');

  await sharp(pngPath)
    .resize(THUMBNAIL_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(webpPath);

  // Remove the original PNG
  unlinkSync(pngPath);

  return webpPath;
}
