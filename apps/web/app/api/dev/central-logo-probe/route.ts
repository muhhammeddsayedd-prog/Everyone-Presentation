import { randomUUID } from 'node:crypto';
import { createCentralStudio, readCentralConfig } from '@eps/central';
import { DomainError } from '@eps/domain';
import { getCentralClient } from '../../../../lib/central-client';
import { probeWorkspaceInput, readApprovedProbeLogo, requireCentralLogoProbe, runCentralLogoProbe } from '../../../../lib/central-logo-probe';
import { readCentralLogoOptions } from '../../../../lib/logo-config';
import { decodeLogo } from '../../../../lib/studio';
import { failure, json, readJson, requireSameOrigin } from '../../../../lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;
export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    requireCentralLogoProbe(); requireSameOrigin(request);
    if (request.headers.has('authorization')) throw new DomainError('ACCESS_DENIED', 'Use the signed-in development browser.', 403);
    const workspaceId = probeWorkspaceInput(await readJson(request));
    const client = await getCentralClient(false);
    const config = readCentralConfig();
    const logo = readCentralLogoOptions(decodeLogo);
    if (!logo) throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Private logo verification is unavailable.', 503);
    const studio = await createCentralStudio(client, { logo, logoRead: { storageOrigin: config.url, brandBucket: 'eps-brand-assets' } });
    return json(await runCentralLogoProbe({ client, studio, workspaceId, logoBytes: await readApprovedProbeLogo(), requestId }), requestId);
  } catch (error) { return failure(error, requestId); }
}
