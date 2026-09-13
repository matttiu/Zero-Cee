// Runs in CI (.github/workflows/process-incoming-photos.yml) whenever the
// admin panel's Cloudflare Worker stages a new raw upload under
// photos/incoming/. Adapted from tools/optimize-images.mjs (same resize
// width / quality / EXIF-rotation settings), but writes to the next free
// photoN.webp slot, updates content/photos.json, and removes the staged
// original instead of just converting jpg -> webp in place.
import sharp from 'sharp';
import { readdirSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT        = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const INCOMING_DIR = path.join(ROOT, 'photos', 'incoming');
const PHOTOS_DIR    = path.join(ROOT, 'photos');
const MANIFEST_PATH = path.join(ROOT, 'content', 'photos.json');
const MAX_WIDTH = 960;
const QUALITY   = 78;

function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { photos: [] };
  }
}

function nextPhotoIndex(existingPhotos) {
  let max = 0;
  for (const p of existingPhotos) {
    const m = /^photos\/photo(\d+)\.webp$/.exec(p);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

async function main() {
  let incomingFiles;
  try {
    incomingFiles = readdirSync(INCOMING_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  } catch {
    incomingFiles = [];
  }

  if (incomingFiles.length === 0) {
    console.log('No incoming photos to process.');
    return;
  }

  const manifest = loadManifest();
  if (!Array.isArray(manifest.photos)) manifest.photos = [];

  let nextIndex = nextPhotoIndex(manifest.photos);

  for (const file of incomingFiles) {
    const srcPath  = path.join(INCOMING_DIR, file);
    const destName = `photo${nextIndex}.webp`;
    const destPath = path.join(PHOTOS_DIR, destName);

    const info = await sharp(srcPath)
      .rotate() // apply EXIF orientation so phone photos aren't sideways
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(destPath);

    unlinkSync(srcPath);
    manifest.photos.push(`photos/${destName}`);
    console.log(`${file} -> photos/${destName}: ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)}KB`);
    nextIndex += 1;
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Done.');
}

await main();
