import { createStudio, DomainError } from '@eps/domain';
import sharp from 'sharp';
import { readRuntimeConfig } from './config';
import { createCentralStudio, readCentralConfig, type CentralStudioOptions } from '@eps/central';
import { getCentralClient } from './central-client';
import { readCentralLogoOptions } from './logo-config';
import { readCentralSpecsOptions } from './specs-config';
import { readCentralCandidateOptions } from './candidate-config';

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
  if (config.adapterMode === 'supabase') {
    const central = readCentralConfig();
    let logo: CentralStudioOptions['logo'];
    let specs: CentralStudioOptions['specs'];
    try { logo = readCentralLogoOptions(decodeLogo); }
    catch (error) {
      // A missing upload verifier must not take existing Ready media offline.
      if (!(error instanceof DomainError) || error.code !== 'LOGO_STORAGE_CONFIGURATION_REQUIRED') throw error;
    }
    try { specs = readCentralSpecsOptions(); }
    catch (error) {
      if (!(error instanceof DomainError) || error.code !== 'SPECS_STORAGE_CONFIGURATION_REQUIRED') throw error;
    }
    return createCentralStudio(await getCentralClient(), { logo, specs, candidate: readCentralCandidateOptions(),
      logoRead: { storageOrigin: central.url, brandBucket: 'eps-brand-assets' }, specsRead: { storageOrigin: central.url }, candidateRead: { storageOrigin: central.url } });
  }
  return createStudio({ dataDir: config.dataDir, environment: config.environment,
    adapterMode: 'local_fixture', appBaseUrl: config.baseUrl, decodeLogo });
}
