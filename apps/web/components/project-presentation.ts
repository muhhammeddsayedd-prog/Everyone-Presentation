export interface PresentationType { key: string; label: string; status: 'available' | 'planned' }
const labels: Record<string, string> = { casting: 'Casting', wardrobe: 'Wardrobe', art_direction: 'Art Direction', storyboard: 'Storyboard', vehicles_animals: 'Vehicles & Animals', fitting: 'Fitting', pre_ppm: 'Pre-PPM', ppm: 'PPM', production_documents: 'Production Documents' };
export function presentationTypeLabel(type = 'casting'): string { return labels[type] ?? 'Presentation'; }
export function plannedPresentation(type?: string): boolean { return type !== undefined && type !== 'casting'; }
