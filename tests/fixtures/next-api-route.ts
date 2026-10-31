import { AsyncLocalStorage } from 'node:async_hooks';

/** Exercise exported route handlers inside the pinned Next request context.
 * Callers replace fetch with an explicit synthetic boundary; no server starts. */
export async function withSyntheticApiRoute<T>(environment: NodeJS.ProcessEnv,
  callback: (call: (request: Request, segments: string[]) => Promise<Response>) => Promise<T>): Promise<T> {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'AsyncLocalStorage'), previousEnv = process.env;
  Object.defineProperty(globalThis, 'AsyncLocalStorage', { configurable: true, writable: true, value: AsyncLocalStorage });
  process.env = environment;
  try {
    const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
    const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
    const { createWorkStore } = await import('next/dist/server/async-storage/work-store.js');
    const { createRequestStoreForAPI } = await import('next/dist/server/async-storage/request-store.js');
    const { NextRequest } = await import('next/server.js');
    const { GET } = await import('../../apps/web/app/api/v1/[...segments]/route.ts');
    const work = createWorkStore({ page: '/api/v1/[...segments]/route', deploymentId: 'synthetic-route', buildId: 'synthetic-route', previouslyRevalidatedTags: [], renderOpts: {
      cacheLifeProfiles: { default: { stale: 0, revalidate: 0, expire: 1 } }, staticPageGenerationTimeout: 60,
      cacheComponents: false, validationLevel: 'warning', experimental: { isRoutePPREnabled: false, authInterrupts: false, useCacheTimeout: 30000, durableUseCacheEntries: false },
      assetPrefix: '', isBuildTimePrerendering: false, isDraftMode: false, isDebugDynamicAccesses: false,
      waitUntil: undefined, onClose() {}, onAfterTaskError: undefined,
    } });
    return await callback(async (input, segments) => {
      const request = new NextRequest(input);
      const store = createRequestStoreForAPI(request, new URL(request.url), { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined, undefined);
      return workAsyncStorage.run(work, () => workUnitAsyncStorage.run(store, () => GET(request, { params: Promise.resolve({ segments }) })));
    });
  } finally {
    process.env = previousEnv;
    if (previousStorage === undefined) Reflect.deleteProperty(globalThis, 'AsyncLocalStorage');
    else Object.defineProperty(globalThis, 'AsyncLocalStorage', previousStorage);
  }
}
