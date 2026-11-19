import type { ReviewIssue, WorkspaceReview } from '@eps/domain';
import { slideWordingFields, type SlideWordingField } from '../../../../packages/domain/src/casting-types.ts';
import { REVIEW_FIELD_LABELS } from '../../../../packages/templates/src/render.ts';
import { PENDING_REQUIREMENT_LABELS } from '../../../../packages/templates/versions/1.1.0/render.ts';

/* Server checks shown in the Presentation step. The server review decides what blocks generation;
   this module only names fields and points each check at the place where it is fixed. */

/** Checks the Presentation step clears itself: it measures the layout before generating. */
export const LAYOUT_CHECK_CODES = ['FIT_MEASUREMENT_REQUIRED', 'FIT_MEASUREMENT_FAILED'];

const editorialLabels: Record<string, string> = { role_name: 'Role / slot title', project_name: 'Cover title', client_name: 'Client name', title: 'Presentation title', layout: 'Page layout',
  'presentation.subtitle': 'Page subtitle (scene | setting | role)', 'presentation.note': 'Highlighted note', cover_note: 'Cover note', scene_title: 'Scene divider',
  'presentation.caption_name': 'Name under the portrait', 'presentation.caption_details': 'Age | height under the portrait' };

export function fitFieldLabel(field: string) {
  const key = field.replace(/^requirements\./, '');
  return REVIEW_FIELD_LABELS[field as SlideWordingField] ?? PENDING_REQUIREMENT_LABELS[key as keyof typeof PENDING_REQUIREMENT_LABELS] ?? editorialLabels[field] ?? field;
}
export const isWordingField = (field: string | null) => !!field && slideWordingFields.includes(field as SlideWordingField);

/** Where a blocking or noted check is repaired. Null when there is no single place to send the person. */
export function checkLink(issue: ReviewIssue, review: WorkspaceReview, base: string): { href: string; label: string } | null {
  const slide = issue.entity_id ? review.slides.find(row => row.assignment_id === issue.entity_id) : undefined;
  switch (issue.code) {
    case 'PROFILE_ARCHIVED': return issue.entity_id ? { href: `/library/cast/${issue.entity_id}`, label: 'Open profile' } : null;
    case 'UNREVIEWED_PROFILE': case 'MISSING_FIELD': case 'MISSING_FACTS': case 'LAYOUT_OVERFLOW':
      return slide?.candidate_id ? { href: `/library/cast/${slide.candidate_id}`, label: 'Open profile' } : null;
    case 'MEDIA_UNAVAILABLE': case 'FRAME_UNAVAILABLE': case 'FEWER_FRAMES': case 'NO_INTRODUCTION': return { href: `${base}/cast`, label: 'Choose project material' };
    case 'OPEN_SLOT': case 'NO_MAIN': return { href: `${base}/organize`, label: 'Open Casting' };
    case 'ROLE_NEEDS_CLARIFICATION': case 'NO_REQUIREMENTS': return { href: `${base}/specs`, label: 'Open Specs' };
    case 'LOGO_UNAVAILABLE': return { href: `${base}/project`, label: 'Open Project branding' };
    default: return null;
  }
}

/** The person (or cover) a check or overflow belongs to, for its row title. */
export function checkTitle(review: WorkspaceReview, entityId: string | null, slideIndex?: number) {
  const slide = slideIndex !== undefined ? slideIndex === 0 ? null : review.slides[slideIndex - 1] : entityId ? review.slides.find(row => row.assignment_id === entityId) : undefined;
  if (slideIndex === 0) return 'Cover';
  if (!slide) return 'This draft';
  return slide.kind === 'candidate' ? slide.fields.name_or_id : `${slide.slot_label} · Pending`;
}
