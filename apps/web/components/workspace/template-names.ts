/** The template new series use once a Studio manager selects it in Settings (release step, never a migration):
 * Everyone Film Editorial 1.4.0, reproducing the supplied Floward cast shortlist. Series and saved versions
 * made with earlier templates (including 1.3.0) keep them and stay readable. */
export const CURRENT_TEMPLATE = '1.4.0';
export const isCurrentTemplate = (version: string | null | undefined) => version === CURRENT_TEMPLATE;
/** Templates an existing series can still generate new versions with: 1.4.0 and the frame-based 1.3.0 (no conversion). */
export const GENERATION_TEMPLATES: readonly string[] = ['1.4.0', '1.3.0'];
export const isGenerationTemplate = (version: string | null | undefined) => typeof version === 'string' && GENERATION_TEMPLATES.includes(version);
/** Display names for registered presentation templates. */
export const templateName = (version: string) => version === '1.4.0' ? 'Everyone Film Editorial 1.4.0'
  : version === '1.3.0' ? 'Everyone Film Editorial 1.3.0 (earlier template)'
  : version === '1.2.0' ? 'Everyone Film Editorial 1.2.0 (earlier template)' : `Everyone Casting ${version} (earlier template)`;
export const isEditorialVersion = (version: string): version is '1.2.0' | '1.3.0' | '1.4.0' => version === '1.2.0' || version === '1.3.0' || version === '1.4.0';
