#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const GENERATED_ROOT = path.resolve(__dirname, '..', 'generated', 'pixellab');
const PUBLIC_ROOT = path.resolve(__dirname, '..', 'packages', 'frontend', 'public', 'assets');

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function syncCategory(category, mapping = {}) {
  const generatedDir = path.join(GENERATED_ROOT, category);
  const publicDir = path.join(PUBLIC_ROOT, mapping[category] || category);

  if (!(await pathExists(generatedDir))) {
    console.log(`Skipping ${category}: generated directory not found`);
    return;
  }

  if (!(await pathExists(publicDir))) {
    console.log(`Skipping ${category}: public directory not found`);
    return;
  }

  const entries = await fs.readdir(generatedDir, { withFileTypes: true });
  let syncedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const generatedItemDir = path.join(generatedDir, entry.name);
    const publicItemDir = path.join(publicDir, entry.name);
    const previewSrc = path.join(generatedItemDir, 'preview.png');
    const previewDest = path.join(publicItemDir, 'preview.png');

    if (await pathExists(previewSrc) && await pathExists(publicItemDir)) {
      if (!(await pathExists(previewDest))) {
        await fs.copyFile(previewSrc, previewDest);
        console.log(`✅ Copied preview: ${category}/${entry.name}`);
        syncedCount++;
      }
    }
  }

  console.log(`${category}: synced ${syncedCount} preview files`);
}

async function main() {
  console.log('🔄 Syncing pixellab assets...');

  const categoryMapping = {
    'bug-bots': 'bug-bots'
  };

  await syncCategory('agents', categoryMapping);
  await syncCategory('bug-bots', categoryMapping);
  await syncCategory('emotes', categoryMapping);

  console.log('✅ Pixellab asset sync complete!');
}

main().catch(console.error);