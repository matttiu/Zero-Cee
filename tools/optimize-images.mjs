// Converts the site's images into compressed web-ready versions.
//
// Run after adding or replacing any image:
//   1. npm install sharp        (first time only)
//   2. node tools/optimize-images.mjs
//
// What it does:
//   photos/*.jpg -> same-named .webp (max 960px wide), the .jpg is deleted
//   About.jpg    -> About.webp (About.jpg is kept — it's the social preview image)
//   icon.png     -> icon-180.png (the favicon the pages link to)
import sharp from 'sharp';
import { readdirSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_WIDTH = 960;
const QUALITY = 78;

async function convert(srcPath, { keepOriginal = false } = {}) {
  const out = srcPath.replace(/\.jpe?g$/i, '.webp');
  const info = await sharp(srcPath)
    .rotate() // apply EXIF orientation so phone photos aren't sideways
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);
  if (!keepOriginal) unlinkSync(srcPath);
  console.log(`${path.relative(ROOT, out)}: ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`);
}

const photosDir = path.join(ROOT, 'photos');
for (const f of readdirSync(photosDir)) {
  if (/\.jpe?g$/i.test(f)) await convert(path.join(photosDir, f));
}

if (existsSync(path.join(ROOT, 'About.jpg'))) {
  await convert(path.join(ROOT, 'About.jpg'), { keepOriginal: true });
}

if (existsSync(path.join(ROOT, 'icon.png'))) {
  const info = await sharp(path.join(ROOT, 'icon.png'))
    .resize({ width: 180, height: 180, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(ROOT, 'icon-180.png'));
  console.log(`icon-180.png: ${(info.size / 1024).toFixed(0)}KB`);
}

console.log('Done.');
