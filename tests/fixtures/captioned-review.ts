import type { WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import { captionedTemplate, referenceReview, type RefOptions, type RefPerson, type RefRole } from './reference-review.ts';

/** Synthetic template 1.4.1 reviews (no real people): every page type of 1.4.0 with names, ages and heights in the
 * forms the archive and the extraction produce, including missing values, weights without a height and long names. */
export const LONG_NAME = 'Alexandria Montgomery-Fitzgerald Al-Sharif';
const person = (position: RefPerson['position'], name: string, age?: string, height?: string, extra: Partial<RefPerson> = {}): RefPerson => ({ position, name, ...age !== undefined ? { age } : {}, ...height !== undefined ? { height } : {}, ...extra });

export function captionedRoles(): RefRole[] {
  return [
    { name: 'Delivery Guy', slots: [[person('option', 'Omar Haddad', '34', 'Height: 173; weight: 77. Units not stated.')]] },
    { name: 'Saudi Father', slots: [[person('main', 'Khalid Al-Mansour', '45', '182 cm'), person('backup', 'Faisal Rahman', '41', 'Height 180', { portrait: 'photo' })]] },
    { name: 'Saudi Mother', slots: [[person('main', 'Noura Saleh', '38', 'weight 62 kg')]], note: 'Backup pending.' },
    { name: 'Saudi Son', slots: [[person('main', 'Yousef Karim', '12', '150 cm'), person('backup', 'Adam Nasser', '13', '1.52 m'), person('backup', 'Ziad Fawzi', '11'), person('backup', LONG_NAME, '12', '148 cm')]] },
    { name: '2 Featured Waiters', slots: [[person('option', 'Hassan Ali', '29', '178 cm'), person('option', 'Not provided', '31', '175 cm', { frame: false, state: 'intentionally_empty' })]] },
    { name: 'Car Workers', slots: [[person('option', 'Tarek Mostafa', '40-50', "5'11\""), person('option', 'Samir Aziz', 'early forties'), person('option', 'Bilal Hamdan', undefined, '176 cm')]] },
    { name: 'Featured Female Guests', slots: [[person('option', 'Layla Hassan', '27', '165 cm'), person('option', 'Mariam Adel', '30', 'Height: 168'), person('option', 'Salma Fathy', '26'), person('option', 'Dina Samir', '33', '170 cm')]] },
    { name: 'Featured Male Guests', slots: [[person('option', 'Karim Fouad', '35', '181 cm'), person('option', 'Amr Said', '29', '177 cm'), person('option', LONG_NAME, '32', '183 cm'), person('option', 'Ali Gamal', '36'), person('option', 'Mahmoud Reda', '28', '174 cm')]] },
    { name: 'Restaurant Guests', slots: [[person('option', 'Nadia Kamal', '45', '160 cm'), person('option', 'Hana Lotfy', '50', '158 cm'), person('option', 'Rana Zaki', '41'), person('option', 'Mona Badr', '47', '163 cm'), person('option', 'Heba Nour', '39', '166 cm'), person('option', 'Aya Mansour', '44', '161 cm')]] },
    { name: 'Web Designer', slots: [[]], note: 'Missing.' },
  ];
}
export function captionedShowcase(options: RefOptions = {}): WorkspaceReview {
  return referenceReview(captionedRoles(), { coverNote: 'Pending Availability.', logo: true, projectName: 'Floward Launch', template: captionedTemplate, ...options,
    scenes: options.scenes ?? [
      { sequence: 'Mother’s Birthday', title: 'Front Door', occurrences: [{ role: 0 }, { role: 1 }, { role: 2 }, { role: 3 }] },
      { title: 'Restaurant Celebration', occurrences: [4, 5, 6, 7, 8].map(role => ({ role })) },
      { title: 'Floward Workshop', setting: 'UX Studio', occurrences: [{ role: 9 }] },
    ] });
}
