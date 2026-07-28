// Shared incident categories for TCIMS.
// Each category has a stable id (stored as the incident `type`),
// a human label, and a color used for map pins + UI badges.

export type CategoryId =
  | 'wildfire'
  | 'planned_burns'
  | 'electricity_outage'
  | 'crime'
  | 'housebreaking'
  | 'stray_cattle'
  | 'stray_pets'
  | 'riot'
  | 'weather_warning'
  | 'flood';

export interface Category {
  id: CategoryId;
  label: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'wildfire', label: 'Wildfire', color: '#e25822' },
  { id: 'planned_burns', label: 'Planned Burns', color: '#d97706' },
  { id: 'electricity_outage', label: 'Electricity Outage', color: '#facc15' },
  { id: 'crime', label: 'Crime', color: '#7c3aed' },
  { id: 'housebreaking', label: 'Housebreaking', color: '#dc2626' },
  { id: 'stray_cattle', label: 'Stray Cattle', color: '#16a34a' },
  { id: 'stray_pets', label: 'Stray Pets', color: '#ec4899' },
  { id: 'riot', label: 'Riot', color: '#111827' },
  { id: 'weather_warning', label: 'Weather Warning', color: '#2563eb' },
  { id: 'flood', label: 'Flood', color: '#0891b2' },
];

const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

// Resolve a stored `type` (which may be an old free-text value or a known id)
// to a Category, falling back to a neutral grey for anything unrecognised.
export function getCategory(type?: string): Category {
  if (type && CATEGORY_BY_ID[type]) {
    return CATEGORY_BY_ID[type];
  }
  return { id: 'unknown' as CategoryId, label: type || 'Unknown', color: '#6b7280' };
}
