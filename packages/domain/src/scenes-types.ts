/** Structured scenes (cycle 7, A2). A role stays the canonical character: it owns its slots
 * and every casting decision. A scene occurrence only says "this role appears in this scene",
 * so all occurrences of one role share slots, Main/Option/Backup and shortlist. */
import type { SourceReference } from './specs-types.ts';

export type SceneStatus = 'proposed' | 'confirmed';
export type SceneDeckPlacement = 'auto' | 'repeat' | 'hidden';
export interface SceneRequirements { items: string[] }

export interface SceneOccurrence {
  id: string;
  scene_id: string;
  role_id: string;
  role_name: string;
  /** Empty means every active slot of the role. */
  slot_ids: string[];
  display_title: string | null;
  setting_override: string | null;
  presentation_note: string | null;
  deck_placement: SceneDeckPlacement;
  status: SceneStatus;
  source_refs: SourceReference[];
  sort_order: number;
  row_version: number;
  /** True for a proposal made against an older version of the role; confirming skips it until reviewed. */
  proposal_stale: boolean;
}

export interface Scene {
  id: string;
  workspace_id: string;
  scene_number: string | null;
  title: string;
  sequence_label: string | null;
  setting: string | null;
  notes: string | null;
  requirements: SceneRequirements;
  /** Read-only provenance from specs extraction. */
  source_refs: SourceReference[];
  status: SceneStatus;
  sort_order: number;
  row_version: number;
  archived: boolean;
  occurrences: SceneOccurrence[];
}

export interface RoleOccurrence {
  occurrence_id: string;
  scene_id: string;
  scene_number: string | null;
  scene_title: string;
  setting: string | null;
  /** 1-based position in the active scene order. */
  scene_position: number;
  scene_status: SceneStatus;
  status: SceneStatus;
}

export interface SceneOrder { workspace_id: string; row_version: number; scene_ids: string[] }
export interface SceneConfirmResult {
  workspace_id: string;
  row_version: number;
  confirmed_scene_ids: string[];
  confirmed_occurrence_ids: string[];
  /** Stale proposals (the role changed since the import) left for review. */
  skipped_occurrence_ids: string[];
}
export interface SceneRejectResult {
  workspace_id: string;
  row_version: number;
  rejected_scene_ids: string[];
  rejected_occurrence_ids: string[];
  /** Proposed scenes left unrejected because they hold a confirmed link (unlink it or confirm the scene). */
  skipped_scene_ids: string[];
}

export interface SceneCreate {
  title: string;
  scene_number?: string | null;
  sequence_label?: string | null;
  setting?: string | null;
  notes?: string | null;
  requirements?: SceneRequirements;
}
export interface ScenePatch extends Partial<SceneCreate> { row_version: number }
export interface SceneReorder { row_version: number; scene_ids: string[] }
export interface SceneVersionInput { row_version: number }
export interface SceneOccurrenceLink {
  role_id: string;
  slot_ids?: string[];
  display_title?: string | null;
  setting_override?: string | null;
  presentation_note?: string | null;
  deck_placement?: SceneDeckPlacement;
}
export interface SceneOccurrencePatch extends Omit<SceneOccurrenceLink, 'role_id'> { row_version: number }
export interface SceneConfirm { row_version: number; scene_ids?: string[]; occurrence_ids?: string[] }
export interface SceneArchiveResult { success: true; affected_ids: string[] }
