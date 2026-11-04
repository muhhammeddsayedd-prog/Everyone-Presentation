import registry from '../../packages/templates/versions/1.2.0/registry.json';
import { nativePresentation } from '../worker/presentation-native-fixture.ts';

/** Synthetic 1.2.0 snapshot: Main + Backup share one slot (overview page), an
 * Option with no frames, a three-frame candidate and a pending role. */
export function editorialPresentation(logoPlacement: 'cover' | 'every_slide' = 'cover') {
  const { snapshot, images } = nativePresentation([2, 1, 0, 3], true, 'role');
  snapshot.template = { key: registry.key, version: registry.version, content_sha256: registry.content_sha256, font_key: registry.font_key, font_hashes: Object.fromEntries(registry.fonts.map(font => [font.path, font.sha256])) };
  snapshot.cover.logo_placement = logoPlacement;
  const [, first, second] = snapshot.slides;
  second.role_id = first.role_id; second.slot_id = first.slot_id; second.role_label = first.role_label; second.slot_label = first.slot_label;
  first.position = 'main'; second.position = 'backup';
  for (const slide of snapshot.slides) slide.logo_asset_id = slide.order === 0 || logoPlacement === 'every_slide' ? snapshot.cover.logo_asset_id : null;
  return { snapshot, images };
}
