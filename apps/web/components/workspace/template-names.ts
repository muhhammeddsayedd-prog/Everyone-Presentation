/** The only presentation template offered for new series (owner decision 2026-11-12): Everyone Film
 * Editorial 1.3.0, from the design kit. Series and saved versions made with earlier templates keep them. */
export const CURRENT_TEMPLATE = '1.3.0';
export const isCurrentTemplate = (version: string | null | undefined) => version === CURRENT_TEMPLATE;
/** Display names for registered presentation templates. */
export const templateName = (version: string) => version === '1.3.0' ? 'Everyone Film Editorial 1.3.0'
  : version === '1.2.0' ? 'Everyone Film Editorial 1.2.0 (earlier template)' : `Everyone Casting ${version} (earlier template)`;
export const isEditorialVersion = (version: string): version is '1.2.0' | '1.3.0' => version === '1.2.0' || version === '1.3.0';
