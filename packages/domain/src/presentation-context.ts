import type { PresentationContext } from './review-types.ts';

/** Template versions whose review, snapshot, render context and manifest carry a `presentation` context.
 * Earlier versions never accept it, so their validation is unchanged. */
export const PRESENTATION_CONTEXT_VERSIONS: readonly string[] = ['1.4.0', '1.4.1'];
export const hasPresentationContext = (version: unknown) => typeof version === 'string' && PRESENTATION_CONTEXT_VERSIONS.includes(version);

const plain = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function safe(value: string) {
  for (const char of value) { const cp = char.codePointAt(0)!; if (cp >= 0xd800 && cp <= 0xdfff || cp < 32 && ![9, 10, 13].includes(cp) || cp === 127) return false; }
  return true;
}
/** Strict structural parser shared by the live review DTO and the frozen snapshot/render context/manifest.
 * `slides` is the number of captured slides it accompanies (cover excluded); `fail` throws the caller's error. */
export function parsePresentationContext(value: unknown, slides: number, fail: () => never): PresentationContext {
  const record = (input: unknown, keys: readonly string[]) => { if (!plain(input) || Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key))) fail(); return input as Record<string, unknown>; };
  const id = (input: unknown) => { if (typeof input !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,199}$/u.test(input)) fail(); return input as string; };
  const words = (input: unknown, maximum: number) => { if (input === null) return null; if (typeof input !== 'string' || !input.trim() || input.length > maximum || !safe(input)) fail(); return input as string; };
  const integer = (input: unknown, min: number, max: number) => { if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < min || input > max) fail(); return input as number; };
  const row = record(value, ['cover_note', 'scenes', 'slides']);
  words(row.cover_note, 500);
  if (!Array.isArray(row.scenes) || row.scenes.length > 1000 || !Array.isArray(row.slides) || row.slides.length !== slides) fail();
  const sceneIds = new Set<string>(); const occurrenceIds = new Set<string>();
  for (const scene of row.scenes as unknown[]) {
    const item = record(scene, ['scene_id', 'scene_number', 'title', 'sequence_label', 'setting', 'occurrences']);
    if (sceneIds.has(id(item.scene_id))) fail(); sceneIds.add(item.scene_id as string);
    words(item.scene_number, 40); if (words(item.title, 300) === null) fail(); words(item.sequence_label, 300); words(item.setting, 300);
    if (!Array.isArray(item.occurrences) || item.occurrences.length > 1000) fail();
    const roles = new Set<string>();
    for (const occurrence of item.occurrences as unknown[]) {
      const entry = record(occurrence, ['occurrence_id', 'role_id', 'display_title', 'setting_override', 'presentation_note', 'deck_placement']);
      if (occurrenceIds.has(id(entry.occurrence_id)) || roles.has(id(entry.role_id))) fail(); occurrenceIds.add(entry.occurrence_id as string); roles.add(entry.role_id as string);
      words(entry.display_title, 300); words(entry.setting_override, 300); words(entry.presentation_note, 500);
      if (!['auto', 'repeat', 'hidden'].includes(entry.deck_placement as string)) fail();
    }
  }
  for (const slide of row.slides as unknown[]) {
    const item = record(slide, ['role_note', 'slot_note', 'picture_state', 'portrait']);
    words(item.role_note, 500); words(item.slot_note, 500);
    if (item.picture_state !== null && !['unset', 'pinned', 'intentionally_empty'].includes(item.picture_state as string)) fail();
    if (item.portrait !== null) {
      const portrait = record(item.portrait, ['asset_id', 'source', 'width', 'height', 'sha256', 'focal']);
      id(portrait.asset_id); integer(portrait.width, 1, 10000); integer(portrait.height, 1, 10000);
      if (!['frame', 'photo'].includes(portrait.source as string) || typeof portrait.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(portrait.sha256)
        || !Array.isArray(portrait.focal) || portrait.focal.length !== 2 || item.picture_state !== 'pinned') fail();
      for (const value of portrait.focal as unknown[]) integer(value, 0, 1000);
    }
  }
  return structuredClone(row) as unknown as PresentationContext;
}
/** Portrait assets a presentation context draws (distinct, in first-use order). */
export const presentationPortraitAssets = (context: PresentationContext | undefined) => [...new Set((context?.slides ?? []).flatMap(slide => slide.portrait ? [slide.portrait.asset_id] : []))];
