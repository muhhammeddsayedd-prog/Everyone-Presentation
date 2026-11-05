import type { ReviewIssue, ReviewSlide, WorkspaceReview } from '../../../../packages/domain/src/review-types.ts';
import type { SlideWordingField } from '../../../../packages/domain/src/casting-types.ts';
import type { StagePage } from '../workspace/stage-pages.ts';

/** An unsaved change shown on the stage before it is saved: assignment wording (typed, or an AI suggestion
 * that has not been applied) or the project availability of the person in that assignment. */
export interface ReviewPreviewEdit { assignmentId: string; field?: SlideWordingField; wording?: string; availability?: string; suggestion?: boolean }

const NOT_PROVIDED = 'Not provided';
/** The server's review with one unsaved edit applied the way saving it would: wording is printed as written
 * (empty inherits the source), and availability changes only where no wording override replaces it. */
export function previewReview(review: WorkspaceReview, edit: ReviewPreviewEdit | null): WorkspaceReview {
  if (!edit) return review;
  const slides = review.slides.map((slide): ReviewSlide => {
    if (slide.kind !== 'candidate' || slide.assignment_id !== edit.assignmentId) return slide;
    const fields = { ...slide.fields }; const source = { ...slide.source_fields };
    if (edit.field && edit.wording !== undefined) fields[edit.field] = edit.wording.trim() || source[edit.field];
    if (edit.availability !== undefined) {
      const inherited = slide.fields.availability === slide.source_fields.availability;
      source.availability = edit.availability.trim() || NOT_PROVIDED;
      if (inherited) fields.availability = source.availability;
    }
    return { ...slide, fields, source_fields: source };
  });
  return { ...review, slides };
}

export type CheckGroupKey = 'information' | 'images' | 'profiles' | 'pending' | 'layout';
export const CHECK_GROUPS: { key: CheckGroupKey; title: string }[] = [
  { key: 'information', title: 'Information' }, { key: 'images', title: 'Images and video' }, { key: 'profiles', title: 'Profiles not reviewed' },
  { key: 'pending', title: 'Pending slots' }, { key: 'layout', title: 'Layout fit' },
];
/** Which panel group a server check belongs to. Severity stays the server's; the group only places it. */
export function checkGroup(issue: ReviewIssue): CheckGroupKey {
  switch (issue.code) {
    case 'UNREVIEWED_PROFILE': return 'profiles';
    case 'OPEN_SLOT': case 'NO_MAIN': return 'pending';
    case 'MEDIA_UNAVAILABLE': case 'FRAME_UNAVAILABLE': case 'FEWER_FRAMES': case 'NO_INTRODUCTION': case 'LOGO_UNAVAILABLE': return 'images';
    case 'FIT_MEASUREMENT_REQUIRED': case 'FIT_MEASUREMENT_FAILED': case 'LAYOUT_OVERFLOW': case 'LAYOUT_NOT_READY': return 'layout';
    default: return 'information';
  }
}

/** The slide a check is about, by the record it names: the assignment's own page first, then the person, the slot, the role. */
export function slideForIssue(review: WorkspaceReview, issue: Pick<ReviewIssue, 'entity_id'>): ReviewSlide | null {
  const id = issue.entity_id; if (!id) return null;
  return review.slides.find(slide => slide.assignment_id === id) ?? review.slides.find(slide => slide.candidate_id === id)
    ?? review.slides.find(slide => slide.slot_id === id) ?? review.slides.find(slide => slide.role_id === id) ?? null;
}
/** The stage page showing that slide's record (its detail or Pending page, not an overview). */
export function pageForSlide(pages: StagePage[], slide: ReviewSlide | null): number | null {
  if (!slide) return null;
  const same = (other: ReviewSlide | null) => !!other && (slide.assignment_id ? other.assignment_id === slide.assignment_id : other.kind === 'pending' && other.slot_id === slide.slot_id && other.role_id === slide.role_id);
  return pages.find(page => (page.kind === 'detail' || page.kind === 'pending') && same(page.slide))?.index ?? pages.find(page => same(page.slide))?.index ?? null;
}
/** A check names a slide field only when the server says which; requirement fields highlight their whole group. */
export function issueField(issue: ReviewIssue): string | null {
  if (!issue.field) return null;
  return issue.field;
}
