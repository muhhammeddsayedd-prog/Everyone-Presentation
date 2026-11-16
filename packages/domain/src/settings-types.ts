import type { Actor, MutationContext } from './types.ts';

export interface Settings {
  template_version: string;
  default_timezone: string;
  default_review_expiry_days: 30;
  models: Record<string, string>;
  row_version: number;
  /** Audience an ordinary new series uses; null until a Studio manager chooses it (absent before m18). */
  default_audience_preset_id?: string | null;
}
export interface SettingsPatch {
  row_version: number;
  default_timezone?: string;
  template_version?: string;
  default_audience_preset_id?: string | null;
}
export interface SettingsOperations {
  getSettings(actor: Actor): Promise<Settings>;
  updateSettings(actor: Actor, input: unknown, context?: MutationContext): Promise<Settings>;
}
