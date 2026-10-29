/** Native Chromium needs OS paths, not the worker's provider/database grants.
 * The executable path is selected by the pinned Playwright installation. */
export function nativeBrowserEnvironment(environment: Readonly<Record<string, string | undefined>> = process.env): Record<string, string> {
  const result: Record<string, string> = { PATH: '' };
  for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'LANG']) if (typeof environment[key] === 'string') result[key] = environment[key];
  return result;
}
