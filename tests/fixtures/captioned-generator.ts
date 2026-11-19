import type { WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import { captionedTemplate, referenceReview, referenceTemplate, type RefPerson, type RefRole, type RefScene } from './reference-review.ts';

function random(seed: number) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; }; }
const NOTES = [undefined, null, '', '   ', 'We’ll choose Only One.', ' Missing. '];
/** Names, ages and measurements in the forms the archive import and the extraction produce, with missing values. */
export const NAMES = ['Synthetic Person', 'Not provided', ' ', 'Alexandria Montgomery-Fitzgerald Al-Sharif', 'Pending', 'Omar'];
export const AGES = [undefined, 'Not provided', '34', ' 40-50 ', 'early forties', '', 'Pending', 'Age 18-24, Age 25-34'];
export const HEIGHTS = [undefined, 'Not provided', 'Height: 173; weight: 77. Units not stated.', '180 cm', 'weight 70 kg', '', '173', '1.73m', "5'11\"", '180 cm, 75 kg', '77 kg',
  'Height / Measurements', 'Height: unknown; 180', 'Chest 90, height 182 cm', 'Height 180 in Cairo', '1735', 'éheight 180', 'height_180', 'HEIGHT=180CM', 'Height (cm): 173', '5′ 11″', 'height: 175 cm'];

/** Random roles (0-3 slots of 0-8 people with any position), pictures (frame, photo, none, deliberately empty),
 * notes, scenes with auto/repeat/hidden occurrences, and random names, ages and measurements. 1.4.1 by default. */
export function generatedCaptioned(seed: number, version: '1.4.0' | '1.4.1' = '1.4.1'): WorkspaceReview {
  const next = random(seed); const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const roles: RefRole[] = Array.from({ length: 1 + Math.floor(next() * 6) }, (_, r) => ({
    name: `Role ${r}`, note: pick(NOTES) as string | null,
    slotNotes: Array.from({ length: 3 }, () => pick(NOTES) as string | null),
    slots: Array.from({ length: Math.floor(next() * 4) }, () => Array.from({ length: Math.floor(next() * 9) }, (): RefPerson => {
      const picture = next(); const name = pick(NAMES); const age = pick(AGES); const height = pick(HEIGHTS);
      return { position: pick(['main', 'backup', 'option', 'option'] as const), frame: picture > 0.15, portrait: picture > 0.7 ? 'photo' : picture > 0.55 ? 'frame' : null,
        ...next() < 0.1 ? { state: 'intentionally_empty' as const } : {}, ...name === 'Synthetic Person' ? {} : { name }, ...age === undefined ? {} : { age }, ...height === undefined ? {} : { height } };
    })),
  }));
  const scenes: RefScene[] = next() < 0.25 ? [] : Array.from({ length: 1 + Math.floor(next() * 4) }, (_, s) => ({
    title: `Scene ${s}`, sequence: pick([null, null, 'Birthday', 'Workshop', '  ']), setting: pick([null, 'Kitchen', 'Garden']),
    occurrences: [...new Set(Array.from({ length: Math.floor(next() * 4) }, () => Math.floor(next() * (roles.length + 1))))].map(role => ({
      role, placement: pick(['auto', 'auto', 'repeat', 'hidden'] as const), note: pick(NOTES) as string | null, setting: pick([null, 'Front Door']) })),
  }));
  return referenceReview(roles, { scenes, coverNote: pick(NOTES) as string | null, logo: next() < 0.5, template: version === '1.4.1' ? captionedTemplate : referenceTemplate });
}
