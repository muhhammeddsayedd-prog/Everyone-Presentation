export interface PrivateGuestEnvironment { EPS_REVIEW_GATEWAY_KEY?: string; EPS_REVIEW_REPLAY_KEY?: string }
export class PrivateGuestConfigError extends Error { code: 'PRIVATE_GUEST_CONFIGURATION_INVALID' }
export function parsePrivateGuestEnvironment(text: string): Required<PrivateGuestEnvironment>;
export function loadPrivateGuestEnvironment(): Promise<PrivateGuestEnvironment>;
export function optionalPrivateGuestEnvironment(loader?: () => Promise<PrivateGuestEnvironment>): Promise<{ environment: PrivateGuestEnvironment; unavailable: boolean }>;
