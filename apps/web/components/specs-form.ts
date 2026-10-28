import type { Role, RoleCreate, RolePatch, RoleRequirements, SpecsClarification } from '@eps/domain';

export const requirementFields = [
  ['age_range', 'Age range', false], ['gender_requirement', 'Stated gender requirement', false],
  ['appearance_performance', 'Appearance and performance', false], ['languages', 'Languages', true],
  ['accents', 'Accents', true], ['skills', 'Skills and experience', true], ['scene_references', 'Scenes and settings', true],
  ['shoot_dates', 'Shoot dates', true], ['location', 'Shoot location', false],
  ['availability_requirements', 'Availability requirements', false], ['other_instructions', 'Other instructions', false],
] as const;
export type RequirementsForm = Record<keyof RoleRequirements, string>;
export interface RoleForm {
  name: string; category: string; requirements: RequirementsForm; clarifications: SpecsClarification[];
  original_requirements: RoleRequirements; original_category: string | null;
}
export function emptyRequirements(): RoleRequirements {
  return { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [],
    scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
}
export function roleForm(role: Pick<Role, 'name' | 'category' | 'requirements' | 'clarifications'>): RoleForm {
  const requirements = {} as RequirementsForm;
  for (const [field, , multiple] of requirementFields) {
    const value = role.requirements[field];
    requirements[field] = multiple ? (value as string[]).join('\n') : value as string | null ?? '';
  }
  return { name: role.name, category: role.category ?? '', requirements, clarifications: structuredClone(role.clarifications),
    original_requirements: structuredClone(role.requirements), original_category: role.category };
}
export function rolePatch(form: RoleForm, rowVersion: number): RolePatch {
  const requirements = {} as RoleRequirements;
  for (const [field, , multiple] of requirementFields) {
    const value = form.requirements[field];
    const original = form.original_requirements[field];
    const originalText = multiple ? (original as string[]).join('\n') : original as string | null ?? '';
    if (value === originalText) (requirements[field] as string[] | string | null) = structuredClone(original);
    else if (multiple) (requirements[field] as string[]) = value.split('\n').map(line => line.trim()).filter(Boolean);
    else (requirements[field] as string | null) = value.trim() ? value : null;
  }
  return { row_version: rowVersion, name: form.name, category: form.category === (form.original_category ?? '')
    ? form.original_category : form.category.trim() ? form.category : null,
    requirements, clarifications: structuredClone(form.clarifications) };
}
/** Rebase a server-confirmed change while retaining fields edited since submission. */
export function rebaseRoleForm(current: RoleForm, previous: RoleForm, saved: Pick<Role, 'name' | 'category' | 'requirements' | 'clarifications'>): RoleForm {
  const result = roleForm(saved);
  if (current.name !== previous.name) result.name = current.name;
  if (current.category !== previous.category) result.category = current.category;
  for (const [field] of requirementFields) if (current.requirements[field] !== previous.requirements[field]) result.requirements[field] = current.requirements[field];
  const key = (marker: SpecsClarification) => JSON.stringify([marker.field_path, marker.reason, marker.source]);
  result.clarifications = result.clarifications.map(marker => {
    const old = previous.clarifications.find(item => key(item) === key(marker));
    const edited = current.clarifications.find(item => key(item) === key(marker));
    return old && edited && old.resolved !== edited.resolved ? structuredClone(edited) : marker;
  });
  return result;
}
export function roleCreate(name: string, count: string, category: string): RoleCreate {
  const headcount = count.trim() === '' ? null : Number(count);
  if (headcount !== null && (!/^[1-9][0-9]*$/u.test(count) || !Number.isSafeInteger(headcount))) {
    throw new Error('Enter a whole number above zero, or leave the count blank when it is unknown.');
  }
  return { name, headcount, category: category.trim() ? category : null, requirements: emptyRequirements() };
}
