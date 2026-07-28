// Shared incident categories for TCIMS.
// Each category has a stable id (stored as the incident `type`),
// a human label, and a color used for map pins + UI badges.
// `emergency: true` marks categories that are always TOP priority
// (fire / health / police) regardless of where they occur — a service
// (Fire, EMS, SAPS) will later be contacted for these via Telegram.

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
  | 'flood'
  | 'fire'
  | 'health_emergency'
  | 'police_required';

export interface Category {
  id: CategoryId;
  label: string;
  color: string;
  // Emergency categories are always TOP priority (service response needed).
  emergency?: boolean;
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
  // Emergency / service-response categories — always TOP priority.
  { id: 'fire', label: 'Fire (Service Required)', color: '#ea580c', emergency: true },
  { id: 'health_emergency', label: 'Health Emergency', color: '#0d9488', emergency: true },
  { id: 'police_required', label: 'Police Required', color: '#1e3a8a', emergency: true },
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

// True when the category is an always-TOP-priority emergency type.
export function isEmergencyCategory(type?: string): boolean {
  return Boolean(type && CATEGORY_BY_ID[type]?.emergency);
}
