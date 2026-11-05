/** Display names for registered presentation templates. */
export const templateName = (version: string) => version === '1.3.0' ? 'Everyone Film Editorial 1.3.0 (2–3 people per slide)'
  : version === '1.2.0' ? 'Everyone Film Editorial 1.2.0' : `Everyone Casting ${version}`;
export const isEditorialVersion = (version: string): version is '1.2.0' | '1.3.0' => version === '1.2.0' || version === '1.3.0';
