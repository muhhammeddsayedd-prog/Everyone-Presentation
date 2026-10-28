import { createStudio } from '@eps/domain';
import sharp from 'sharp';
import { readRuntimeConfig } from './config';
import { createCentralStudio } from '@eps/central';
import { getCentralClient } from './central-client';

export async function decodeLogo(bytes: Uint8Array) {
  const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false, failOn: 'warning' });
  const meta = await image.metadata();
  if (!['png', 'jpeg', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) !== 1) {
    throw new Error('Use a single PNG, JPEG or WebP image.');
  }
  await image.raw().toBuffer();
  return { mimeType: meta.format === 'jpeg' ? 'image/jpeg' : `image/${meta.format}`, width: meta.width!, height: meta.height! };
}

export async function getStudio() {
  const config = readRuntimeConfig();
  if (config.adapterMode === 'supabase') return createCentralStudio(await getCentralClient());
  return createStudio({ dataDir: config.dataDir, environment: config.environment,
    adapterMode: 'local_fixture', appBaseUrl: config.baseUrl, decodeLogo });
}
