import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import referenceRegistry from '../../packages/templates/versions/1.4.0/registry.json';
import type { FrozenAsset, FrozenSlide, RenderSnapshot } from '../../packages/domain/src/presentation-types.ts';
import type { WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import { refId } from './reference-review.ts';

const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const BACKGROUNDS = ['#3a74c9', '#6b5446', '#2f6fd6', '#8a2a2a', '#c9b9a6', '#41546b', '#7a8a5c', '#b07a4f'];
const SKIN = ['#e7b99a', '#c68e6b', '#8d5a3b', '#f1c9a9', '#a8714f'];
const CLOTHES = ['#1d1d1f', '#5b4a3a', '#e9e4dc', '#2b3f5c', '#7d2f3f', '#3c5d3a'];
/** A synthetic, person-shaped studio portrait (backdrop, shoulders, head, hair). Never a real person. */
export function syntheticPortrait(seed: number, width: number, height: number, mime: 'image/jpeg' | 'image/png' = 'image/jpeg') {
  const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d'); const s = Math.min(width, height);
  const backdrop = ctx.createLinearGradient(0, 0, 0, height); backdrop.addColorStop(0, BACKGROUNDS[seed % BACKGROUNDS.length]); backdrop.addColorStop(1, '#202020');
  ctx.fillStyle = backdrop; ctx.fillRect(0, 0, width, height);
  const cx = width / 2; const headY = height * 0.36; const head = s * 0.17;
  ctx.fillStyle = CLOTHES[seed % CLOTHES.length]; ctx.beginPath(); ctx.ellipse(cx, height * 0.82, s * 0.46, height * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = SKIN[seed % SKIN.length]; ctx.fillRect(cx - head * 0.38, headY + head * 0.7, head * 0.76, head * 0.9);
  ctx.beginPath(); ctx.ellipse(cx, headY, head * 0.82, head, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = seed % 3 === 0 ? '#2a1a12' : seed % 3 === 1 ? '#5a3a22' : '#9a9a9a'; ctx.beginPath(); ctx.ellipse(cx, headY - head * 0.45, head * 0.88, head * 0.62, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; for (const dx of [-0.32, 0.32]) { ctx.beginPath(); ctx.arc(cx + dx * head, headY - head * 0.05, head * 0.07, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#7a3b30'; ctx.lineWidth = head * 0.05; ctx.beginPath(); ctx.arc(cx, headY + head * 0.32, head * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  return mime === 'image/png' ? canvas.toBuffer('image/png') : canvas.toBuffer('image/jpeg', 92);
}
function syntheticLogo() {
  const canvas = createCanvas(808, 236); const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0d3b3e'; ctx.fillRect(0, 0, 808, 236);
  ctx.fillStyle = '#e8e2d6'; ctx.font = '120px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SYNTH', 404, 124);
  return canvas.toBuffer('image/png');
}

/** Freezes a synthetic 1.4.0 review (tests/fixtures/reference-review.ts) into a render snapshot with real image bytes. */
export function referenceSnapshot(review: WorkspaceReview, versionNo = 3) {
  const images = new Map<string, Uint8Array>(); const inventory: FrozenAsset[] = []; const slides: FrozenSlide[] = [];
  const version = refId(20001); const logo = review.cover.logo_asset_id;
  const add = (asset: FrozenAsset, bytes?: Uint8Array) => { if (inventory.some(item => item.asset_id === asset.asset_id)) return; inventory.push(asset); if (bytes) images.set(asset.asset_id, bytes); };
  if (logo) { const bytes = syntheticLogo(); add({ asset_id: logo, sha256: hash(bytes), asset_kind: 'client_logo', mime_type: 'image/png', byte_size: bytes.length, bucket: 'eps-brand-assets', object_key: `assets/${logo}/original.png`, width: 808, height: 236, duration_ms: null, source_asset_id: null, timestamp_ms: null }, bytes); }
  const presentation = structuredClone(review.presentation!);
  slides.push({ id: refId(20100), version_id: version, order: 0, kind: 'cover', assignment_id: null, candidate_id: null, role_label: null, role_category: null, slot_label: null, position: null, fields: null, requirements: null,
    frame_asset_ids: [], video_asset_id: null, logo_asset_id: logo, role_id: null, slot_id: null, candidate_media_id: null, provisional: false, review_status: null, frames: [] });
  review.slides.forEach((slide, n) => {
    const frames = slide.frames.map(frame => {
      const seed = Number(frame.asset_id.slice(-4)); const bytes = syntheticPortrait(seed, frame.width, frame.height);
      add({ asset_id: frame.source_asset_id, sha256: hash(Buffer.from(frame.source_asset_id)), asset_kind: 'candidate_video', mime_type: 'video/mp4', byte_size: 4096, bucket: 'eps-candidate-assets', object_key: `assets/${frame.source_asset_id}/original.mp4`, width: frame.width, height: frame.height, duration_ms: 30000, source_asset_id: null, timestamp_ms: null });
      const frozen = { ...frame, sha256: hash(bytes) };
      add({ asset_id: frame.asset_id, sha256: frozen.sha256, asset_kind: 'candidate_frame', mime_type: 'image/jpeg', byte_size: bytes.length, bucket: 'eps-candidate-outputs', object_key: `jobs/${refId(30000)}/attempts/${refId(30001)}/${frame.asset_id}.jpg`, width: frame.width, height: frame.height, duration_ms: null, source_asset_id: frame.source_asset_id, timestamp_ms: frame.timestamp_ms }, bytes);
      return frozen;
    });
    const portrait = presentation.slides[n].portrait;
    if (portrait?.source === 'photo') {
      const bytes = syntheticPortrait(Number(portrait.asset_id.slice(-4)) + 3, portrait.width, portrait.height); portrait.sha256 = hash(bytes);
      add({ asset_id: portrait.asset_id, sha256: portrait.sha256, asset_kind: 'candidate_photo', mime_type: 'image/jpeg', byte_size: bytes.length, bucket: 'eps-candidate-photos', object_key: `candidates/${slide.candidate_id}/${portrait.asset_id}.jpg`, width: portrait.width, height: portrait.height, duration_ms: null, source_asset_id: null, timestamp_ms: null }, bytes);
    } else if (portrait) portrait.sha256 = frames.find(frame => frame.asset_id === portrait.asset_id)!.sha256;
    slides.push({ id: refId(20101 + n), version_id: version, order: n + 1, kind: slide.kind, assignment_id: slide.assignment_id, candidate_id: slide.candidate_id, role_label: slide.role_name, role_category: slide.role_category ?? null, slot_label: slide.slot_label,
      position: slide.position, fields: slide.kind === 'candidate' ? slide.fields : null, requirements: slide.requirements, frame_asset_ids: frames.map(frame => frame.asset_id), video_asset_id: slide.video_asset_id, logo_asset_id: null,
      role_id: slide.role_id, slot_id: slide.slot_id, candidate_media_id: slide.candidate_media_id, provisional: slide.provisional, review_status: slide.review_status, frames });
  });
  inventory.sort((left, right) => left.asset_id.localeCompare(right.asset_id));
  const snapshot: RenderSnapshot = {
    schema_version: '1.0', hash_protocol: 'eps-cast-canonical-v1', version_id: version, series_id: review.series_id, workspace_id: review.workspace_id, project_id: refId(3), version_no: versionNo,
    created_at: '2026-10-09T12:00:00.000000Z', input_workspace_row_version: 1, input_draft_revision: review.draft_revision, input_fingerprint: review.input_fingerprint,
    template: { key: referenceRegistry.key, version: referenceRegistry.version, content_sha256: referenceRegistry.content_sha256, font_key: referenceRegistry.font_key, font_hashes: Object.fromEntries(referenceRegistry.fonts.map(font => [font.path, font.sha256])) },
    render_configuration: { renderer_version: 'everyone-casting-pdf-v1', application_origin: 'http://127.0.0.1:3000' },
    audience_snapshot: { id: refId(4), key: 'client', label: 'Client', scope: 'external', settings: {}, archived: false, row_version: 1 },
    cover: structuredClone(review.cover), slides, asset_inventory: inventory, presentation,
  };
  return { snapshot, images };
}
