import type { Actor, MutationContext } from './types.ts';

export interface Settings {
  template_version: string;
  default_timezone: string;
  default_review_expiry_days: 30;
  models: Record<string, string>;
  row_version: number;
}
export interface SettingsPatch {
  row_version: number;
  default_timezone?: string;
  template_version?: string;
}
export interface SettingsOperations {
  getSettings(actor: Actor): Promise<Settings>;
  updateSettings(actor: Actor, input: unknown, context?: MutationContext): Promise<Settings>;
}
