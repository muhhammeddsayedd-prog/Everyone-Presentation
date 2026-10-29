export function createSpecsWorkerEnvironment(
  provider: Readonly<Record<string, string | undefined>>,
  runtime: Readonly<Record<string, string | undefined>>,
  environment?: Readonly<Record<string, string | undefined>>,
  fileEnvironment?: Readonly<Record<string, string | undefined>>,
): Record<string, string> & { NODE_ENV: 'production'; PATH: '' };
export function parseWorkerRuntimeEnvironment(text: string): Record<string, string>;
export function loadWorkerRuntimeEnvironment(options?: { io?: unknown }): Promise<Record<string, string>>;
