import type { Actor, MutationContext, Page, Workspace } from './types.ts';
import type { Role, Slot, WorkingSlot } from './specs-types.ts';
import type { ReorderWorkspace } from './role-order.ts';

export type AssignmentPosition = 'option' | 'main' | 'backup';
export type CastingOutput = 'selection' | 'shortlist';
/** Serialized UTF-8 mutation budget; not a headcount or stored-field maximum. */
export const castingRequestMaximumBytes = 65536;
export const slideWordingFields = ['name_or_id', 'age_or_range', 'height_measurements', 'languages_accents',
  'skills_experience', 'city', 'previous_projects_roles', 'classification', 'availability', 'presentation_notes'] as const;
export type SlideWordingField = typeof slideWordingFields[number];
/** Null is a patch instruction to inherit the source again, never a stored fact. */
export type SlideWording = Partial<Record<SlideWordingField, string | null>>;

export interface Assignment {
  id: string; workspace_id: string; slot_id: string; workspace_candidate_id: string;
  position: AssignmentPosition; shortlist_included: boolean; presentation_notes: string | null;
  internal_notes: string | null; slide_wording: SlideWording; sort_order: number; row_version: number; archived: boolean;
}
export interface AssignmentCreate {
  slot_id: string; workspace_candidate_id: string; expected_slot_row_version: number;
  shortlist_included?: boolean; presentation_notes?: string | null;
}
export interface AssignmentPatch {
  row_version: number; position?: 'option' | 'backup'; shortlist_included?: boolean;
  presentation_notes?: string | null; internal_notes?: string | null; slide_wording?: SlideWording;
}
export interface SetSlotMain {
  assignment_id: string | null; expected_slot_row_version: number; replacement_behavior: 'move_previous_to_backup';
}
export interface MainUndo {
  undo_event_id: string; slot_id: string; expected_slot_row_version: number;
  restore_assignment_positions: { assignment_id: string; position: AssignmentPosition }[];
}
export interface SetSlotMainResult { slot: Slot; affected_assignments: Assignment[]; undo: MainUndo | null }
export interface AssignmentRemove { row_version: number; reason?: string | null }
export interface AssignmentRemovalResult { success: true; affected_ids: string[] }
export interface AssignmentListOptions { output_type?: CastingOutput; cursor?: string; limit?: number }
export interface CastingMutationContext extends MutationContext { idempotencyKey: string }

/** Public service seam; HTTP/MCP call the same authenticated central adapter.
 * Implementations must enforce idempotency and locked optimistic checks in SQL. */
export interface CastingAssignmentOperations {
  listAssignments(actor: Actor, workspaceId: string, options?: AssignmentListOptions): Promise<{ data: Assignment[]; page: Page }>;
  createAssignment(actor: Actor, workspaceId: string, input: AssignmentCreate, context: CastingMutationContext): Promise<Assignment>;
  updateAssignment(actor: Actor, assignmentId: string, input: AssignmentPatch, context: CastingMutationContext): Promise<Assignment>;
  setSlotMain(actor: Actor, slotId: string, input: SetSlotMain, context: CastingMutationContext): Promise<SetSlotMainResult>;
  undoSlotMain(actor: Actor, slotId: string, input: MainUndo, context: CastingMutationContext): Promise<SetSlotMainResult>;
  removeAssignment(actor: Actor, assignmentId: string, input: AssignmentRemove, context: CastingMutationContext): Promise<AssignmentRemovalResult>;
}
export interface CastingOperations extends CastingAssignmentOperations {
  reorderWorkspace(actor: Actor, workspaceId: string, input: ReorderWorkspace, context: CastingMutationContext): Promise<Workspace>;
}

/** Internal server-loaded scope. Never accept this object from a request body. */
export interface CastingAuthority {
  principal_id: string; project_id: string; capabilities: readonly string[]; can_read: boolean; can_write: boolean;
}
export interface CastingPoolEntry { id: string; workspace_id: string; candidate_id: string; archived: boolean }
export interface CastingDraft {
  workspace: Pick<Workspace, 'id' | 'project_id' | 'row_version' | 'draft_revision'>;
  roles: Role[]; slots: WorkingSlot[]; workspace_candidates: CastingPoolEntry[]; assignments: Assignment[];
}
/** Private append-only event payload, loaded by event ID under current scope.
 * Resulting revisions fence even note-only edits that did not change the slot. */
export interface MainUndoRecord {
  event_id: string; workspace_id: string; slot_id: string; resulting_slot_row_version: number; consumed: boolean;
  changes: { assignment_id: string; previous_position: AssignmentPosition; resulting_position: AssignmentPosition; resulting_row_version: number }[];
}
/** A deterministic transaction plan, NOT a committed HTTP response or lock.
 * The adapter must apply atomically after locking/rechecking the same revisions. */
export interface CastingTransition<Result> {
  draft: CastingDraft; result: Result; changed: boolean;
  expected_versions: { workspace: number; slots: { id: string; row_version: number }[]; assignments: { id: string; row_version: number }[] };
  undo_record: MainUndoRecord | null; consume_undo_event_id: string | null;
}
