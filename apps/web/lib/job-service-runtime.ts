import { createSpecsRuntimeGateway, readSpecsRuntimeConfig, type SpecsRuntimeGateway } from '@eps/central/specs-runtime';
import { readCentralConfig } from '@eps/central';
import { readJobServiceConfiguration } from './job-service-http';

let pending: Promise<SpecsRuntimeGateway> | undefined;
/** Fixed protected environment only. Never import worker management/OpenAI keys,
 * accept request-selected targets, or fall back to a browser/service-role token. */
export async function getJobServiceRuntime() {
  const service = readJobServiceConfiguration(process.env); const central = readCentralConfig(process.env);
  pending ??= createSpecsRuntimeGateway(readSpecsRuntimeConfig(process.env), {},
    { storageOrigin:central.url,publishableKey:central.publishableKey }, { keyId:service.keyId,encryptionKey:service.encryptionKey },process.env.CENTRAL_CANDIDATE_UPLOADS_ENABLED==='true')
    .catch(error => { pending=undefined; throw error; });
  return await pending;
}
