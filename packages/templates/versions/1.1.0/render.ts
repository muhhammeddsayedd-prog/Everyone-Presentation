import type { WorkspaceReview, ReviewSlide } from '../../../domain/src/review-types.ts';
import { slideWordingFields, type SlideWordingField } from '../../../domain/src/casting-types.ts';

export const REVIEW_FIELD_LABELS: Record<SlideWordingField, string> = {
  name_or_id: 'Name / Casting ID', age_or_range: 'Age / Age range', height_measurements: 'Height / Measurements',
  languages_accents: 'Languages / Accents', skills_experience: 'Skills / Experience', city: 'City / Location',
  previous_projects_roles: 'Previous projects / Roles', classification: 'Cast category', availability: 'Project availability', presentation_notes: 'Presentation notes',
};
export const PENDING_REQUIREMENT_LABELS = {
  role_category: 'Cast category', age_range: 'Age / Age range', gender_requirement: 'Gender requirement', appearance_performance: 'Appearance / Performance',
  languages: 'Languages', accents: 'Accents', skills: 'Skills', scene_references: 'Scene references', shoot_dates: 'Shoot dates',
  location: 'Location', availability_requirements: 'Availability requirements', other_instructions: 'Other instructions',
} as const;
export interface TemplateAssets {
  fontFaces?: { family: 'Latin' | 'Arabic'; weight: 400 | 500 | 600; source: string }[];
  imageSources?: Record<string, string>; brandLogo?: string; videoHrefs?: Record<string, string>; versionLabel?: string;
}
const escape = (text: unknown) => String(text ?? '').replace(/[&<>"']/gu, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]!);
function source(value: string, kind: 'font' | 'image') {
  const valid = kind === 'font' ? /^(?:data:font\/woff2;base64,[A-Za-z0-9+/=]+|\/fonts\/IBMPlexSans(?:Arabic)?-(?:Regular|Medium|SemiBold)\.woff2)$/u
    : /^(?:data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|\/brand\/everyone-logotype-white\.svg|\/api\/v1\/media\/[a-f0-9-]{36}\/content)$/u;
  if (!valid.test(value)) throw new Error('TEMPLATE_ASSET_SOURCE_INVALID'); return escape(value);
}
function hyperlink(value: string) {
  if (!value.startsWith('/') && !/^https?:\/\//u.test(value) || /[\p{C}]/u.test(value) || value.startsWith('//')) throw new Error('TEMPLATE_LINK_INVALID');
  return escape(value);
}
/** Shared fixed layout. Text remains visible when oversized; measured overflow
 * must be repaired before a generation can become ready. No live facts read. */
export const TEMPLATE_CSS = `
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#171919;color:#f7f7f7;font-family:Latin,Arabic,sans-serif}
@page{size:1600px 900px;margin:0}.eps-page{width:1600px;height:900px;padding:54px 64px;position:relative;background:#080909;break-after:page;page-break-after:always}
.eps-page:last-child{break-after:auto;page-break-after:auto}.eps-brand{width:160px;height:46px;object-fit:contain;object-position:left}
.eps-header{height:132px;display:grid;grid-template-columns:1fr 240px;gap:36px;border-bottom:1px solid #373a38;padding-bottom:20px}
.eps-context{min-width:0}.eps-context h1{font-size:38px;font-weight:600;line-height:48px;height:48px;margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere}
.eps-context p{font-size:22px;line-height:30px;height:30px;margin:0;color:#b9bfbc;overflow-wrap:anywhere;white-space:pre-wrap}
.eps-header aside{text-align:right;min-width:0}.eps-position{font-size:20px;color:#01bd68;text-transform:capitalize;margin-top:15px}
.eps-main{display:grid;grid-template-columns:560px 1fr;gap:42px;margin-top:30px;height:606px}
.eps-images{height:606px;display:grid;gap:12px;grid-template-rows:repeat(var(--frame-count),minmax(0,1fr));min-height:0}
.eps-images img{width:100%;height:100%;min-height:0;object-fit:contain;background:#151817}.eps-no-image{height:606px;display:grid;place-items:center;border:1px solid #373a38;color:#b9bfbc;font-size:24px}.eps-images .eps-no-image{height:auto;min-height:0}
.eps-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(5,minmax(0,1fr));gap:15px 30px;margin:0;min-width:0}
.eps-field{min-width:0;min-height:0}.eps-field dt{font-size:16px;font-weight:500;line-height:22px;color:#01bd68;margin-bottom:6px}
.eps-field dd{font-size:23px;line-height:30px;margin:0;height:76px;white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext;font-weight:400}
.eps-footer{position:absolute;left:64px;right:64px;bottom:25px;display:flex;justify-content:space-between;gap:20px;color:#9ca49f;font-size:15px;line-height:22px}
.eps-footer a{color:#01bd68;text-decoration:underline}.eps-cover{display:flex;flex-direction:column;justify-content:space-between;padding:70px 80px}
.eps-cover .eps-brand{width:250px;height:65px}.eps-cover h1{font-size:82px;line-height:100px;height:210px;max-width:1320px;margin:0;overflow-wrap:anywhere;white-space:pre-wrap}
.eps-cover .eps-client{font-size:32px;line-height:44px;height:88px;max-width:1200px;margin:26px 0;overflow-wrap:anywhere;white-space:pre-wrap;color:#b9bfbc}
.eps-cover .eps-title{font-size:42px;line-height:52px;height:104px;color:#01bd68;max-width:1200px;overflow-wrap:anywhere;white-space:pre-wrap}
.eps-client-logo{object-fit:contain;position:absolute}.eps-cover-logo{width:220px;height:100px;top:60px;right:75px}.eps-footer-logo{width:120px;height:50px;right:150px;bottom:18px}
.eps-pending{height:606px}.eps-pending h2{color:#01bd68;font-size:48px;line-height:60px;margin:0 0 20px;height:60px}
.eps-requirements{display:grid;height:526px;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(6,minmax(0,1fr));gap:10px 32px;margin:0}
.eps-requirement{min-width:0;min-height:0}.eps-requirement dt{font-size:16px;font-weight:500;line-height:20px;color:#01bd68;margin-bottom:4px}
.eps-requirement dd{font-size:20px;line-height:24px;margin:0;height:48px;white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext}
`;
function brand(assets: TemplateAssets) { return `<img class="eps-brand" src="${source(assets.brandLogo ?? '/brand/everyone-logotype-white.svg', 'image')}" alt="everyone.">`; }
function clientLogo(review: WorkspaceReview, assets: TemplateAssets, cover: boolean) {
  const id = review.cover.logo_asset_id; const url = id && assets.imageSources?.[id];
  return url && (cover || review.cover.logo_placement === 'every_slide') ? `<img class="eps-client-logo ${cover ? 'eps-cover-logo' : 'eps-footer-logo'}" src="${source(url, 'image')}" alt="Client logo">` : '';
}
function page(slide: ReviewSlide, index: number, review: WorkspaceReview, assets: TemplateAssets) {
  const context = `<header class="eps-header"><div class="eps-context"><h1 data-fit-field="role_name">${escape(slide.role_name)}</h1><p data-fit-field="slot_label">${escape(slide.slot_label)}</p></div><aside>${brand(assets)}<div class="eps-position">${escape(slide.position ?? 'Pending')}</div></aside></header>`;
  let body: string;
  if (slide.kind === 'pending') {
    body = `<section class="eps-pending"><h2>Pending</h2><dl class="eps-requirements">${Object.entries(PENDING_REQUIREMENT_LABELS).map(([key, label]) => {
      const value = key === 'role_category' ? slide.role_category : slide.requirements?.[key as keyof NonNullable<ReviewSlide['requirements']>];
      const text = Array.isArray(value) ? value.join('; ') : value;
      return `<div class="eps-requirement"><dt>${label}</dt><dd dir="auto" data-fit-field="${key === 'role_category' ? key : 'requirements.' + key}">${escape(text || 'Not provided')}</dd></div>`;
    }).join('')}</dl></section>`;
  } else {
    const images = slide.frames.length ? `<div class="eps-images" style="--frame-count:${slide.frames.length}">${slide.frames.map((frame, n) => {
      const url = assets.imageSources?.[frame.asset_id]; return url ? `<img src="${source(url, 'image')}" alt="Selected source frame ${n + 1} of ${slide.frames.length}">` : '<div class="eps-no-image">Source frame preview</div>';
    }).join('')}</div>` : '<div class="eps-no-image">Image not provided</div>';
    body = `<section class="eps-main">${images}<dl class="eps-fields">${slideWordingFields.map(key => `<div class="eps-field"><dt>${REVIEW_FIELD_LABELS[key]}</dt><dd dir="auto" data-fit-field="${key}">${escape(slide.fields[key] || 'Not provided')}</dd></div>`).join('')}</dl></section>`;
  }
  const video = slide.video_asset_id && assets.videoHrefs?.[slide.video_asset_id];
  return `<article class="eps-page" data-page-index="${index}">${context}${clientLogo(review, assets, false)}${body}<footer class="eps-footer"><span>${escape(review.cover.project_name)}</span>${video ? `<a href="${hyperlink(video)}">Watch original introduction</a>` : '<span>Video not provided</span>'}<span>${index + 1}</span></footer></article>`;
}
export function renderReviewDocument(review: WorkspaceReview, assets: TemplateAssets = {}) {
  const fonts = (assets.fontFaces ?? []).map(font => `@font-face{font-family:${font.family};font-style:normal;font-weight:${font.weight};font-display:block;src:url("${source(font.source, 'font')}") format("woff2")}`).join('');
  const cover = `<article class="eps-page eps-cover" data-page-index="0">${brand(assets)}${clientLogo(review, assets, true)}<div><h1 data-fit-field="project_name">${escape(review.cover.project_name)}</h1><p class="eps-client" data-fit-field="client_name">${escape(review.cover.client_name ?? 'Client not provided')}</p><div class="eps-title" data-fit-field="title">${escape(review.cover.title)}</div></div><footer>Cast ${review.cover.output_type === 'shortlist' ? 'Shortlist' : 'Selection'} · ${escape(assets.versionLabel ?? 'Draft preview')}</footer></article>`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1600"><title>Everyone casting preview</title><style>${fonts}${TEMPLATE_CSS}</style></head><body>${cover}${review.slides.map((slide, index) => page(slide, index + 1, review, assets)).join('')}</body></html>`;
}
