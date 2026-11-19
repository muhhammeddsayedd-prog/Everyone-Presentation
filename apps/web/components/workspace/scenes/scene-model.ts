import type { Assignment } from '../../../../../packages/domain/src/casting-types.ts';
import type { Role, Slot } from '../../../../../packages/domain/src/specs-types.ts';
import type { Scene, SceneOccurrence } from '../../../../../packages/domain/src/scenes-types.ts';
import { formatSceneAppearance } from '../../../../../packages/domain/src/scenes.ts';

/** Pure view model of the scene breakdown. Casting facts are always read from the role's own slots and
 * assignments: an occurrence never has casting of its own, so every scene showing a role shows the same choices. */
export interface RoleProgress { slots: number; mainChosen: number; options: number; backups: number; shortlisted: number; cast: boolean }
export interface SceneProgress { roles: number; cast: number }

export const sceneLabel = (scene: Pick<Scene, 'scene_number' | 'title'>) => scene.scene_number ? `Scene ${scene.scene_number}` : scene.title;
export const sceneName = (scene: Pick<Scene, 'scene_number' | 'title'>) => scene.scene_number ? `${scene.scene_number} · ${scene.title}` : scene.title;

/** Slots shown for this occurrence: its explicit subset, or every active slot of the role. */
export function occurrenceSlots(occurrence: Pick<SceneOccurrence, 'role_id' | 'slot_ids'>, slots: readonly Slot[]): Slot[] {
  const own = slots.filter(slot => slot.role_id === occurrence.role_id && !slot.archived).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  return occurrence.slot_ids.length ? own.filter(slot => occurrence.slot_ids.includes(slot.id)) : own;
}

export function roleProgress(occurrence: Pick<SceneOccurrence, 'role_id' | 'slot_ids'>, slots: readonly Slot[], assignments: readonly Assignment[]): RoleProgress {
  const shown = occurrenceSlots(occurrence, slots); const ids = new Set(shown.map(slot => slot.id));
  const active = assignments.filter(row => !row.archived && ids.has(row.slot_id));
  const mainChosen = shown.filter(slot => active.some(row => row.slot_id === slot.id && row.position === 'main')).length;
  return { slots: shown.length, mainChosen, options: active.filter(row => row.position === 'option').length,
    backups: active.filter(row => row.position === 'backup').length, shortlisted: active.filter(row => row.shortlist_included).length,
    cast: shown.length > 0 && mainChosen === shown.length };
}

export function sceneProgress(scene: Scene, slots: readonly Slot[], assignments: readonly Assignment[]): SceneProgress {
  const confirmed = scene.occurrences.filter(item => item.status === 'confirmed');
  return { roles: confirmed.length, cast: confirmed.filter(item => roleProgress(item, slots, assignments).cast).length };
}

/** "1 option", "2 backups": a count with its singular or plural noun. */
export const countText = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const progressText = (progress: SceneProgress) => progress.roles === 0 ? 'No roles yet' : `${progress.cast}/${progress.roles} ${progress.roles === 1 ? 'role' : 'roles'} cast`;

/** Scenes (in order) in which a role appears. */
export function scenesOfRole(roleId: string, scenes: readonly Scene[]): Scene[] {
  return scenes.filter(scene => scene.occurrences.some(item => item.role_id === roleId));
}
export function appearanceText(roleId: string, scenes: readonly Scene[]): string {
  return formatSceneAppearance(scenesOfRole(roleId, scenes).map(scene => ({ scene_number: scene.scene_number, scene_position: scenes.indexOf(scene) + 1 })));
}

/** Per-role fingerprint of casting choices, used to tell which scenes a casting save affected. */
export function castingFingerprint(roles: readonly Role[], slots: readonly Slot[], assignments: readonly Assignment[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const role of roles) {
    const ids = new Set(slots.filter(slot => slot.role_id === role.id && !slot.archived).map(slot => slot.id));
    result[role.id] = assignments.filter(row => !row.archived && ids.has(row.slot_id))
      .map(row => `${row.id}:${row.slot_id}:${row.position}:${row.shortlist_included ? 1 : 0}`).sort().join('|');
  }
  return result;
}

/** Roles whose casting changed between two fingerprints, with the scenes that show them. */
export function affectedScenes(before: Record<string, string>, after: Record<string, string>, roles: readonly Role[], scenes: readonly Scene[]) {
  const changed = roles.filter(role => Object.hasOwn(before, role.id) && before[role.id] !== after[role.id]);
  return changed.map(role => ({ role, scenes: scenesOfRole(role.id, scenes) })).filter(item => item.scenes.length > 0);
}
export function affectedText(items: ReturnType<typeof affectedScenes>, scenes: readonly Scene[]): string {
  return items.map(({ role, scenes: shown }) => `${role.name || 'Unnamed role'}: casting is shared by ${formatSceneAppearance(shown.map(scene => ({ scene_number: scene.scene_number,
    scene_position: scenes.indexOf(scene) + 1 }))).replace(/^Appears in /u, '')}.`).join(' ');
}

/** Roles offered for "same character as…": every active role, labelled so identical names stay distinguishable. */
export function roleChoices(roles: readonly Role[], scenes: readonly Scene[], slots: readonly Slot[], excluded: ReadonlySet<string>) {
  const names = new Map<string, number>(); for (const role of roles) names.set(role.name, (names.get(role.name) ?? 0) + 1);
  return roles.filter(role => !role.archived && !excluded.has(role.id)).map(role => {
    const count = slots.filter(slot => slot.role_id === role.id && !slot.archived).length;
    const appearance = appearanceText(role.id, scenes);
    const detail = [appearance || 'Not in any scene yet', `${count} ${count === 1 ? 'slot' : 'slots'}`, role.category].filter(Boolean).join(' · ');
    return { id: role.id, name: role.name || 'Unnamed role', detail, duplicateName: (names.get(role.name) ?? 0) > 1 };
  });
}

/** Moves one id up or down; returns null when it cannot move. */
export function moved(ids: readonly string[], id: string, delta: -1 | 1): string[] | null {
  const index = ids.indexOf(id); const target = index + delta;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids]; [next[index], next[target]] = [next[target], next[index]]; return next;
}

export const requirementLines = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 50).map(line => line.slice(0, 500));
