/** Provider-independent extraction data and the M02 OpenAPI working DTOs. */
export interface SourceReference {
  asset_id: string | null;
  page: number | null;
  paragraph: number | null;
  segment_index: number | null;
  start_ms: number | null;
  end_ms: number | null;
  quote: string | null;
}

export interface SourceClarification {
  field_path: string;
  reason: string;
  source: SourceReference | null;
}

/** Extraction markers start unresolved; working markers require an explicit decision. */
export interface SpecsClarification extends SourceClarification { resolved: boolean }

export interface RoleRequirements {
  age_range: string | null;
  gender_requirement: string | null;
  appearance_performance: string | null;
  languages: string[];
  accents: string[];
  skills: string[];
  scene_references: string[];
  shoot_dates: string[];
  location: string | null;
  availability_requirements: string | null;
  other_instructions: string | null;
}

export interface ExtractedRole {
  source_role_key: string;
  name: string | null;
  headcount: number | null;
  category: string | null;
  requirements: RoleRequirements;
  evidence: SourceReference[];
  clarifications: SourceClarification[];
}

/** Must be schema/source-validated at the extraction boundary before a draft commit. */
export interface SpecsExtraction {
  schema_version: '1.0';
  source_asset_id: string | null;
  source_language_codes: string[];
  roles: ExtractedRole[];
  general_instructions: string | null;
  clarifications: SourceClarification[];
}

export interface Spec {
  id: string;
  workspace_id: string;
  source_asset_id: string | null;
  source_text: string | null;
  normalized_instructions: string | null;
  clarifications: SpecsClarification[];
  row_version: number;
  processing_job_id: string | null;
}
export interface SpecSubmit { source_asset_id?: string; source_text?: string; row_version?: number }
export interface SpecPatch { row_version: number; normalized_instructions?: string | null; clarifications?: SpecsClarification[] }
export interface RoleCreate { name: string; headcount: number | null; category?: string | null; requirements: RoleRequirements }
export interface Role {
  id: string;
  workspace_id: string;
  name: string;
  headcount: number | null;
  category: string | null;
  requirements: RoleRequirements;
  clarifications: SpecsClarification[];
  sort_order: number;
  row_version: number;
  archived: boolean;
}
export interface RolePatch {
  row_version: number;
  name?: string;
  category?: string | null;
  requirements?: RoleRequirements;
  clarifications?: SpecsClarification[];
}
export interface ResizeSlots { row_version: number; desired_count: number; retire_slot_ids?: string[] }
export interface Slot { id: string; role_id: string; label: string; sort_order: number; row_version: number; archived: boolean }
export interface SlotPatch { row_version: number; label: string }

/** Internal state: never spread these fields into the public Role/Slot response. */
export interface WorkingRole extends Role { readonly source: Readonly<ExtractedRole> | null }
export interface WorkingSlot extends Slot { workspace_id: string; ordinal: number; provisional: boolean }
export interface SlotAssignment { id: string; slot_id: string; row_version: number; archived: boolean }
export interface SpecsDraft {
  spec: Spec;
  roles: WorkingRole[];
  slots: WorkingSlot[];
  /** Shared workspace draft revision; every draft mutation must advance it. */
  draft_revision: number;
  readonly source_extraction: Readonly<SpecsExtraction> | null;
}
export interface SpecsExtractionCommit {
  expected_spec_row_version: number;
  expected_draft_revision: number;
  source_asset_id: string | null;
  /** Original prepared text, including Arabic/mixed wording, not display shorthand. */
  source_text: string | null;
  extraction: SpecsExtraction;
}
/** Resource budget for a single materialized transaction, not a headcount fact/maximum. */
export interface SpecsAllocationOptions { maximum_new_slots?: number }
export interface SlotResizePlan<Assignment extends SlotAssignment = SlotAssignment> {
  role: WorkingRole;
  slots: WorkingSlot[];
  assignments: Assignment[];
  creates: WorkingSlot[];
  /** Before-images retained for explicit review/Undo; never hard-delete history. */
  retirements: { slot: WorkingSlot; assignments: Assignment[] }[];
  expected_versions: {
    role: { id: string; row_version: number };
    slots: { id: string; row_version: number }[];
    assignments: { id: string; row_version: number }[];
  };
}
