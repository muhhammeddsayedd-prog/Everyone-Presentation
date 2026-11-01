import { DomainError } from './types.ts';

export const PRESENTATION_TYPES = Object.freeze([
  { key: 'casting', label: 'Casting', status: 'available' },
  { key: 'wardrobe', label: 'Wardrobe', status: 'planned' },
  { key: 'art_direction', label: 'Art Direction', status: 'planned' },
  { key: 'storyboard', label: 'Storyboard', status: 'planned' },
  { key: 'vehicles_animals', label: 'Vehicles & Animals', status: 'planned' },
  { key: 'fitting', label: 'Fitting', status: 'planned' },
  { key: 'pre_ppm', label: 'Pre-PPM', status: 'planned' },
  { key: 'ppm', label: 'PPM', status: 'planned' },
  { key: 'production_documents', label: 'Production Documents', status: 'planned' },
] as const);
export type PresentationTypeKey = typeof PRESENTATION_TYPES[number]['key'];
export type PresentationType = typeof PRESENTATION_TYPES[number];
export interface ProjectCreate { name: string; presentation_type: PresentationTypeKey; client_id?: string }
export interface ClientSummary { id: string; name: string; row_version: number }

export function isPresentationType(value: unknown): value is PresentationTypeKey {
  return PRESENTATION_TYPES.some(type => type.key === value);
}
export function parseProjectCreate(value: unknown): ProjectCreate {
  const invalid = (): never => { throw new DomainError('VALIDATION_FAILED', 'Provide a project name, supported presentation type, and optional authorized client.', 400); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !['name', 'presentation_type', 'client_id'].includes(key))
    || typeof row.name !== 'string' || row.name.trim().length < 1 || row.name.trim().length > 500
    || /[\p{Cc}]/u.test(row.name) || !isPresentationType(row.presentation_type)
    || row.client_id !== undefined && (typeof row.client_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(row.client_id))) return invalid();
  return { name: row.name.trim(), presentation_type: row.presentation_type, ...(row.client_id !== undefined ? { client_id: row.client_id as string } : {}) };
}
