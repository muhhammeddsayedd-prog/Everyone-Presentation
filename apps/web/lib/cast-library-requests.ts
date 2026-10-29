/** Search, retry and pagination share one current Cast Library request. A
 * cancelled transport may still settle, so commits also check its generation. */
export function createCastLibraryRequests() {
  let generation = 0; let active: AbortController | undefined;
  return {
    start() {
      active?.abort(); const controller = new AbortController(); active = controller;
      const current = ++generation;
      return { signal: controller.signal, isCurrent: () => generation === current && active === controller && !controller.signal.aborted };
    },
    cancel() { generation++; active?.abort(); active = undefined; },
  };
}
